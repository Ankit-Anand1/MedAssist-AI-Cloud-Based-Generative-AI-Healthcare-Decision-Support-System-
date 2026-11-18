"""
Doctor Dashboard API — computes real statistics from MongoDB.

Every value returned comes from actual database aggregation.
No hardcoded counts, no demo data.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from bson import ObjectId
from middleware.auth import require_role
from database import db

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def serialize_doc(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/doctor")
async def doctor_dashboard(current_user: dict = Depends(require_role("doctor"))):
    """
    Compute a real clinical overview strictly isolated to the authenticated doctor.
    All values derived from actual MongoDB records for this doctor and their assigned patients.
    """
    from routes.patients import get_or_create_doctor, get_doctor_assigned_patient_ids
    doctor = await get_or_create_doctor(current_user)
    if not doctor:
        return {
            "patient_stats": {"total": 0, "with_recent_reports": 0, "requiring_review": 0, "with_ai_analysis": 0},
            "report_stats": {"total": 0, "processing": 0, "completed": 0, "failed": 0, "pending_review": 0},
            "ai_stats": {"mri": 0, "xray": 0, "ecg": 0, "blood": 0, "briefs_generated": 0, "copilot_sessions": 0},
            "upcoming_appointments": [],
            "recent_activity": [],
            "active_alerts": [],
        }

    assigned_ids = await get_doctor_assigned_patient_ids(doctor, current_user)
    doctor_id_str = str(doctor["_id"])
    user_id_str = str(current_user["id"])
    doctor_name = doctor.get("name", current_user.get("name", ""))

    # ── Patient Statistics ──
    total_patients = len(assigned_ids)

    # ── Upcoming Appointments (strictly for this doctor) ──
    or_conditions = [
        {"doctor_id": {"$in": [doctor_id_str, user_id_str]}},
    ]
    if doctor_name and doctor_name.lower() not in ("doctor", "dr. doctor", ""):
        import re
        or_conditions.append({"doctor_name": {"$regex": f"^{re.escape(doctor_name)}$", "$options": "i"}})

    status_filter = {"status": {"$in": ["Scheduled", "scheduled", "In Progress", "in progress"]}}

    upcoming = []
    async for apt in db.appointments.find({"$and": [{"$or": or_conditions}, status_filter]}).sort("date", 1).limit(10):
        apt_dict = serialize_doc(apt)
        if not apt_dict.get("patient_name") and apt_dict.get("patient_id"):
            if ObjectId.is_valid(apt_dict["patient_id"]):
                pt = await db.patients.find_one({"_id": ObjectId(apt_dict["patient_id"])})
                if pt:
                    apt_dict["patient_name"] = pt.get("name", "Patient")
        upcoming.append(apt_dict)

    copilot_count = await db.copilot_sessions.count_documents({"doctor_id": {"$in": [doctor_id_str, user_id_str]}})

    # If no patients are assigned to this doctor, return completely empty metrics
    if not assigned_ids:
        # Active alerts strictly for this doctor
        active_alerts = []
        alert_query = {
            "target_role": "doctor",
            "doctor_id": {"$in": [doctor_id_str, user_id_str]},
        }
        async for notif in db.notifications.find(alert_query).sort("_id", -1).limit(8):
            active_alerts.append(serialize_doc(notif))

        return {
            "patient_stats": {
                "total": 0,
                "with_recent_reports": 0,
                "requiring_review": 0,
                "with_ai_analysis": 0,
            },
            "report_stats": {"total": 0, "processing": 0, "completed": 0, "failed": 0, "pending_review": 0},
            "ai_stats": {
                "mri": 0,
                "xray": 0,
                "ecg": 0,
                "blood": 0,
                "briefs_generated": 0,
                "copilot_sessions": copilot_count,
            },
            "upcoming_appointments": upcoming,
            "recent_activity": [],
            "active_alerts": active_alerts,
        }

    # Patients with reports uploaded in last 30 days
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    patients_with_recent = set()
    patients_with_ai = set()
    patients_needing_review = set()

    # ── Report Statistics ──
    report_counts = {"total": 0, "processing": 0, "completed": 0, "failed": 0, "pending_review": 0}
    async for report in db.reports.find({"patient_id": {"$in": assigned_ids}}):
        report_counts["total"] += 1
        status = report.get("status", "")
        pid = report.get("patient_id", "")

        if status == "AI Processing":
            report_counts["processing"] += 1
        elif status == "AI Analyzed":
            report_counts["completed"] += 1
            patients_needing_review.add(pid)
        elif status == "AI Analysis Failed":
            report_counts["failed"] += 1
        elif status in ("Pending", "Flagged"):
            report_counts["pending_review"] += 1
            patients_needing_review.add(pid)

        # Check if recent
        report_date = report.get("date", "")
        if report_date >= thirty_days_ago:
            patients_with_recent.add(pid)

    # ── AI Statistics ──
    ai_counts = {"mri": 0, "xray": 0, "ecg": 0, "blood": 0, "medical": 0}
    async for analysis in db.ai_analysis.find({"patient_id": {"$in": assigned_ids}}):
        modality = (analysis.get("modality") or analysis.get("type", "")).lower()
        pid = analysis.get("patient_id", "")
        patients_with_ai.add(pid)

        if "mri" in modality:
            ai_counts["mri"] += 1
        elif "x-ray" in modality or "xray" in modality:
            ai_counts["xray"] += 1
        elif "ecg" in modality:
            ai_counts["ecg"] += 1
        elif "blood" in modality:
            ai_counts["blood"] += 1
        else:
            ai_counts["medical"] += 1

    briefs_count = await db.ai_briefs_generated.count_documents({"patient_id": {"$in": assigned_ids}})

    # ── Recent Activity (last 10 timeline events across assigned patients) ──
    recent_activity = []
    async for event in db.medical_history.find(
        {"patient_id": {"$in": assigned_ids}}
    ).sort("date", -1).limit(10):
        patient = await db.patients.find_one({"_id": ObjectId(event["patient_id"])}) if ObjectId.is_valid(event.get("patient_id", "")) else None
        entry = serialize_doc(event)
        entry["patient_name"] = patient.get("name", "Patient") if patient else "Patient"
        recent_activity.append(entry)

    # ── Active Alerts ──
    active_alerts = []
    alert_query = {
        "target_role": "doctor",
        "$or": [
            {"doctor_id": {"$in": [doctor_id_str, user_id_str]}},
            {"patient_id": {"$in": list(assigned_ids)}},
        ]
    }
    async for notif in db.notifications.find(alert_query).sort("_id", -1).limit(8):
        active_alerts.append(serialize_doc(notif))

    return {
        "patient_stats": {
            "total": total_patients,
            "with_recent_reports": len(patients_with_recent),
            "requiring_review": len(patients_needing_review),
            "with_ai_analysis": len(patients_with_ai),
        },
        "report_stats": report_counts,
        "ai_stats": {
            "mri": ai_counts["mri"],
            "xray": ai_counts["xray"],
            "ecg": ai_counts["ecg"],
            "blood": ai_counts["blood"],
            "briefs_generated": briefs_count,
            "copilot_sessions": copilot_count,
        },
        "upcoming_appointments": upcoming,
        "recent_activity": recent_activity,
        "active_alerts": active_alerts,
    }
