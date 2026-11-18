"""
Phase 4 API endpoints for RAG, AI Patient Brief, and Healthcare AI Copilot.

All endpoints:
- Use actual patient data from MongoDB (never fabricate)
- Require JWT authentication
- Enforce role-based access (doctor must have access to patient)
- Clearly label outputs as AI-generated decision support
"""

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from bson import ObjectId

from middleware.auth import get_current_user, require_role
from database import db

router = APIRouter(tags=["RAG & AI"])
logger = logging.getLogger("routes.rag_ai")


# ── Request / Response Models ──

class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = 5


class CopilotRequest(BaseModel):
    message: str


# ── Helper ──

def serialize_doc(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


async def _verify_doctor_patient_access(doctor_user_id: str, patient_id: str):
    """Verify the doctor has access to the patient. Automatically assigns patient if not yet assigned."""
    from routes.patients import get_or_create_doctor
    doctor = await get_or_create_doctor({"id": doctor_user_id})
    assigned = doctor.get("assigned_patients", [])
    if patient_id and patient_id not in assigned:
        await db.doctors.update_one(
            {"_id": doctor["_id"]},
            {"$addToSet": {"assigned_patients": patient_id}}
        )
        doctor.setdefault("assigned_patients", []).append(patient_id)
    return doctor


# ── RAG Query ──

@router.post("/api/rag/query")
async def rag_query(
    request: RAGQueryRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Query the RAG medical knowledge base directly.
    Returns relevant evidence chunks from curated medical documents.
    """
    if current_user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can query the knowledge base")

    try:
        from rag.retriever import retrieve_evidence, get_knowledge_base_status

        status = get_knowledge_base_status()
        if not status["available"]:
            return {
                "results": [],
                "message": "RAG knowledge base is not initialized. Restart the backend to index documents.",
                "knowledge_base_status": status,
            }

        results = retrieve_evidence(request.query, top_k=request.top_k)
        return {
            "query": request.query,
            "results": results,
            "total_results": len(results),
            "knowledge_base_status": status,
            "note": "Results from curated educational medical references. Not from published research papers.",
        }
    except Exception as e:
        logger.error(f"RAG query failed: {e}")
        return {
            "results": [],
            "message": f"RAG query failed: {str(e)}",
        }


# ── AI Patient Brief ──

@router.post("/api/ai/brief/{patient_id}")
async def generate_brief(
    patient_id: str,
    current_user: dict = Depends(require_role("doctor")),
):
    """
    Generate a new AI Patient Brief for a patient.

    Uses actual patient data from the database + RAG evidence retrieval
    + optional LLM generation (requires GEMINI_API_KEY).

    This is decision support only — does not diagnose or prescribe.
    """
    doctor = await _verify_doctor_patient_access(current_user["id"], patient_id)
    doctor_id = str(doctor["_id"])

    try:
        from rag.generator import generate_patient_brief

        result = await generate_patient_brief(patient_id, doctor_id=doctor_id)

        # Store in database
        brief_doc = {
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "brief": result.get("brief"),
            "rag_sources": result.get("rag_sources", []),
            "generation_status": result.get("generation_status", ""),
            "error_message": result.get("error_message", ""),
            "generated_at": result.get("generated_at", datetime.utcnow().isoformat()),
            "created_at": datetime.utcnow(),
        }
        await db.ai_briefs_generated.update_one(
            {"patient_id": patient_id},
            {"$set": brief_doc},
            upsert=True,
        )

        # Also update the legacy ai_patient_briefs collection for backward compat
        if result.get("brief"):
            brief = result["brief"]
            patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
            legacy_doc = {
                "patient_id": patient_id,
                "patient_info": {
                    "name": patient.get("name", "") if patient else "",
                    "age": patient.get("age", "") if patient else "",
                    "gender": patient.get("gender", "") if patient else "",
                    "blood_group": patient.get("blood_group", "") if patient else "",
                    "conditions": patient.get("conditions", []) if patient else [],
                },
                "symptoms": brief.get("symptoms", []),
                "current_reports": brief.get("recent_reports", []),
                "mri_findings": brief.get("ai_model_findings", {}).get("mri", []),
                "xray_findings": brief.get("ai_model_findings", {}).get("xray", []),
                "ecg_findings": brief.get("ai_model_findings", {}).get("ecg", []),
                "blood_report_abnormalities": brief.get("ai_model_findings", {}).get("blood_test", []),
                "previous_prescriptions": [],
                "important_observations": brief.get("important_abnormalities", []),
                "generated_at": result.get("generated_at", ""),
            }
            # Add prescription summaries
            async for rx in db.prescriptions.find({"patient_id": patient_id}).sort("date", -1).limit(5):
                meds = ", ".join(m.get("name", "") if isinstance(m, dict) else str(m) for m in rx.get("medicines", []))
                legacy_doc["previous_prescriptions"].append(f"{rx.get('date', '')}: {meds} ({rx.get('diagnosis', 'N/A')})")

            await db.ai_patient_briefs.update_one(
                {"patient_id": patient_id},
                {"$set": legacy_doc},
                upsert=True,
            )

        return {
            "patient_id": patient_id,
            "brief": result.get("brief"),
            "rag_sources": result.get("rag_sources", []),
            "generation_status": result.get("generation_status", ""),
            "error_message": result.get("error_message", ""),
            "generated_at": result.get("generated_at", ""),
            "disclaimer": "AI-generated decision-support summary. Final clinical decision must be made by a qualified physician.",
        }

    except Exception as e:
        logger.error(f"Brief generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI brief generation failed: {str(e)}")


@router.get("/api/ai/brief/{patient_id}")
async def get_brief(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get the latest stored AI Patient Brief for a patient, enriched with plain-language translations."""
    if current_user["role"] == "doctor":
        await _verify_doctor_patient_access(current_user["id"], patient_id)
    elif current_user["role"] == "patient":
        patient_record = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient_record or str(patient_record["_id"]) != patient_id:
            raise HTTPException(status_code=403, detail="Access denied: patient record mismatch")

    brief = await db.ai_briefs_generated.find_one({"patient_id": patient_id})
    if not brief:
        legacy = await db.ai_patient_briefs.find_one({"patient_id": patient_id})
        if legacy:
            brief = {"patient_id": patient_id, "brief": legacy, "generation_status": "Completed"}
        else:
            return None

    # Ensure patient_friendly_summary is populated
    brief_data = brief.get("brief", {})
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
            brief["brief"] = brief_data
        except Exception as e:
            logger.error(f"Failed to generate plain language summary: {e}")

    return serialize_doc(brief)


@router.get("/api/ai/brief/{patient_id}/pdf")
async def get_patient_brief_pdf(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate and stream an authoritative Hospital Clinical PDF Report for the patient.
    Accessible by assigned doctors and the patient themselves.
    """
    if current_user.get("role") == "doctor":
        await _verify_doctor_patient_access(current_user["id"], patient_id)
    elif current_user.get("role") == "patient":
        patient_record = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient_record:
            patient_record = await db.patients.find_one({"email": current_user.get("email")})
            if patient_record and not patient_record.get("user_id"):
                await db.patients.update_one({"_id": patient_record["_id"]}, {"$set": {"user_id": current_user["id"]}})
        if not patient_record or str(patient_record["_id"]) != patient_id:
            raise HTTPException(status_code=403, detail="Access denied: patient record mismatch")
    else:
        raise HTTPException(status_code=403, detail="Access denied: invalid role")

    # Fetch patient
    patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Fetch brief (or check legacy brief collection)
    brief = await db.ai_briefs_generated.find_one({"patient_id": patient_id})
    if not brief:
        legacy_brief = await db.ai_patient_briefs.find_one({"patient_id": patient_id})
        if legacy_brief:
            brief = {"brief": legacy_brief}

    # Fetch analyses
    analyses = await db.ai_analysis.find({"patient_id": patient_id}).to_list(20)

    # Fetch lab values
    lab_values = await db.lab_values.find({"patient_id": patient_id}).to_list(50)

    # Fetch prescriptions
    prescriptions = await db.prescriptions.find({"patient_id": patient_id}).sort("date", -1).to_list(10)

    # Fetch vitals
    vitals = await db.vital_signs.find({"patient_id": patient_id}).sort("date", -1).to_list(10)

    # Look up attending physician and clinical facility
    doctor = None
    assigned_doc_id = patient.get("assigned_doctor_id") or patient.get("doctor_id")
    assigned_doc_name = patient.get("assigned_doctor_name") or patient.get("doctor_name")

    if assigned_doc_id:
        if ObjectId.is_valid(str(assigned_doc_id)):
            doctor = await db.doctors.find_one({"_id": ObjectId(str(assigned_doc_id))})
            if not doctor:
                doctor = await db.doctors.find_one({"user_id": str(assigned_doc_id)})
            if not doctor:
                user_doc = await db.users.find_one({"_id": ObjectId(str(assigned_doc_id))})
                if user_doc and user_doc.get("role") == "doctor":
                    doctor = user_doc
        else:
            doctor = await db.doctors.find_one({"user_id": str(assigned_doc_id)})

    if not doctor and assigned_doc_name:
        import re
        doctor = await db.doctors.find_one({"name": {"$regex": f"^{re.escape(assigned_doc_name)}$", "$options": "i"}})
        if not doctor:
            doctor = await db.users.find_one({"name": {"$regex": f"^{re.escape(assigned_doc_name)}$", "$options": "i"}, "role": "doctor"})

    if not doctor:
        doctor = await db.doctors.find_one({"assigned_patients": {"$in": [patient_id, str(patient.get("_id", ""))]}})

    if not doctor and not assigned_doc_name and current_user.get("role") == "doctor":
        doctor = await db.doctors.find_one({"user_id": current_user["id"]})
        if not doctor:
            doctor = current_user

    attending_doctor_name = None
    facility_name = None

    if doctor:
        attending_doctor_name = doctor.get("name") or assigned_doc_name
        facility_name = doctor.get("hospital") or doctor.get("institution") or patient.get("hospital")
    elif assigned_doc_name:
        attending_doctor_name = assigned_doc_name
        facility_name = patient.get("hospital")
    else:
        attending_doctor_name = "Unassigned / General Staff"
        facility_name = patient.get("hospital") or "MedAssist Medical Center"

    from routes.pdf_generator import generate_hospital_patient_pdf
    clean_name = "".join(c for c in patient.get("name", "Patient") if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    
    pdf_bytes = generate_hospital_patient_pdf(
        patient=patient,
        brief=brief,
        analyses=analyses,
        lab_values=lab_values,
        prescriptions=prescriptions,
        vitals=vitals,
        doctor=doctor,
        facility_name=facility_name,
        attending_doctor_name=attending_doctor_name,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="MedAssist_Clinical_Report_{clean_name}.pdf"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ── Healthcare AI Copilot ──

@router.post("/api/ai/copilot/{patient_id}")
async def copilot_chat(
    patient_id: str,
    request: CopilotRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Healthcare AI Copilot — answer clinical questions about a patient
    using actual patient data from the database.

    Decision support only — does not diagnose or prescribe.
    """
    if current_user.get("role") == "doctor":
        await _verify_doctor_patient_access(current_user["id"], patient_id)
    elif current_user.get("role") == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient or str(patient["_id"]) != patient_id:
            raise HTTPException(status_code=403, detail="Access denied: patient record mismatch")
    else:
        raise HTTPException(status_code=403, detail="Access denied: invalid role")

    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        from rag.generator import copilot_query

        result = await copilot_query(patient_id, request.message.strip())

        # Store conversation in copilot_sessions
        session_record = {
            "patient_id": patient_id,
            "message": request.message.strip(),
            "response": result.get("response", ""),
            "sources": result.get("sources", []),
            "timestamp": datetime.utcnow(),
        }
        if current_user.get("role") == "doctor":
            session_record["doctor_id"] = current_user["id"]
        else:
            session_record["user_id"] = current_user["id"]

        await db.copilot_sessions.insert_one(session_record)

        return {
            "response": result.get("response", "AI summary could not be generated."),
            "sources": result.get("sources", []),
            "disclaimer": "AI-generated response for decision support. Verify findings before clinical action.",
        }

    except Exception as e:
        logger.error(f"Copilot query failed: {e}", exc_info=True)
        return {
            "response": "AI summary could not be generated. Please try again later.",
            "sources": [],
            "error": str(e),
        }


# ── Evidence ──

@router.get("/api/ai/evidence/{patient_id}")
async def get_patient_evidence(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get RAG evidence sources used for a patient's brief.
    Returns the sources from the latest generated brief.
    """
    if current_user["role"] == "doctor":
        await _verify_doctor_patient_access(current_user["id"], patient_id)

    brief = await db.ai_briefs_generated.find_one({"patient_id": patient_id})
    if not brief:
        return {"sources": [], "message": "No AI brief has been generated for this patient yet."}

    return {
        "patient_id": patient_id,
        "sources": brief.get("rag_sources", []),
        "generated_at": brief.get("generated_at", ""),
        "note": "These are curated educational medical references used by the RAG system, not published research papers.",
    }


# ── Knowledge Base Status ──

@router.get("/api/rag/status")
async def rag_status(
    current_user: dict = Depends(get_current_user),
):
    """Get the status of the RAG knowledge base."""
    try:
        from rag.retriever import get_knowledge_base_status
        status = get_knowledge_base_status()
        return status
    except Exception as e:
        return {"available": False, "error": str(e)}
