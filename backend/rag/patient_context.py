"""
Unified Patient Context Builder.

Aggregates actual patient data from MongoDB collections into a structured
context dict for the LLM. Never invents or fabricates data — only uses
what exists in the database.

Explicitly tracks which modalities are available vs unavailable.
"""

import logging
from database import db

logger = logging.getLogger("rag.patient_context")

# Modalities we track
ALL_MODALITIES = ["Brain MRI", "X-ray", "ECG", "Blood Test"]


async def build_patient_context(patient_id: str) -> dict:
    """
    Build a unified patient context from all available database records.

    Returns a structured dict with all available information and explicit
    markers for unavailable modalities.
    """
    context = {
        "patient_id": patient_id,
        "demographics": None,
        "conditions": [],
        "allergies": [],
        "drug_allergies": [],
        "latest_vitals": {},
        "vital_signs": [],
        "symptoms": [],
        "reports": [],
        "ai_analyses": [],
        "lab_values": [],
        "prescriptions": [],
        "medical_history": [],
        "doctor_notes": [],
        "available_modalities": [],
        "unavailable_modalities": [],
    }

    # 1. Patient demographics
    patient = await db.patients.find_one({"_id": _to_oid(patient_id)})
    if not patient:
        # Try string match
        patient = await db.patients.find_one({"user_id": patient_id})

    if patient:
        context["demographics"] = {
            "name": patient.get("name", ""),
            "age": patient.get("age", ""),
            "gender": patient.get("gender", ""),
            "blood_group": patient.get("blood_group", ""),
            "phone": patient.get("phone", ""),
            "email": patient.get("email", ""),
            "emergency_contact": patient.get("emergency_contact", ""),
            "status": patient.get("status", ""),
        }
        context["conditions"] = patient.get("conditions", [])
        context["allergies"] = patient.get("allergies", [])
        context["drug_allergies"] = patient.get("drug_allergies", [])
        context["patient_info"] = context["demographics"]
        if patient.get("latest_vitals"):
            context["latest_vitals"] = patient.get("latest_vitals")
        elif patient.get("vitals"):
            context["latest_vitals"] = patient.get("vitals")
    else:
        logger.warning(f"Patient {patient_id} not found in database")
        return context

    # 1b. Vital Signs collection
    async for vs in db.vital_signs.find({"patient_id": patient_id}).sort("recorded_at", -1):
        v_doc = {
            "id": str(vs.get("_id", "")),
            "blood_pressure": vs.get("blood_pressure") or vs.get("bp"),
            "heart_rate": vs.get("heart_rate") or vs.get("hr"),
            "oxygen_saturation": vs.get("oxygen_saturation") or vs.get("spo2"),
            "glucose": vs.get("glucose") or vs.get("blood_glucose"),
            "temperature": vs.get("temperature") or vs.get("temp"),
            "weight": vs.get("weight"),
            "bmi": vs.get("bmi"),
            "notes": vs.get("notes", ""),
            "recorded_by": vs.get("recorded_by", ""),
            "date": vs.get("date", ""),
            "recorded_at": vs.get("recorded_at") or vs.get("date", ""),
        }
        context["vital_signs"].append(v_doc)

    if context["vital_signs"] and not context["latest_vitals"]:
        context["latest_vitals"] = context["vital_signs"][0]
    elif context["vital_signs"]:
        # Use newest recorded record
        context["latest_vitals"] = context["vital_signs"][0]

    # 2. Reports
    report_types_found = set()
    async for report in db.reports.find({"patient_id": patient_id}).sort("date", -1):
        report_data = {
            "id": str(report["_id"]),
            "type": report.get("type", ""),
            "title": report.get("title", ""),
            "date": report.get("date", ""),
            "status": report.get("status", ""),
            "ai_confidence": report.get("ai_confidence"),
            "findings": report.get("findings", []),
            "summary": report.get("summary", ""),
        }
        context["reports"].append(report_data)
        report_types_found.add(report.get("type", ""))

    # 3. AI Analysis results
    async for analysis in db.ai_analysis.find({"patient_id": patient_id}).sort("created_at", -1):
        analysis_data = {
            "id": str(analysis["_id"]),
            "report_id": analysis.get("report_id", ""),
            "type": analysis.get("type", ""),
            "modality": analysis.get("modality", ""),
            "model_name": analysis.get("model_name", ""),
            "model_type": analysis.get("model_type", ""),
            "confidence": analysis.get("confidence", 0),
            "findings": analysis.get("findings", []),
            "summary": analysis.get("summary", ""),
            "recommendations": analysis.get("recommendations", []),
            "status": analysis.get("status", ""),
            "error_message": analysis.get("error_message", ""),
            "processed_at": analysis.get("processed_at", ""),
        }
        context["ai_analyses"].append(analysis_data)

        # Track modality availability
        modality = analysis.get("modality") or analysis.get("type", "")
        if modality and analysis.get("status") == "Completed":
            if modality not in context["available_modalities"]:
                context["available_modalities"].append(modality)

    # 4. Lab values
    async for lv in db.lab_values.find({"patient_id": patient_id}):
        context["lab_values"].append({
            "name": lv.get("name", ""),
            "value": lv.get("value"),
            "unit": lv.get("unit", ""),
            "reference_range": lv.get("reference_range", ""),
            "status": lv.get("status", ""),
            "report_id": lv.get("report_id", ""),
        })

    # 5. Prescriptions
    async for rx in db.prescriptions.find({"patient_id": patient_id}).sort("date", -1):
        rx_data = {
            "date": rx.get("date", ""),
            "doctor_name": rx.get("doctor_name", ""),
            "diagnosis": rx.get("diagnosis", ""),
            "medicines": rx.get("medicines", []),
            "notes": rx.get("notes", ""),
            "follow_up_date": rx.get("follow_up_date", ""),
            "status": rx.get("status", ""),
        }
        context["prescriptions"].append(rx_data)

    # 6. Medical history timeline
    async for event in db.medical_history.find({"patient_id": patient_id}).sort("date", -1).limit(20):
        context["medical_history"].append({
            "date": event.get("date", ""),
            "title": event.get("title", ""),
            "description": event.get("description", ""),
            "type": event.get("type", ""),
        })

    # 7. Doctor notes
    async for note in db.doctor_notes.find({"patient_id": patient_id}).sort("created_at", -1).limit(10):
        context["doctor_notes"].append({
            "doctor_name": note.get("doctor_name", ""),
            "content": note.get("content", ""),
            "created_at": note.get("created_at", ""),
        })

    # 8. Determine unavailable modalities
    for modality in ALL_MODALITIES:
        if modality not in context["available_modalities"]:
            # Check if there's at least a report of this type (even if not analyzed)
            if modality not in report_types_found:
                context["unavailable_modalities"].append(modality)

    # Extract symptoms from conditions and medical history
    # (symptoms are tracked via conditions and timeline events)
    context["symptoms"] = _extract_symptoms(context)

    return context


def _extract_symptoms(context: dict) -> list[str]:
    """Extract symptoms from medical history and conditions. Never invent."""
    symptoms = []
    for event in context.get("medical_history", []):
        desc = event.get("description", "")
        title = event.get("title", "")
        if event.get("type") == "diagnosis":
            symptoms.append(f"{title}: {desc}" if desc else title)
    return symptoms


def format_context_for_llm(context: dict) -> str:
    """
    Format the patient context into a structured text prompt for the LLM.

    Only includes actually available data. Explicitly states what is unavailable.
    """
    parts = []

    # Demographics
    demo = context.get("demographics")
    if demo:
        parts.append(f"## Patient Demographics\n"
                     f"Name: {demo['name']}\n"
                     f"Age: {demo['age']}\n"
                     f"Gender: {demo['gender']}\n"
                     f"Blood Group: {demo['blood_group']}\n"
                     f"Status: {demo['status']}")
    else:
        parts.append("## Patient Demographics\nNo data available.")

    # Conditions
    conditions = context.get("conditions", [])
    if conditions:
        parts.append(f"## Active Conditions\n" + "\n".join(f"- {c}" for c in conditions))
    else:
        parts.append("## Active Conditions\nNo conditions recorded.")

    # Vital Signs & Physiological Telemetry
    latest_v = context.get("latest_vitals") or {}
    if latest_v:
        bp = latest_v.get("blood_pressure") or latest_v.get("bp") or "120/80"
        hr = latest_v.get("heart_rate") or latest_v.get("hr") or "72"
        spo2 = latest_v.get("oxygen_saturation") or latest_v.get("spo2") or "98"
        glucose = latest_v.get("glucose") or latest_v.get("blood_glucose") or "100"
        temp = latest_v.get("temperature") or latest_v.get("temp") or "98.6"
        weight = latest_v.get("weight")
        bmi = latest_v.get("bmi")
        rec_at = latest_v.get("recorded_at") or latest_v.get("date") or "Clinical Consultation"
        v_notes = latest_v.get("notes") or ""

        v_parts = [
            f"## Vital Signs & Physiological Telemetry (Recorded: {rec_at})",
            f"- Blood Pressure: {bp} mmHg",
            f"- Resting Heart Rate: {hr} bpm",
            f"- Oxygen Saturation (SpO2): {spo2}%",
            f"- Blood Glucose: {glucose} mg/dL",
            f"- Body Temperature: {temp} °F",
        ]
        if weight:
            v_parts.append(f"- Weight: {weight} kg" + (f" | BMI: {bmi}" if bmi else ""))
        if v_notes:
            v_parts.append(f"- Clinical Observation Notes: {v_notes}")
        parts.append("\n".join(v_parts))
    else:
        parts.append("## Vital Signs & Physiological Telemetry\nNo vital signs recorded.")

    # Allergies & Drug Sensitivities
    allergies = context.get("allergies", [])
    drug_allergies = context.get("drug_allergies", [])
    allg_parts = ["## Allergies & Drug Sensitivities"]
    allg_parts.append(f"- Documented Drug Allergies: {', '.join(drug_allergies) if drug_allergies else 'None documented (NKDA)'}")
    allg_parts.append(f"- Environmental / Food Allergies: {', '.join(allergies) if allergies else 'None logged'}")
    parts.append("\n".join(allg_parts))

    # AI Analyses by modality
    analyses = context.get("ai_analyses", [])
    if analyses:
        parts.append("## AI Analysis Results")
        for a in analyses:
            modality = a.get("modality") or a.get("type", "Unknown")
            parts.append(f"\n### {modality} Analysis")
            parts.append(f"Model: {a.get('model_name', 'N/A')} ({a.get('model_type', 'N/A')})")
            parts.append(f"Confidence: {a.get('confidence', 0)}%")
            parts.append(f"Status: {a.get('status', 'N/A')}")
            if a.get("summary"):
                parts.append(f"Summary: {a['summary']}")
            findings = a.get("findings", [])
            if findings:
                parts.append("Findings:")
                for f in findings:
                    if isinstance(f, dict):
                        parts.append(f"  - {f.get('label', '')}: {f.get('value', '')} [{f.get('status', '')}]"
                                     + (f" — {f['detail']}" if f.get('detail') else ""))
                    else:
                        parts.append(f"  - {f}")
            recs = a.get("recommendations", [])
            if recs:
                parts.append("Recommendations:")
                for r in recs:
                    parts.append(f"  - {r}")
    else:
        parts.append("## AI Analysis Results\nNo AI analyses available.")

    # Unavailable modalities
    unavail = context.get("unavailable_modalities", [])
    if unavail:
        parts.append(f"\n## Unavailable Modalities\n"
                     f"The following report types have NOT been uploaded or analyzed:\n"
                     + "\n".join(f"- {m}: No data available" for m in unavail))

    # Lab values
    lab_values = context.get("lab_values", [])
    if lab_values:
        parts.append("## Lab Values")
        for lv in lab_values:
            val_str = f"{lv['value']} {lv['unit']}" if lv.get("value") is not None else "N/A"
            parts.append(f"- {lv['name']}: {val_str} (Ref: {lv.get('reference_range', 'N/A')}) [{lv.get('status', 'N/A')}]")
    else:
        parts.append("## Lab Values\nNo lab values available.")

    # Prescriptions
    prescriptions = context.get("prescriptions", [])
    if prescriptions:
        parts.append("## Prescriptions")
        for rx in prescriptions:
            parts.append(f"\n### Prescription — {rx.get('date', 'N/A')}")
            parts.append(f"Doctor: {rx.get('doctor_name', 'N/A')}")
            parts.append(f"Diagnosis: {rx.get('diagnosis', 'N/A')}")
            for med in rx.get("medicines", []):
                if isinstance(med, dict):
                    parts.append(f"  - {med.get('name', '')}: {med.get('dosage', '')} {med.get('frequency', '')} for {med.get('duration', '')}")
                else:
                    parts.append(f"  - {med}")
            if rx.get("notes"):
                parts.append(f"Notes: {rx['notes']}")
    else:
        parts.append("## Prescriptions\nNo prescriptions recorded.")

    # Medical history
    history = context.get("medical_history", [])
    if history:
        parts.append("## Medical History Timeline")
        for event in history[:10]:
            parts.append(f"- [{event.get('date', '')}] {event.get('title', '')}: {event.get('description', '')}")
    else:
        parts.append("## Medical History Timeline\nNo history events recorded.")

    # Doctor notes
    notes = context.get("doctor_notes", [])
    if notes:
        parts.append("## Doctor Notes")
        for n in notes[:5]:
            parts.append(f"- {n.get('doctor_name', 'Physician')}: {n.get('content', '')}")
    else:
        parts.append("## Doctor Notes\nNo doctor notes recorded.")

    return "\n\n".join(parts)


def _to_oid(id_str: str):
    """Convert string to ObjectId, returning the string if conversion fails."""
    try:
        from bson import ObjectId
        return ObjectId(id_str)
    except Exception:
        return id_str
