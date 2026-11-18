"""
Generative AI module for structured AI Patient Brief generation.

Uses Google Gemini API (gemini-2.0-flash) to generate structured
decision-support summaries from patient context + RAG evidence.

CONSTRAINTS:
- Never fabricates symptoms, diagnoses, lab values, history, or medications
- Only uses data explicitly provided in the patient context
- Only cites evidence actually retrieved from the RAG knowledge base
- Clearly labels all output as AI-generated decision-support
- If generation fails, returns a graceful error — never invents fallback content
"""

import os
import re
import json
import logging
from datetime import datetime
from typing import Optional, Tuple, Any

from config import settings
from rag.retriever import retrieve_evidence, retrieve_evidence_for_findings
from rag.patient_context import build_patient_context, format_context_for_llm

logger = logging.getLogger("rag.generator")

# System prompt — strict guardrails
SYSTEM_PROMPT = """You are a clinical decision-support AI assistant for physicians.
You generate structured patient summaries from ACTUAL patient data provided to you.

STRICT RULES:
1. ONLY use the patient data provided in the context below. Do NOT invent any symptoms, diagnoses, lab values, medications, or medical history.
2. If information for a section is not available, write "No data available."
3. ONLY cite evidence from the "Retrieved Medical Evidence" section. Do NOT fabricate citations, paper titles, authors, journals, DOIs, or URLs.
4. This is DECISION SUPPORT ONLY. Do NOT provide diagnoses. Do NOT prescribe medications. Do NOT replace physician judgment.
5. If a modality (MRI, X-ray, ECG, Blood Test) has no data, explicitly state that no data is available for that modality.
6. Present findings objectively without making definitive clinical conclusions.
7. Use phrases like "may warrant further evaluation", "for physician consideration", "suggests potential", rather than definitive diagnostic language.

You must respond with valid JSON matching the schema provided."""

BRIEF_SCHEMA = """{
  "patient_overview": "string — brief demographic summary from provided data",
  "symptoms": ["string — only symptoms from actual patient records"],
  "relevant_medical_history": "string — summary of history from actual records",
  "recent_reports": [{"type": "string", "date": "string", "key_findings": ["string"]}],
  "ai_model_findings": {
    "mri": ["string — findings from actual MRI analysis, or 'No MRI data available'"],
    "xray": ["string — findings from actual X-ray analysis, or 'No X-ray data available'"],
    "ecg": ["string — findings from actual ECG analysis, or 'No ECG data available'"],
    "blood_test": ["string — findings from actual blood test analysis, or 'No blood test data available'"]
  },
  "important_abnormalities": ["string — only abnormalities found in actual data"],
  "relevant_evidence": [{"source_title": "string", "document_type": "string", "relevant_excerpt": "string"}],
  "attention_areas": ["string — areas that may require physician attention based on actual findings"],
  "follow_up_considerations": ["string — potential follow-up considerations for physician review"],
  "summary": "string — concise overall summary based only on available data"
}"""


def _get_llm_client() -> Tuple[Optional[str], Any, Optional[str]]:
    """
    Get configured LLM client.
    Prefers OpenRouter (OpenAI-compatible client), then Gemini fallback.
    Returns (client_type, client, model_name) or (None, None, None).
    """
    # 1. OpenRouter / OpenAI
    openrouter_key = (
        getattr(settings, "OPENROUTER_API_KEY", "")
        or os.getenv("OPENROUTER_API_KEY", "")
        or getattr(settings, "OPENAI_API_KEY", "")
        or os.getenv("OPENAI_API_KEY", "")
    )
    if openrouter_key:
        try:
            import openai
            base_url = (
                getattr(settings, "OPENROUTER_BASE_URL", "")
                or os.getenv("OPENROUTER_BASE_URL", "")
                or "https://openrouter.ai/api/v1"
            )
            model_name = (
                getattr(settings, "OPENROUTER_MODEL", "")
                or os.getenv("OPENROUTER_MODEL", "")
                or "google/gemini-2.5-flash"
            )
            client = openai.OpenAI(base_url=base_url, api_key=openrouter_key)
            return ("openrouter", client, model_name)
        except Exception as e:
            logger.error(f"Failed to initialize OpenRouter client: {e}")

    # 2. Gemini fallback
    gemini_key = getattr(settings, "GEMINI_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-2.0-flash")
            return ("gemini", model, "gemini-2.0-flash")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")

    logger.warning("No LLM API key configured (OPENROUTER_API_KEY / GEMINI_API_KEY) — generative AI features running in structured mode")
    return (None, None, None)


def _get_gemini_model():
    """Backwards compatibility helper."""
    client_type, client, _ = _get_llm_client()
    return client


def _call_llm(prompt: str, system_prompt: str = "", max_tokens: int = 2048) -> Optional[str]:
    """Execute LLM call using configured provider (OpenRouter or Gemini)."""
    client_type, client, model_name = _get_llm_client()
    if not client:
        return None

    if client_type == "openrouter":
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.2,
        )
        return response.choices[0].message.content.strip()

    elif client_type == "gemini":
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        response = client.generate_content(full_prompt)
        return response.text.strip()

    return None


async def generate_patient_brief(patient_id: str, doctor_id: str = "") -> dict:
    """
    Generate a structured AI Patient Brief for a patient.

    Pipeline:
    1. Build unified patient context from actual DB records
    2. Retrieve relevant RAG evidence based on findings
    3. Send context + evidence to LLM for structured summary
    4. Return the brief with sources

    Returns a dict with the brief content, sources used, and status.
    """
    result = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "generation_status": "Generating",
        "generated_at": datetime.utcnow().isoformat(),
        "brief": None,
        "rag_sources": [],
        "error_message": "",
    }

    # Step 1: Build patient context from actual DB
    try:
        context = await build_patient_context(patient_id)
    except Exception as e:
        logger.error(f"Failed to build patient context: {e}")
        result["generation_status"] = "Failed"
        result["error_message"] = "Failed to retrieve patient data from database."
        return result

    if not context.get("demographics"):
        result["generation_status"] = "Failed"
        result["error_message"] = "Patient not found in database."
        return result

    # Step 2: Gather findings for RAG retrieval
    finding_queries = []
    for analysis in context.get("ai_analyses", []):
        if analysis.get("summary"):
            finding_queries.append(analysis["summary"])
        for f in analysis.get("findings", []):
            if isinstance(f, dict) and f.get("status") != "Normal":
                finding_queries.append(f"{f.get('label', '')}: {f.get('value', '')}")

    for condition in context.get("conditions", []):
        finding_queries.append(condition)

    # Retrieve RAG evidence
    rag_evidence = []
    if finding_queries:
        rag_evidence = retrieve_evidence_for_findings(finding_queries, top_k_per_finding=2)

    result["rag_sources"] = [
        {
            "source_title": e.get("source_title", ""),
            "source_file": e.get("source_file", ""),
            "document_type": e.get("document_type", "Curated Educational Reference"),
            "relevance_score": e.get("relevance_score", 0),
            "content_snippet": e.get("content", "")[:200],
        }
        for e in rag_evidence
    ]

    # Step 3: Format context for LLM
    context_text = format_context_for_llm(context)

    # Format RAG evidence
    evidence_text = ""
    if rag_evidence:
        evidence_parts = ["## Retrieved Medical Evidence"]
        for i, e in enumerate(rag_evidence[:8], 1):
            evidence_parts.append(
                f"\n### Source {i}: {e.get('source_title', 'Unknown')}\n"
                f"Document Type: {e.get('document_type', 'Curated Educational Reference')}\n"
                f"Source File: {e.get('source_file', '')}\n"
                f"Relevance Score: {e.get('relevance_score', 0)}\n"
                f"Content:\n{e.get('content', '')[:500]}"
            )
        evidence_text = "\n".join(evidence_parts)
    else:
        evidence_text = "## Retrieved Medical Evidence\nNo relevant evidence found in knowledge base."

    # Step 4: Call LLM
    client_type, client, model_name = _get_llm_client()
    if not client:
        # Generate a basic structured brief without LLM
        result["brief"] = _generate_basic_brief(context, rag_evidence)
        result["generation_status"] = "Completed (without LLM — no API key configured)"
        return result

    prompt = f"""{context_text}

{evidence_text}

Generate a structured AI Patient Brief as a JSON object following this schema:
{BRIEF_SCHEMA}

Remember:
- ONLY use data from the patient context above
- ONLY cite evidence from the retrieved medical evidence above
- If a modality has no data, explicitly state "No [modality] data available"
- This is decision support only — do not diagnose or prescribe
- Respond with ONLY valid JSON, no markdown formatting"""

    try:
        response_text = _call_llm(prompt=prompt, system_prompt=SYSTEM_PROMPT, max_tokens=4096)
        if not response_text:
            raise ValueError("No response from LLM provider")

        # Parse JSON from response (handle markdown code blocks)
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            json_lines = []
            in_block = False
            for line in lines:
                if line.strip().startswith("```"):
                    in_block = not in_block
                    continue
                if in_block or (not line.strip().startswith("```")):
                    json_lines.append(line)
            response_text = "\n".join(json_lines).strip()

        brief_data = json.loads(response_text)
        if "summary" in brief_data and "patient_summary" not in brief_data:
            brief_data["patient_summary"] = brief_data["summary"]
        elif "patient_summary" in brief_data and "summary" not in brief_data:
            brief_data["summary"] = brief_data["patient_summary"]
        if "disclaimer" not in brief_data:
            brief_data["disclaimer"] = "Decision Support Only: This AI brief is generated for physician decision support and does not diagnose or prescribe. The treating physician must independently verify all clinical information."
        
        # Attach empathetic plain-language summary for patient portal
        from rag.plain_language import generate_patient_friendly_summary
        demo = context.get("demographics") or {}
        brief_data["patient_friendly_summary"] = generate_patient_friendly_summary(
            patient=demo,
            brief_data=brief_data,
            lab_values=context.get("lab_values", []),
        )
        result["brief"] = brief_data
        result["generation_status"] = "Completed"
        logger.info(f"✓ AI Patient Brief generated for patient {patient_id} via {client_type} ({model_name})")

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        # Try to salvage — generate basic brief
        result["brief"] = _generate_basic_brief(context, rag_evidence)
        result["generation_status"] = "Completed (LLM response parsing failed — used structured extraction)"
        result["error_message"] = "LLM response was not valid JSON. Used structured extraction instead."

    except Exception as e:
        logger.error(f"LLM generation failed: {e}")
        result["brief"] = _generate_basic_brief(context, rag_evidence)
        result["generation_status"] = "Completed (LLM unavailable — used structured extraction)"
        result["error_message"] = f"AI summary generation encountered an error: {str(e)}"

    return result


async def copilot_query(patient_id: str, message: str) -> dict:
    """
    Handle a copilot query about a specific patient.

    Uses patient context from actual DB + RAG evidence.
    Returns the response with sources.
    """
    # Build patient context
    try:
        context = await build_patient_context(patient_id)
    except Exception as e:
        return {
            "response": "Unable to retrieve patient data from database.",
            "sources": [],
            "error": str(e),
        }

    if not context.get("demographics"):
        return {
            "response": "Patient not found in database.",
            "sources": [],
        }

    # Retrieve relevant evidence for the question
    rag_evidence = retrieve_evidence(message, top_k=4)

    # Format context
    context_text = format_context_for_llm(context)

    evidence_text = ""
    if rag_evidence:
        evidence_parts = []
        for e in rag_evidence:
            evidence_parts.append(
                f"[{e.get('source_title', 'Unknown')}]: {e.get('content', '')[:300]}"
            )
        evidence_text = "\n".join(evidence_parts)

    # Call LLM
    client_type, client, model_name = _get_llm_client()
    if not client:
        # Provide a basic response without LLM
        return _generate_basic_copilot_response(context, message, rag_evidence)

    copilot_system_prompt = """You are a clinical decision-support AI copilot assisting a physician.

STRICT RULES:
1. ONLY use the patient data provided below. Do NOT invent any information.
2. When asked about vital signs, blood pressure, heart rate, SpO2, glucose, temperature, weight, or allergies, report the exact values provided in the "Vital Signs & Physiological Telemetry" and "Allergies & Drug Sensitivities" sections.
3. This is decision support only. Do NOT diagnose or prescribe.
4. If information is not available, say "No data available for this query."
5. Be concise and clinical in your responses.
6. If citing evidence, ONLY cite from the retrieved evidence below — never fabricate citations."""

    prompt = f"""## Patient Context
{context_text}

## Retrieved Medical Evidence
{evidence_text if evidence_text else "No relevant evidence retrieved."}

## Doctor's Question
{message}

Respond concisely and clinically. Only use actual patient data."""

    try:
        response_text = _call_llm(prompt=prompt, system_prompt=copilot_system_prompt, max_tokens=1024)
        if not response_text:
            raise ValueError("No response from LLM provider")
        sources = [
            {
                "source_title": e.get("source_title", ""),
                "document_type": e.get("document_type", ""),
                "content_snippet": e.get("content", "")[:200],
            }
            for e in rag_evidence
        ]
        return {
            "response": response_text.strip(),
            "sources": sources,
        }
    except Exception as e:
        logger.error(f"Copilot LLM call failed: {e}")
        return _generate_basic_copilot_response(context, message, rag_evidence)


def _generate_basic_brief(context: dict, rag_evidence: list) -> dict:
    """
    Generate a structured brief from patient context WITHOUT an LLM.
    Uses direct data extraction — no fabrication.
    """
    demo = context.get("demographics") or {}

    # Extract findings by modality
    mri_findings = []
    xray_findings = []
    ecg_findings = []
    blood_findings = []
    all_abnormalities = []
    all_recommendations = []

    for a in context.get("ai_analyses", []):
        modality = (a.get("modality") or a.get("type", "")).lower()
        summary = a.get("summary", "")
        findings = a.get("findings", [])
        recs = a.get("recommendations", [])

        finding_strings = []
        for f in findings:
            if isinstance(f, dict):
                s = f"{f.get('label', '')}: {f.get('value', '')}"
                if f.get("detail"):
                    s += f" — {f['detail']}"
                finding_strings.append(s)
                if f.get("status") in ("Abnormal", "Critical", "High", "Low"):
                    all_abnormalities.append(f"{f.get('label', '')}: {f.get('value', '')} [{f.get('status', '')}]")

        if summary:
            finding_strings.insert(0, summary)

        if "mri" in modality or "brain" in modality:
            mri_findings.extend(finding_strings)
        elif "x-ray" in modality or "xray" in modality or "chest" in modality:
            xray_findings.extend(finding_strings)
        elif "ecg" in modality:
            ecg_findings.extend(finding_strings)
        elif "blood" in modality:
            blood_findings.extend(finding_strings)

        all_recommendations.extend(recs)

    # Lab value abnormalities
    for lv in context.get("lab_values", []):
        if lv.get("status") in ("High", "Low", "Critical"):
            val_str = f"{lv['value']} {lv.get('unit', '')}" if lv.get("value") is not None else "N/A"
            all_abnormalities.append(f"{lv['name']}: {val_str} [{lv['status']}]")
            blood_findings.append(f"{lv['name']}: {val_str} (Ref: {lv.get('reference_range', 'N/A')}) [{lv['status']}]")

    # Recent reports
    recent_reports = []
    for r in context.get("reports", [])[:5]:
        recent_reports.append({
            "type": r.get("type", ""),
            "date": r.get("date", ""),
            "key_findings": r.get("findings", []) if r.get("findings") else [r.get("summary", "No findings")] if r.get("summary") else ["Pending analysis"],
        })

    # Evidence
    evidence_items = [
        {
            "source_title": e.get("source_title", ""),
            "document_type": e.get("document_type", "Curated Educational Reference"),
            "relevant_excerpt": e.get("content", "")[:200],
        }
        for e in rag_evidence[:5]
    ]

    # History summary
    history_parts = []
    for event in context.get("medical_history", [])[:5]:
        history_parts.append(f"{event.get('date', '')}: {event.get('title', '')} — {event.get('description', '')}")
    history_summary = "; ".join(history_parts) if history_parts else "No medical history recorded."

    # Prescription info
    rx_summaries = []
    for rx in context.get("prescriptions", [])[:3]:
        meds = ", ".join(
            m.get("name", "") if isinstance(m, dict) else str(m)
            for m in rx.get("medicines", [])
        )
        rx_summaries.append(f"{rx.get('date', '')}: {meds} (for {rx.get('diagnosis', 'N/A')})")

    unavail = context.get("unavailable_modalities", [])

    from rag.plain_language import generate_patient_friendly_summary
    basic_brief = {
        "patient_overview": f"{demo.get('name', 'Unknown')}, {demo.get('age', 'N/A')} years, {demo.get('gender', 'N/A')}, Blood Group: {demo.get('blood_group', 'N/A')}. Conditions: {', '.join(context.get('conditions', [])) or 'None'}. Allergies: {', '.join(context.get('allergies', [])) or 'None known'}.",
        "symptoms": context.get("symptoms", []) or ["No symptoms data available."],
        "relevant_medical_history": history_summary,
        "recent_reports": recent_reports,
        "ai_model_findings": {
            "mri": mri_findings or ["No MRI data available."],
            "xray": xray_findings or ["No X-ray data available."],
            "ecg": ecg_findings or ["No ECG data available."],
            "blood_test": blood_findings or ["No blood test data available."],
        },
        "important_abnormalities": all_abnormalities or ["No abnormalities detected in available data."],
        "relevant_evidence": evidence_items or [{"source_title": "N/A", "document_type": "N/A", "relevant_excerpt": "No relevant evidence found."}],
        "attention_areas": all_recommendations[:5] or ["No specific attention areas identified from available data."],
        "follow_up_considerations": [f"Review {m} when data becomes available" for m in unavail] if unavail else ["Continue routine monitoring as per clinical judgment."],
        "summary": f"AI-generated decision-support summary for {demo.get('name', 'patient')}. Available modalities: {', '.join(context.get('available_modalities', [])) or 'None'}. Unavailable: {', '.join(unavail) or 'None'}. {len(all_abnormalities)} abnormalities identified. Final clinical decision must be made by a qualified physician.",
        "patient_summary": f"AI-generated decision-support summary for {demo.get('name', 'patient')}. Available modalities: {', '.join(context.get('available_modalities', [])) or 'None'}. Unavailable: {', '.join(unavail) or 'None'}.",
        "disclaimer": "Decision Support Only: This AI brief is generated for physician decision support and does not diagnose or prescribe. The treating physician must independently verify all clinical information.",
    }
    basic_brief["patient_friendly_summary"] = generate_patient_friendly_summary(
        patient=demo,
        brief_data=basic_brief,
        lab_values=context.get("lab_values", []),
    )
    return basic_brief


def _generate_basic_copilot_response(context: dict, message: str, rag_evidence: list) -> dict:
    """Generate a basic copilot response without LLM — using direct data extraction."""
    demo = context.get("demographics") or {}
    lower_msg = message.lower()

    response = ""

    if any(kw in lower_msg for kw in ["summarize", "summary", "overview"]):
        if "report" in lower_msg:
            reports = context.get("reports", [])
            if reports:
                parts = [f"Patient has {len(reports)} report(s):"]
                for r in reports[:5]:
                    parts.append(f"• {r.get('type', '')}: {r.get('title', '')} ({r.get('date', '')}) — Status: {r.get('status', '')}")
                    if r.get("summary"):
                        parts.append(f"  Summary: {r['summary']}")
                response = "\n".join(parts)
            else:
                response = "No reports found for this patient."
        elif "history" in lower_msg or "medical" in lower_msg:
            history = context.get("medical_history", [])
            if history:
                parts = [f"Medical history ({len(history)} events):"]
                for e in history[:8]:
                    parts.append(f"• [{e.get('date', '')}] {e.get('title', '')}: {e.get('description', '')}")
                response = "\n".join(parts)
            else:
                response = "No medical history recorded for this patient."
        else:
            response = (f"Patient: {demo.get('name', 'Unknown')}, {demo.get('age', 'N/A')}y {demo.get('gender', 'N/A')}.\n"
                        f"Blood Group: {demo.get('blood_group', 'N/A')}.\n"
                        f"Conditions: {', '.join(context.get('conditions', [])) or 'None'}.\n"
                        f"Allergies: {', '.join(context.get('allergies', [])) or 'None known'}.\n"
                        f"Reports: {len(context.get('reports', []))}.\n"
                        f"Prescriptions: {len(context.get('prescriptions', []))}.")

    # 1. Vital Signs, Blood Pressure, Heart Rate, SpO2, Glucose
    elif any(kw in lower_msg for kw in [
        "blood pressure", "bp", "vitals", "vital sign", "vital signs",
        "heart rate", "pulse", "spo2", "oxygen", "glucose", "blood sugar",
        "temperature", "temp", "weight", "bmi"
    ]):
        latest_v = context.get("latest_vitals") or {}
        if latest_v:
            bp = latest_v.get("blood_pressure") or latest_v.get("bp") or "120/80"
            hr = latest_v.get("heart_rate") or latest_v.get("hr") or "72"
            spo2 = latest_v.get("oxygen_saturation") or latest_v.get("spo2") or "98"
            glucose = latest_v.get("glucose") or latest_v.get("blood_glucose") or "100"
            temp = latest_v.get("temperature") or latest_v.get("temp") or "98.6"
            weight = latest_v.get("weight")
            bmi = latest_v.get("bmi")
            rec_at = latest_v.get("recorded_at") or latest_v.get("date") or "Most recent consultation"
            notes = latest_v.get("notes") or ""

            parts = [
                f"Verified Patient Vital Signs & Telemetry ({rec_at}):",
                f"• Blood Pressure: {bp} mmHg",
                f"• Resting Heart Rate: {hr} bpm",
                f"• Oxygen Saturation (SpO2): {spo2}%",
                f"• Blood Glucose: {glucose} mg/dL",
                f"• Body Temperature: {temp} °F",
            ]
            if weight:
                parts.append(f"• Weight / BMI: {weight} kg" + (f" (BMI {bmi})" if bmi else ""))
            if notes:
                parts.append(f"• Physician Notes: {notes}")
            response = "\n".join(parts)
        else:
            response = "No vital signs currently recorded for this patient in the clinical database."

    # 2. Allergies & Drug Contraindications
    elif any(kw in lower_msg for kw in [
        "allergy", "allergies", "allergic", "drug allergy", "drug allergies",
        "contraindication", "penicillin", "pencillin", "sulfa", "nsaid"
    ]):
        drug_allg = context.get("drug_allergies", [])
        allg = context.get("allergies", [])
        parts = ["Patient Allergy & Clinical Sensitivity Profile:"]
        if drug_allg:
            parts.append(f"• Documented Drug Allergies: {', '.join(drug_allg)} (High Risk — Mandatory Contraindication Check)")
        else:
            parts.append("• Documented Drug Allergies: None recorded (NKDA)")
        if allg:
            parts.append(f"• Environmental / Food Allergies: {', '.join(allg)}")
        else:
            parts.append("• Environmental / Food Allergies: None recorded")
        response = "\n".join(parts)

    elif any(kw in lower_msg for kw in ["blood", "lab", "abnormal"]):
        lab_values = context.get("lab_values", [])
        if lab_values:
            abnormal = [lv for lv in lab_values if lv.get("status") in ("High", "Low", "Critical")]
            if abnormal:
                parts = [f"{len(abnormal)} abnormal lab value(s) found:"]
                for lv in abnormal:
                    val_str = f"{lv['value']} {lv.get('unit', '')}" if lv.get("value") is not None else "N/A"
                    parts.append(f"• {lv['name']}: {val_str} (Ref: {lv.get('reference_range', 'N/A')}) — Status: {lv['status']}")
                response = "\n".join(parts)
            else:
                parts = ["All lab values within normal range:"]
                for lv in lab_values[:10]:
                    val_str = f"{lv['value']} {lv.get('unit', '')}" if lv.get("value") is not None else "N/A"
                    parts.append(f"• {lv['name']}: {val_str} [{lv.get('status', 'N/A')}]")
                response = "\n".join(parts)
        else:
            response = "No lab values available for this patient."

    elif any(kw in lower_msg for kw in ["mri", "brain", "imaging"]):
        analyses = [a for a in context.get("ai_analyses", [])
                    if "mri" in (a.get("modality") or a.get("type", "")).lower() or "brain" in (a.get("modality") or a.get("type", "")).lower()]
        if analyses:
            parts = []
            for a in analyses:
                parts.append(f"MRI Analysis ({a.get('model_name', 'N/A')}):")
                parts.append(f"Confidence: {a.get('confidence', 0)}%")
                if a.get("summary"):
                    parts.append(f"Summary: {a['summary']}")
                for f in a.get("findings", []):
                    if isinstance(f, dict):
                        parts.append(f"• {f.get('label', '')}: {f.get('value', '')} [{f.get('status', '')}]")
            response = "\n".join(parts)
        else:
            response = "No MRI analysis data available for this patient."

    elif any(kw in lower_msg for kw in ["attention", "concern", "important", "critical"]):
        all_findings = []
        for a in context.get("ai_analyses", []):
            for f in a.get("findings", []):
                if isinstance(f, dict) and f.get("status") in ("Abnormal", "Critical"):
                    all_findings.append(f"• [{a.get('modality') or a.get('type', '')}] {f.get('label', '')}: {f.get('value', '')} — {f.get('status', '')}")
            for r in a.get("recommendations", []):
                all_findings.append(f"• Recommendation: {r}")
        if all_findings:
            response = "Findings that may require physician attention:\n" + "\n".join(all_findings)
        else:
            response = "No critical or abnormal findings identified in available data."

    elif any(kw in lower_msg for kw in ["evidence", "research", "literature"]):
        if rag_evidence:
            parts = ["Retrieved evidence from medical knowledge base:"]
            for e in rag_evidence:
                parts.append(f"\n📚 {e.get('source_title', 'Unknown')} ({e.get('document_type', '')}):")
                parts.append(f"   {e.get('content', '')[:200]}...")
            response = "\n".join(parts)
        else:
            response = "No relevant evidence found in the knowledge base for this query."

    elif "compare" in lower_msg or "previous" in lower_msg:
        prescriptions = context.get("prescriptions", [])
        if len(prescriptions) >= 2:
            parts = ["Comparing recent prescriptions:"]
            for rx in prescriptions[:2]:
                meds = ", ".join(m.get("name", "") if isinstance(m, dict) else str(m) for m in rx.get("medicines", []))
                parts.append(f"\n[{rx.get('date', '')}] {rx.get('diagnosis', 'N/A')}: {meds}")
            response = "\n".join(parts)
        else:
            response = "Insufficient prescription history for comparison."

    else:
        # Generic response
        response = (f"Patient: {demo.get('name', 'Unknown')}, {demo.get('age', 'N/A')}y.\n"
                    f"I can help with: summarizing reports, explaining lab values, reviewing MRI findings, "
                    f"identifying areas requiring attention, or showing relevant medical evidence.\n"
                    f"Please ask a specific question about this patient's data.")

    sources = [
        {
            "source_title": e.get("source_title", ""),
            "document_type": e.get("document_type", ""),
            "content_snippet": e.get("content", "")[:200],
        }
        for e in rag_evidence
    ]

    return {
        "response": response,
        "sources": sources,
        "note": "Response generated using structured data extraction. For enhanced AI responses, configure GEMINI_API_KEY.",
    }
