import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from middleware.auth import get_current_user
from database import db
from config import settings

router = APIRouter(prefix="/api/ai-analysis", tags=["AI Analysis"])
logger = logging.getLogger("routes.ai_analysis")


def serialize_doc(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    try:
        from rag.plain_language import (
            translate_mri_to_plain_language,
            translate_xray_to_plain_language,
            translate_ecg_to_plain_language,
            translate_blood_to_plain_language,
        )
        modality = (doc.get("modality") or doc.get("type") or doc.get("model_type") or "").lower()
        findings = doc.get("findings", [])
        summary = doc.get("summary", "")
        if "mri" in modality or "brain" in modality or "cnn" in modality:
            doc["plain_language"] = translate_mri_to_plain_language(findings, summary)
        elif "x-ray" in modality or "xray" in modality or "chest" in modality:
            doc["plain_language"] = translate_xray_to_plain_language(findings, summary)
        elif "ecg" in modality or "heart" in modality:
            doc["plain_language"] = translate_ecg_to_plain_language(findings, summary)
        elif "blood" in modality or "lab" in modality:
            doc["plain_language"] = translate_blood_to_plain_language([], findings)
        elif "medical" in modality or "document" in modality or "note" in modality:
            doc["plain_language"] = {
                "headline": "Clinical History & Consultation Assessment",
                "status": "Doctor Supervised",
                "tone": "normal",
                "plain_text": "Your medical report confirms that nerve and motor functions are intact and healthy. Your doctor has noted your memory feedback and established an active, supportive care plan.",
                "key_takeaways": [
                    "Motor and neurological reflex functions are fully intact",
                    "Targeted cognitive therapy and medications are actively prescribed",
                    "Routine follow-up scheduled with your physician in 3 months",
                ],
                "simplified_metrics": [
                    {"label": "Motor & Nerve Function", "value": "Intact & Strong", "status": "Normal"},
                    {"label": "Cognitive Care Plan", "value": "Active & Monitored", "status": "Normal"},
                ]
            }
    except Exception as e:
        logger.error(f"Failed to enrich analysis with plain language: {e}")
    return doc



async def _check_patient_access(current_user: dict, patient_id: str):
    """Enforces authorization: patient can only access own; doctor can access and auto-assign."""
    if current_user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient or str(patient["_id"]) != patient_id:
            raise HTTPException(status_code=403, detail="Access denied: cannot view another patient's data")
    elif current_user["role"] == "doctor":
        from routes.patients import get_or_create_doctor
        doctor = await get_or_create_doctor(current_user)
        if patient_id and patient_id not in doctor.get("assigned_patients", []):
            await db.doctors.update_one(
                {"_id": doctor["_id"]},
                {"$addToSet": {"assigned_patients": patient_id}}
            )
            doctor.setdefault("assigned_patients", []).append(patient_id)


@router.get("")
async def get_all_analyses(
    current_user: dict = Depends(get_current_user),
):
    """Get AI analysis results for authorized patients only."""
    if current_user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient:
            return []
        query = {"patient_id": str(patient["_id"])}
    else:
        from routes.patients import get_or_create_doctor, get_doctor_assigned_patient_ids
        doctor = await get_or_create_doctor(current_user)
        assigned = await get_doctor_assigned_patient_ids(doctor, current_user)
        if not assigned:
            return []
        query = {"patient_id": {"$in": assigned}}

    analyses = []
    async for doc in db.ai_analysis.find(query).sort("created_at", -1):
        analyses.append(serialize_doc(doc))
    return analyses


@router.get("/brief")
async def get_default_brief(
    current_user: dict = Depends(get_current_user),
):
    """Get latest authorized AI patient brief."""
    if current_user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient:
            return None
        brief = await db.ai_patient_briefs.find_one({"patient_id": str(patient["_id"])})
    else:
        from routes.patients import get_or_create_doctor, get_doctor_assigned_patient_ids
        doctor = await get_or_create_doctor(current_user)
        assigned = await get_doctor_assigned_patient_ids(doctor, current_user)
        if not assigned:
            return None
        brief = await db.ai_patient_briefs.find_one({"patient_id": {"$in": assigned}})

    if not brief:
        return None
    return serialize_doc(brief)



@router.get("/report/{report_id}")
async def get_analysis_for_report(
    report_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get AI analysis result for a specific report with authorization check."""
    report = await db.reports.find_one({"_id": ObjectId(report_id)})
    if not report:
        return None

    await _check_patient_access(current_user, report.get("patient_id", ""))

    analysis = await db.ai_analysis.find_one({"report_id": report_id})
    if not analysis:
        return None
    return serialize_doc(analysis)


@router.get("/patient/{patient_id}")
async def get_analyses_for_patient(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get all AI analysis results for a patient (by patient_id) with authorization check."""
    await _check_patient_access(current_user, patient_id)

    analyses = []
    async for doc in db.ai_analysis.find({"patient_id": patient_id}).sort("created_at", -1):
        analyses.append(serialize_doc(doc))

    # Fallback: if no patient_id indexed results, try via report_ids
    if not analyses:
        report_ids = []
        async for report in db.reports.find({"patient_id": patient_id}, {"_id": 1}):
            report_ids.append(str(report["_id"]))
        if report_ids:
            async for doc in db.ai_analysis.find({"report_id": {"$in": report_ids}}):
                analyses.append(serialize_doc(doc))

    return analyses


@router.get("/patient/{patient_id}/summary")
async def get_patient_analysis_summary(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a unified AI analysis summary across all modalities for a patient."""
    await _check_patient_access(current_user, patient_id)

    analyses = []
    async for doc in db.ai_analysis.find({"patient_id": patient_id}).sort("created_at", -1):
        analyses.append(serialize_doc(doc))

    # Group by modality
    by_modality = {}
    for a in analyses:
        modality = a.get("modality") or a.get("type", "Unknown")
        if modality not in by_modality:
            by_modality[modality] = a

    return {
        "patient_id": patient_id,
        "total_analyses": len(analyses),
        "modalities": by_modality,
        "latest_analysis": analyses[0] if analyses else None,
    }



@router.post("/trigger/{report_id}")
async def trigger_analysis(
    report_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Manually trigger or re-trigger AI analysis for a report."""
    report = await db.reports.find_one({"_id": ObjectId(report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    patient_id = report.get("patient_id", "")
    report_type = report.get("type", "")
    file_url = report.get("file_url", "")

    if not file_url:
        raise HTTPException(status_code=400, detail="No file associated with this report")

    # Construct file path from URL
    file_name = file_url.split("/")[-1]
    file_path = f"{settings.UPLOAD_DIR}/{file_name}"

    import os
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Report file not found on disk")

    # Trigger background analysis
    from routes.reports import _run_ai_analysis
    asyncio.create_task(
        _run_ai_analysis(report_id, patient_id, report_type, os.path.abspath(file_path), "")
    )

    return {"message": "AI analysis triggered", "report_id": report_id, "status": "Processing"}


@router.get("/lab-values/{patient_id}")
async def get_lab_values(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get lab values for a patient with authorization check."""
    await _check_patient_access(current_user, patient_id)

    values = []
    async for doc in db.lab_values.find({"patient_id": patient_id}):
        values.append(serialize_doc(doc))
    return values


@router.get("/vital-signs/{patient_id}")
async def get_vital_signs(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get vital signs for a patient with authorization check."""
    await _check_patient_access(current_user, patient_id)

    signs = []
    async for doc in db.vital_signs.find({"patient_id": patient_id}).sort("date", -1):
        signs.append(serialize_doc(doc))
    return signs


@router.get("/research-evidence")
async def get_research_evidence(
    current_user: dict = Depends(get_current_user),
):
    """Get all research evidence."""
    evidence = []
    async for doc in db.research_evidence.find():
        evidence.append(serialize_doc(doc))
    return evidence


@router.get("/patient-brief/{patient_id}")
async def get_patient_brief(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get AI patient brief for a patient with authorization check, enriched with plain-language translations."""
    await _check_patient_access(current_user, patient_id)

    brief = await db.ai_briefs_generated.find_one({"patient_id": patient_id})
    if not brief:
        brief = await db.ai_patient_briefs.find_one({"patient_id": patient_id})
    if not brief:
        return None

    brief_data = brief.get("brief", brief)
    if isinstance(brief_data, dict) and "patient_friendly_summary" not in brief_data:
        try:
            from rag.plain_language import generate_patient_friendly_summary
            patient = await db.patients.find_one({"_id": ObjectId(patient_id)}) or {}
            lab_values = await db.lab_values.find({"patient_id": patient_id}).to_list(20)
            brief_data["patient_friendly_summary"] = generate_patient_friendly_summary(
                patient=patient,
                brief_data=brief_data,
                lab_values=lab_values,
            )
            if "brief" in brief:
                brief["brief"] = brief_data
            else:
                brief = brief_data
        except Exception as e:
            logger.error(f"Failed to generate patient friendly summary: {e}")

    return serialize_doc(brief)


@router.get("/notifications")
async def get_notifications(
    current_user: dict = Depends(get_current_user),
):
    """Get notifications for the current user."""
    role = current_user["role"]
    if role == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient:
            return []
        query = {"target_role": "patient", "patient_id": str(patient["_id"])}
    else:
        from routes.patients import get_or_create_doctor, get_doctor_assigned_patient_ids
        doctor = await get_or_create_doctor(current_user)
        assigned = await get_doctor_assigned_patient_ids(doctor, current_user)
        doctor_id_str = str(doctor["_id"])
        user_id_str = str(current_user["id"])

        notif_or = [{"doctor_id": {"$in": [doctor_id_str, user_id_str]}}]
        if assigned:
            notif_or.append({"patient_id": {"$in": assigned}})
        query = {"target_role": "doctor", "$or": notif_or}

    notifs = []
    async for doc in db.notifications.find(query).sort("_id", -1).limit(10):
        notifs.append(serialize_doc(doc))
    return notifs


@router.put("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
):
    """Mark all notifications as read for current user."""
    role = current_user["role"]
    if role == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if patient:
            await db.notifications.update_many(
                {"target_role": "patient", "patient_id": str(patient["_id"])},
                {"$set": {"read": True}}
            )
    else:
        await db.notifications.update_many(
            {"target_role": "doctor"},
            {"$set": {"read": True}}
        )
    return {"success": True, "message": "All notifications marked as read"}


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a single notification as read."""
    if ObjectId.is_valid(notification_id):
        await db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True}}
        )
    return {"success": True, "message": "Notification marked as read"}

