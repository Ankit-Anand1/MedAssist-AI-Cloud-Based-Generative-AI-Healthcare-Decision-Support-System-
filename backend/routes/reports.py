import os
import uuid
import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from bson import ObjectId
from middleware.auth import get_current_user
from database import db
from config import settings

router = APIRouter(prefix="/api/reports", tags=["Reports"])
logger = logging.getLogger("routes.reports")

# ── Lazy-loaded analyzers (loaded on first use to avoid slow startup) ──
_analyzers: dict = {}


def _get_analyzer(report_type: str):
    """Get or create the appropriate analyzer for the report type."""
    if report_type not in _analyzers:
        try:
            if report_type == "Brain MRI":
                from ai.mri.analyzer import MRIAnalyzer
                _analyzers[report_type] = MRIAnalyzer(upload_dir=settings.UPLOAD_DIR)
            elif report_type == "X-ray":
                from ai.xray.analyzer import XRayAnalyzer
                _analyzers[report_type] = XRayAnalyzer(upload_dir=settings.UPLOAD_DIR)
            elif report_type == "ECG":
                from ai.ecg.analyzer import ECGAnalyzer
                _analyzers[report_type] = ECGAnalyzer(upload_dir=settings.UPLOAD_DIR)
            elif report_type in ("Blood Test", "Medical Report"):
                from ai.blood.analyzer import BloodReportAnalyzer
                _analyzers[report_type] = BloodReportAnalyzer(upload_dir=settings.UPLOAD_DIR)
            else:
                return None
        except Exception as e:
            logger.error(f"Failed to load analyzer for {report_type}: {e}")
            return None
    return _analyzers.get(report_type)


async def _run_ai_analysis(report_id: str, patient_id: str, report_type: str, file_path: str, file_type: str):
    """
    Background task: run AI analysis on an uploaded report.
    Updates the report status and saves results to the ai_analysis collection.
    """
    try:
        # Update report status to Processing
        await db.reports.update_one(
            {"_id": ObjectId(report_id)},
            {"$set": {"status": "AI Processing", "processing_status": "Processing"}}
        )

        analyzer = _get_analyzer(report_type)
        if not analyzer:
            logger.warning(f"No analyzer available for report type: {report_type}")
            await db.reports.update_one(
                {"_id": ObjectId(report_id)},
                {"$set": {
                    "status": "Pending",
                    "processing_status": "No AI model available",
                }}
            )
            return

        # Run the analysis
        result = await analyzer.analyze(
            file_path=file_path,
            file_type=file_type,
            report_id=report_id,
            patient_id=patient_id,
        )

        # Save AI analysis result
        analysis_doc = {
            "report_id": report_id,
            "patient_id": patient_id,
            "type": report_type,
            "modality": result.modality,
            "model_name": result.model_name,
            "model_type": result.model_type,
            "confidence": result.confidence,
            "findings": [
                {
                    "label": f.label,
                    "value": f.value,
                    "status": f.status,
                    "detail": f.detail,
                }
                for f in result.findings
            ],
            "summary": result.summary,
            "recommendations": result.recommendations,
            "output_image_url": result.output_image_url,
            "processed_at": result.processed_at,
            "status": result.status,
            "error_message": result.error_message,
            "created_at": datetime.utcnow(),
        }

        # Upsert (in case of re-analysis)
        await db.ai_analysis.update_one(
            {"report_id": report_id},
            {"$set": analysis_doc},
            upsert=True,
        )

        # Save lab values for blood reports
        if result.lab_values:
            for lv in result.lab_values:
                lab_doc = {
                    "patient_id": patient_id,
                    "report_id": report_id,
                    "name": lv.name,
                    "value": lv.value,
                    "unit": lv.unit,
                    "reference_range": lv.reference_range,
                    "status": lv.status,
                    "extraction_note": lv.extraction_note,
                }
                await db.lab_values.update_one(
                    {"patient_id": patient_id, "report_id": report_id, "name": lv.name},
                    {"$set": lab_doc},
                    upsert=True,
                )

        # Determine report status according to explicit AI states:
        # AI Processing | AI Analyzed | AI Analysis Failed | Unsupported File
        if result.status == "Completed":
            report_status = "AI Analyzed"
            proc_status = "Ready for Analysis"
        elif result.status == "Unsupported File":
            report_status = "Unsupported File"
            proc_status = "Unsupported File"
        else:
            report_status = "AI Analysis Failed"
            proc_status = "Inference Failed"

        update_fields = {
            "status": report_status,
            "processing_status": proc_status,
            "ai_confidence": result.confidence if result.status == "Completed" else None,
        }
        if result.status == "Completed" and result.findings:
            update_fields["findings"] = [f.label for f in result.findings if f.status != "Normal"]
        else:
            update_fields["findings"] = []

        if result.summary:
            update_fields["summary"] = result.summary
        elif result.error_message:
            update_fields["summary"] = result.error_message

        await db.reports.update_one(
            {"_id": ObjectId(report_id)},
            {"$set": update_fields}
        )

        # Create timeline event
        await db.medical_history.insert_one({
            "patient_id": patient_id,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "title": f"{report_type} AI Analysis Completed",
            "description": f"AI-assisted analysis of {report_type} completed. Confidence: {result.confidence}%.",
            "type": "report",
            "linked_entity_id": report_id,
        })

        # ── Generate real notification for doctors ──
        patient = await db.patients.find_one({"_id": ObjectId(patient_id)}) if ObjectId.is_valid(patient_id) else None
        patient_name = patient.get("name", "Patient") if patient else "Patient"

        has_abnormal = any(f.status != "Normal" for f in result.findings) if result.findings else False
        notif_type = "alert" if has_abnormal else "success"
        notif_title = (
            f"Flagged: {report_type} for {patient_name}"
            if has_abnormal
            else f"AI Analysis Complete: {report_type}"
        )
        notif_message = (
            f"Abnormal findings detected in {patient_name}'s {report_type}. "
            f"Confidence: {result.confidence}%. Requires physician review."
            if has_abnormal
            else f"{patient_name}'s {report_type} analysis completed. "
            f"Confidence: {result.confidence}%. No critical abnormalities detected."
        )
        await db.notifications.insert_one({
            "target_role": "doctor",
            "patient_id": patient_id,
            "report_id": report_id,
            "title": notif_title,
            "message": notif_message,
            "time": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
            "type": notif_type,
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        })

        await db.notifications.insert_one({
            "target_role": "patient",
            "patient_id": patient_id,
            "report_id": report_id,
            "title": f"Report Analysis Complete: {report_type}",
            "message": f"AI analysis for your {report_type} is complete and ready for review.",
            "time": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
            "type": notif_type,
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        })

        logger.info(f"✓ AI analysis completed for report {report_id} ({report_type})")

    except Exception as e:
        logger.error(f"AI analysis failed for report {report_id}: {e}", exc_info=True)
        try:
            await db.reports.update_one(
                {"_id": ObjectId(report_id)},
                {"$set": {
                    "status": "AI Analysis Failed",
                    "processing_status": "Inference Failed",
                    "summary": f"AI analysis failed: {str(e)}",
                }}
            )
            await db.ai_analysis.update_one(
                {"report_id": report_id},
                {"$set": {
                    "report_id": report_id,
                    "patient_id": patient_id,
                    "type": report_type,
                    "modality": report_type,
                    "model_name": "Unavailable",
                    "model_type": "Unavailable",
                    "confidence": 0,
                    "findings": [],
                    "summary": f"AI inference could not be completed: {str(e)}",
                    "status": "AI Analysis Failed",
                    "error_message": str(e),
                    "processed_at": datetime.utcnow().isoformat(),
                    "created_at": datetime.utcnow(),
                }},
                upsert=True,
            )
        except Exception:
            pass


def serialize_report(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/upload")
async def upload_report(
    file: UploadFile = File(...),
    report_type: str = Form(...),
    title: str = Form(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a medical report file (PDF, JPG, PNG). Triggers AI analysis automatically."""
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")

    # Validate file type
    if file.content_type not in settings.ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not allowed. Use PDF, JPG, or PNG.",
        )

    # Validate file size
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    # Get patient profile
    patient = await db.patients.find_one({"user_id": current_user["id"]})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    patient_id = str(patient["_id"])

    # Save file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "file")[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as f:
        f.write(content)

    # Create report record
    report_doc = {
        "patient_id": patient_id,
        "type": report_type,
        "title": title,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "file_url": f"/uploads/{unique_name}",
        "file_name": file.filename or unique_name,
        "file_size": len(content),
        "processing_status": "Processing",
        "status": "AI Processing",
        "ai_confidence": None,
        "findings": [],
        "summary": None,
        "doctor_notes": None,
        "urgency": "Normal",
    }
    result = await db.reports.insert_one(report_doc)
    report_id = str(result.inserted_id)

    # Create timeline event
    await db.medical_history.insert_one(
        {
            "patient_id": patient_id,
            "date": report_doc["date"],
            "title": f"{report_type} Uploaded",
            "description": f"{title} was uploaded for analysis.",
            "type": "report",
            "linked_entity_id": report_id,
        }
    )

    # Event-driven notifications
    await db.notifications.insert_one({
        "target_role": "patient",
        "patient_id": patient_id,
        "report_id": report_id,
        "title": "Report Uploaded",
        "message": f"Your {report_type} report '{title}' was uploaded successfully and queued for AI analysis.",
        "time": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
        "type": "info",
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    })
    async for d in db.doctors.find({"assigned_patients": patient_id}):
        await db.notifications.insert_one({
            "target_role": "doctor",
            "doctor_id": str(d["_id"]),
            "patient_id": patient_id,
            "report_id": report_id,
            "title": "New Report Uploaded",
            "message": f"{patient.get('name', 'Patient')} uploaded a new {report_type} report: '{title}'.",
            "time": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
            "type": "info",
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        })

    # Trigger AI analysis in background
    abs_file_path = os.path.abspath(file_path)
    asyncio.create_task(
        _run_ai_analysis(report_id, patient_id, report_type, abs_file_path, file.content_type or "")
    )

    return serialize_report(report_doc)


@router.get("")
async def list_reports(
    current_user: dict = Depends(get_current_user),
):
    """List reports. Patient sees own; doctor sees assigned patients' reports."""
    if current_user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient:
            return []
        patient_id = str(patient["_id"])
        cursor = db.reports.find({"patient_id": patient_id}).sort("date", -1)
    else:
        # Doctor: get all reports strictly for assigned patients
        from routes.patients import get_or_create_doctor, get_doctor_assigned_patient_ids
        doctor = await get_or_create_doctor(current_user)
        if not doctor:
            return []
        assigned = await get_doctor_assigned_patient_ids(doctor, current_user)
        if not assigned:
            return []
        cursor = db.reports.find({"patient_id": {"$in": assigned}}).sort("date", -1)

    reports = []
    async for doc in cursor:
        reports.append(serialize_report(doc))
    return reports


@router.get("/{report_id}")
async def get_report(
    report_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single report by ID."""
    report = await db.reports.find_one({"_id": ObjectId(report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Access control
    if current_user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient or str(patient["_id"]) != report["patient_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user["role"] == "doctor":
        from routes.patients import get_or_create_doctor, get_doctor_assigned_patient_ids
        doctor = await get_or_create_doctor(current_user)
        if not doctor:
            raise HTTPException(status_code=403, detail="Access denied")
        assigned = await get_doctor_assigned_patient_ids(doctor, current_user)
        if report.get("patient_id") not in assigned:
            raise HTTPException(status_code=403, detail="Access denied")

    return serialize_report(report)


@router.put("/{report_id}")
async def update_report(
    report_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """Doctor: Update report status (e.g. mark as Reviewed), doctor notes, or flags."""
    if not ObjectId.is_valid(report_id):
        raise HTTPException(status_code=400, detail="Invalid report ID")

    report = await db.reports.find_one({"_id": ObjectId(report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    allowed_fields = {"status", "urgency", "notes", "doctor_notes", "reviewed_at"}
    updates = {k: v for k, v in payload.items() if k in allowed_fields}

    if "status" in updates and updates["status"] == "Reviewed":
        updates["reviewed_at"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
        updates["reviewed_by"] = current_user.get("name", "Doctor")

    if updates:
        await db.reports.update_one({"_id": ObjectId(report_id)}, {"$set": updates})

    updated_report = await db.reports.find_one({"_id": ObjectId(report_id)})
    return serialize_report(updated_report)

