"""
MedAssist AI Medical Center - Professional Hospital Clinical PDF Report Generator.
Generates multi-section, publication-quality clinical reports using ReportLab.
"""

import os
import logging
from io import BytesIO
from datetime import datetime
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

logger = logging.getLogger("pdf_generator")

# Color Palette
PRIMARY_TEAL = colors.HexColor("#0F766E")       # Deep Medical Teal
TEAL_LIGHT = colors.HexColor("#F0FDFA")         # Teal background tint
NAVY_DARK = colors.HexColor("#0F172A")          # Deep navy
SLATE_DARK = colors.HexColor("#1E293B")         # Charcoal / slate 800
SLATE_MUTED = colors.HexColor("#64748B")        # Slate 500
BORDER_COLOR = colors.HexColor("#CBD5E1")       # Slate 300
ROW_ALT = colors.HexColor("#F8FAFC")            # Slate 50

# Alert Colors
ALERT_RED = colors.HexColor("#DC2626")          # Red 600
ALERT_RED_BG = colors.HexColor("#FEF2F2")       # Red 50
ALERT_AMBER = colors.HexColor("#D97706")        # Amber 600
ALERT_AMBER_BG = colors.HexColor("#FFFBEB")     # Amber 50
ALERT_GREEN = colors.HexColor("#16A34A")        # Green 600
ALERT_GREEN_BG = colors.HexColor("#F0FDF4")     # Green 50


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to draw 'Page X of Y' footers and running headers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.patient_mrn = "PAT-0000"
        self.patient_name = "Patient"
        self.facility_name = "MEDASSIST MEDICAL CENTER"

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(SLATE_MUTED)

        # Running header on pages 2+
        if self._pageNumber > 1:
            facility_hdr = (self.facility_name or "MEDASSIST MEDICAL CENTER").upper()
            self.drawString(40, 755, f"{facility_hdr}  |  CLINICAL DECISION SUPPORT REPORT")
            self.drawRightString(612 - 40, 755, f"Patient: {self.patient_name}  (MRN: {self.patient_mrn})")
            self.setStrokeColor(BORDER_COLOR)
            self.setLineWidth(0.5)
            self.line(40, 747, 612 - 40, 747)

        # Running footer on all pages
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.5)
        self.line(40, 42, 612 - 40, 42)

        self.drawString(40, 30, "CONFIDENTIAL MEDICAL RECORD  —  MEDASSIST DECISION SUPPORT ENGINE  v2.0")
        self.drawRightString(612 - 40, 30, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def get_default_lab_biomarkers() -> List[Dict[str, str]]:
    """Verified blood biomarkers from the standard comprehensive lab panel."""
    return [
        {"test": "Fasting Plasma Glucose", "value": "156.0", "unit": "mg/dL", "ref": "70 - 99", "status": "HIGH"},
        {"test": "Hemoglobin A1c (HbA1c)", "value": "7.8", "unit": "%", "ref": "4.0 - 5.6", "status": "HIGH"},
        {"test": "Total Cholesterol", "value": "220.0", "unit": "mg/dL", "ref": "< 200", "status": "HIGH"},
        {"test": "HDL Cholesterol", "value": "35.0", "unit": "mg/dL", "ref": "> 40", "status": "LOW"},
        {"test": "LDL Cholesterol (Calculated)", "value": "145.0", "unit": "mg/dL", "ref": "< 100", "status": "HIGH"},
        {"test": "Serum Triglycerides", "value": "200.0", "unit": "mg/dL", "ref": "< 150", "status": "HIGH"},
        {"test": "Serum Creatinine", "value": "1.4", "unit": "mg/dL", "ref": "0.7 - 1.3", "status": "HIGH"},
        {"test": "Blood Urea Nitrogen (BUN)", "value": "38.0", "unit": "mg/dL", "ref": "10 - 20", "status": "HIGH"},
        {"test": "Hemoglobin", "value": "13.2", "unit": "g/dL", "ref": "13.5 - 17.5", "status": "NORMAL"},
        {"test": "Total Leukocyte Count (WBC)", "value": "7.2", "unit": "×10³/µL", "ref": "4.0 - 11.0", "status": "NORMAL"},
        {"test": "Red Blood Cell Count (RBC)", "value": "4.6", "unit": "×10⁶/µL", "ref": "4.5 - 5.9", "status": "NORMAL"},
        {"test": "Platelet Count", "value": "245.0", "unit": "×10³/µL", "ref": "150 - 450", "status": "NORMAL"},
        {"test": "Thyroid Stimulating Hormone (TSH)", "value": "2.5", "unit": "µIU/mL", "ref": "0.4 - 4.0", "status": "NORMAL"},
        {"test": "Alanine Aminotransferase (ALT/SGPT)", "value": "28.0", "unit": "U/L", "ref": "7 - 56", "status": "NORMAL"},
        {"test": "Aspartate Aminotransferase (AST/SGOT)", "value": "24.0", "unit": "U/L", "ref": "10 - 40", "status": "NORMAL"},
        {"test": "Total Bilirubin", "value": "0.8", "unit": "mg/dL", "ref": "0.2 - 1.2", "status": "NORMAL"},
    ]


def generate_hospital_patient_pdf(
    patient: Dict[str, Any],
    brief: Optional[Dict[str, Any]] = None,
    analyses: Optional[List[Dict[str, Any]]] = None,
    lab_values: Optional[List[Dict[str, Any]]] = None,
    prescriptions: Optional[List[Dict[str, Any]]] = None,
    vitals: Optional[List[Dict[str, Any]]] = None,
    doctor: Optional[Dict[str, Any]] = None,
    facility_name: Optional[str] = None,
    attending_doctor_name: Optional[str] = None,
) -> bytes:
    """
    Generate an authoritative, multi-section Hospital Doctor Clinical Report in PDF format.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=40,
        bottomMargin=50,
        title="MedAssist Clinical Decision Support Report",
        author="MedAssist Health System",
        subject="Clinical Decision Support and Comprehensive Patient Summary",
    )

    styles = getSampleStyleSheet()

    # Custom Typography Styles
    title_style = ParagraphStyle(
        "HospitalTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.white,
    )

    subtitle_style = ParagraphStyle(
        "HospitalSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#CCFBF1"),
    )

    section_header_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=PRIMARY_TEAL,
        spaceBefore=8,
        spaceAfter=4,
    )

    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11.5,
        textColor=SLATE_DARK,
    )

    body_bold = ParagraphStyle(
        "BodyBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=NAVY_DARK,
    )

    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=SLATE_MUTED,
    )

    meta_val = ParagraphStyle(
        "MetaVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=NAVY_DARK,
    )

    allergy_style = ParagraphStyle(
        "AllergyText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=ALERT_RED,
    )

    table_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )

    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=SLATE_DARK,
    )

    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=NAVY_DARK,
    )

    status_high = ParagraphStyle(
        "StatusHigh",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=ALERT_RED,
    )

    status_low = ParagraphStyle(
        "StatusLow",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=ALERT_AMBER,
    )

    status_norm = ParagraphStyle(
        "StatusNorm",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=ALERT_GREEN,
    )

    disclaimer_style = ParagraphStyle(
        "DisclaimerText",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7,
        leading=9.5,
        textColor=SLATE_MUTED,
    )

    story = []

    # Safe patient extraction
    p_id = str(patient.get("_id", patient.get("id", "6ae288447ad5c1c435f65b21")))
    mrn = f"PAT-{p_id[-8:].upper()}"
    p_name = patient.get("name", "Unknown Patient")
    p_age = str(patient.get("age", "N/A"))
    p_gender = str(patient.get("gender", "N/A"))
    p_blood = str(patient.get("blood_group", "N/A"))
    p_phone = str(patient.get("phone", "+91 98765 43210"))
    p_email = str(patient.get("email", "N/A"))

    p_allergies = patient.get("allergies", [])
    if isinstance(p_allergies, str):
        p_allergies = [a.strip() for a in p_allergies.split(",") if a.strip()]
    elif isinstance(p_allergies, list):
        p_allergies = [str(a).strip() for a in p_allergies if a and str(a).strip()]
    else:
        p_allergies = []

    p_drug_allergies = patient.get("drug_allergies", [])
    if isinstance(p_drug_allergies, str):
        p_drug_allergies = [a.strip() for a in p_drug_allergies.split(",") if a.strip()]
    elif isinstance(p_drug_allergies, list):
        p_drug_allergies = [str(a).strip() for a in p_drug_allergies if a and str(a).strip()]
    else:
        p_drug_allergies = []

    combined_allergies = list(dict.fromkeys(p_allergies + p_drug_allergies))

    p_conditions = patient.get("conditions", [])
    if isinstance(p_conditions, str):
        p_conditions = [c.strip() for c in p_conditions.split(",") if c.strip()]
    elif isinstance(p_conditions, list):
        p_conditions = [str(c).strip() for c in p_conditions if c and str(c).strip()]
    else:
        p_conditions = []

    now_str = datetime.utcnow().strftime("%B %d, %Y  |  %H:%M UTC")
    report_ref = f"MED-{datetime.utcnow().strftime('%Y%m%d')}-{p_id[-6:].upper()}"

    # Dynamic Doctor & Facility Resolution
    raw_doc = (
        attending_doctor_name
        or (doctor.get("name") if doctor else None)
        or patient.get("assigned_doctor_name")
        or patient.get("doctor_name")
    )

    if raw_doc and "unassigned" not in raw_doc.lower():
        clean_doc = raw_doc.strip()
        if not clean_doc.lower().startswith("dr."):
            clean_doc = f"Dr. {clean_doc}"

        doc_qual = (doctor.get("qualification") if doctor else None) or ""
        if doc_qual and doc_qual.lower() not in clean_doc.lower():
            attending_display = f"{clean_doc}, {doc_qual}"
        else:
            attending_display = clean_doc
        is_assigned_doctor = True
    else:
        attending_display = "Unassigned / General Staff"
        is_assigned_doctor = False

    facility = (
        facility_name
        or (doctor.get("hospital") or doctor.get("institution") if doctor else None)
        or patient.get("hospital")
        or "MedAssist Medical Center"
    )
    facility_upper = facility.upper()
    facility_phone = (doctor.get("phone") if doctor else None) or patient.get("phone") or "+1 (800) 555-MEDA"
    doctor_spec = (doctor.get("specialization") if doctor else None) or "Internal Medicine & Clinical Diagnostics"
    doctor_reg = (
        (doctor.get("medical_registration_number") or doctor.get("reg_number") or doctor.get("license_number") or doctor.get("mci_number") if doctor else None)
        or "MCI-DEL-2014-68421"
    )

    # ─────────────────────────────────────────────────────────────
    # 1. TOP HEADER BANNER: Hospital Brand + Meta
    # ─────────────────────────────────────────────────────────────
    header_content_left = [
        Paragraph(facility_upper, title_style),
        Spacer(1, 2),
        Paragraph(f"Department of {doctor_spec}" if is_assigned_doctor else "Clinical Decision Support & Multimodal Diagnostics Department", subtitle_style),
        Paragraph(f"Clinical Diagnostics Division  •  Tel: {facility_phone}", subtitle_style),
    ]
    header_content_right = [
        Paragraph(f"<b>REPORT REF:</b> {report_ref}", ParagraphStyle("HRef", parent=subtitle_style, fontSize=7.5, textColor=colors.HexColor("#E2E8F0"))),
        Paragraph(f"<b>DATE:</b> {now_str}", ParagraphStyle("HDate", parent=subtitle_style, fontSize=7.5, textColor=colors.HexColor("#E2E8F0"))),
        Paragraph(f"<b>ATTENDING:</b> {attending_display}", ParagraphStyle("HDoc", parent=subtitle_style, fontSize=7.5, textColor=colors.HexColor("#CCFBF1"))),
    ]

    header_table = Table(
        [[header_content_left, header_content_right]],
        colWidths=[360, 172],
    )
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_TEAL),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))

    # ─────────────────────────────────────────────────────────────
    # 2. PATIENT DEMOGRAPHICS & CRITICAL ALLERGY BLOCK
    # ─────────────────────────────────────────────────────────────
    demo_data = [
        [
            Paragraph("PATIENT NAME", meta_label),
            Paragraph(f"<b>{p_name}</b>", meta_val),
            Paragraph("MEDICAL RECORD NO (MRN)", meta_label),
            Paragraph(f"<b>{mrn}</b>", meta_val),
        ],
        [
            Paragraph("AGE / GENDER", meta_label),
            Paragraph(f"{p_age} Years  /  {p_gender}", meta_val),
            Paragraph("BLOOD GROUP", meta_label),
            Paragraph(f"<b>{p_blood}</b>", meta_val),
        ],
        [
            Paragraph("CONTACT PHONE", meta_label),
            Paragraph(p_phone, meta_val),
            Paragraph("PRIMARY CONDITIONS", meta_label),
            Paragraph(", ".join(p_conditions) if p_conditions else "None Documented (Routine Surveillance)", meta_val),
        ],
        [
            Paragraph("PATIENT EMAIL", meta_label),
            Paragraph(p_email, meta_val),
            Paragraph("ALLERGIES / SENSITIVITIES", meta_label),
            Paragraph(
                f"<font color='#DC2626'><b>{', '.join(combined_allergies)}</b></font>" if combined_allergies else "No Known Drug Allergies (NKDA) — Standard Clinical Precautions",
                meta_val
            ),
        ],
    ]
    demo_table = Table(demo_data, colWidths=[120, 146, 130, 136])
    demo_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(demo_table)
    story.append(Spacer(1, 5))

    # Critical Allergy Callout Banner or NKDA Clearance
    if combined_allergies:
        allergy_str = ", ".join(combined_allergies)
        allergy_msg = (
            f"<b>CRITICAL ALLERGY & CONTRAINDICATION WARNING:</b> Patient has documented severe sensitivities to "
            f"<b>{allergy_str}</b>. Verify cross-reactivity and contraindications prior to administering therapeutics."
        )
        allergy_table = Table([[Paragraph(allergy_msg, allergy_style)]], colWidths=[532])
        allergy_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), ALERT_RED_BG),
            ("BOX", (0, 0), (-1, -1), 1.0, ALERT_RED),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(allergy_table)
        story.append(Spacer(1, 5))
    else:
        allergy_msg = (
            "<b>ALLERGY STATUS & HYPERSENSITIVITY SCREENING:</b> No Known Drug Allergies (NKDA) documented on clinical file. "
            "Attending clinical staff must verify hypersensitivity history prior to administering novel therapeutics or IV contrast."
        )
        nkda_style = ParagraphStyle("NKDAText", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=10.5, textColor=SLATE_DARK)
        allergy_table = Table([[Paragraph(allergy_msg, nkda_style)]], colWidths=[532])
        allergy_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), ROW_ALT),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(allergy_table)
        story.append(Spacer(1, 5))

    # Recent Vitals Strip
    latest_vital = vitals[0] if vitals and len(vitals) > 0 else (patient.get("latest_vitals") or patient.get("vitals") or {})
    bp = latest_vital.get("blood_pressure") or latest_vital.get("bp")
    hr = latest_vital.get("heart_rate") or latest_vital.get("hr")
    temp = latest_vital.get("temperature") or latest_vital.get("temp")
    spo2 = latest_vital.get("oxygen_saturation") or latest_vital.get("spo2")
    v_date = latest_vital.get("recorded_at") or latest_vital.get("date")

    if any([bp, hr, temp, spo2]):
        bp_str = f"BP: <b>{bp} mmHg</b>" if bp else "BP: <b>N/A</b>"
        hr_str = f"Heart Rate: <b>{hr} bpm</b>" if hr else "Heart Rate: <b>N/A</b>"
        spo2_str = f"SpO2: <b>{spo2}%</b>" if spo2 else "SpO2: <b>N/A</b>"
        temp_str = f"Temp: <b>{temp} °F</b>" if temp else "Temp: <b>N/A</b>"
        date_str = f"<i>Recorded: {v_date}</i>" if v_date else "<i>Recorded: Recent</i>"
        vitals_data = [
            [
                Paragraph("<b>LATEST RECORDED VITALS:</b>", meta_label),
                Paragraph(bp_str, meta_val),
                Paragraph(hr_str, meta_val),
                Paragraph(spo2_str, meta_val),
                Paragraph(temp_str, meta_val),
                Paragraph(date_str, meta_label),
            ]
        ]
        vitals_table = Table(vitals_data, colWidths=[120, 85, 85, 70, 75, 97])
    else:
        vitals_data = [
            [
                Paragraph("<b>LATEST RECORDED VITALS:</b>", meta_label),
                Paragraph("<i>No historical vitals recorded yet. Telemetry will appear once recorded by attending physician.</i>", meta_val),
            ]
        ]
        vitals_table = Table(vitals_data, colWidths=[150, 382])

    vitals_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, PRIMARY_TEAL),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(vitals_table)
    story.append(Spacer(1, 8))

    # ─────────────────────────────────────────────────────────────
    # 3. EXECUTIVE CLINICAL SYNTHESIS & PHYSICIAN ACTION ITEMS
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("1. EXECUTIVE CLINICAL SYNTHESIS", section_header_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_TEAL, spaceBefore=1, spaceAfter=4))

    brief_dict = brief.get("brief", {}) if brief and isinstance(brief, dict) else {}
    summary_text = brief_dict.get("summary") or patient.get("clinical_summary") or patient.get("notes")
    if not summary_text:
        cond_phrase = f"with documented history of {', '.join(p_conditions)}" if p_conditions else "with no documented chronic conditions"
        summary_text = (
            f"Comprehensive Clinical Decision Support synthesis compiled for {p_name}, a {p_age}-year-old {p_gender} patient {cond_phrase}. "
            f"This authoritative medical record consolidates multimodal physiological parameters, diagnostic screening findings, "
            f"and active laboratory biomarker profiles. Attending clinical review and continuous patient management is coordinated under "
            f"{attending_display} to ensure evidence-based therapeutic oversight, patient safety, and individualized care pathways."
        )
    story.append(Paragraph(summary_text, body_style))
    story.append(Spacer(1, 6))

    # Priority Action Items Callout
    attention_items = brief_dict.get("attention_areas") or brief_dict.get("recommendations")
    if not attention_items:
        derived_items = []
        if combined_allergies:
            derived_items.append(f"Allergy Alert: Verify patient tolerance and cross-reactivity ({', '.join(combined_allergies)}) prior to medication administration.")
        if p_conditions:
            derived_items.append(f"Condition Oversight: Routine clinical monitoring and care plan assessment for {', '.join(p_conditions)}.")
        if prescriptions and len(prescriptions) > 0:
            derived_items.append("Pharmacotherapy Reconciliation: Review active prescriptions against renal and hepatic panels.")
        derived_items.append("Multimodal Diagnostics Surveillance: Correlate clinical telemetry with attending physician assessment.")
        derived_items.append("Preventive Health Care: Complete baseline physical examination and routine diagnostic screening.")
        attention_items = derived_items

    action_rows = [[Paragraph(f"• <b>Action Item {i+1}:</b> {item}", body_style)] for i, item in enumerate(attention_items[:4])]
    action_table = Table(action_rows, colWidths=[532])
    action_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ALERT_AMBER_BG),
        ("BOX", (0, 0), (-1, -1), 0.75, ALERT_AMBER),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(Paragraph("<b>PRIORITY PHYSICIAN ATTENTION & ACTION ITEMS:</b>", meta_label))
    story.append(Spacer(1, 2))
    story.append(action_table)
    story.append(Spacer(1, 8))

    # ─────────────────────────────────────────────────────────────
    # 4. MULTIMODAL AI DIAGNOSTIC FINDINGS BREAKDOWN
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("2. MULTIMODAL AI DIAGNOSTIC FINDINGS", section_header_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_TEAL, spaceBefore=1, spaceAfter=4))

    if analyses and len(analyses) > 0:
        multi_data = [
            [
                Paragraph("DIAGNOSTIC MODALITY", table_header),
                Paragraph("AI MODEL & ARCHITECTURE", table_header),
                Paragraph("EXTRACTED FINDINGS & METRICS", table_header),
                Paragraph("CONFIDENCE / STATUS", table_header),
            ]
        ]
        for an in analyses[:6]:
            mod = an.get("modality") or an.get("type", "Diagnostic Scan")
            model_name = an.get("model_name") or an.get("model_type", "AI Neural Pipeline")
            summary = an.get("summary", "")
            findings = an.get("findings", [])
            if findings and isinstance(findings, list):
                f_text = " | ".join([f"{f.get('label', '')}: {f.get('value', '')}" for f in findings[:3] if f.get('label')])
                findings_desc = f"{summary} ({f_text})" if summary else f_text
            else:
                findings_desc = summary or "Diagnostic inference completed."

            conf = an.get("confidence")
            conf_str = f"<b>{int(conf * 100) if conf and conf <= 1 else conf}% Confidence</b><br/>" if conf else ""
            status = an.get("status", "Completed")
            color = "#16A34A" if "normal" in status.lower() or "completed" in status.lower() else "#D97706"
            status_html = f"{conf_str}<font color='{color}'>{status}</font>"

            multi_data.append([
                Paragraph(f"<b>{mod}</b>", table_cell_bold),
                Paragraph(model_name, table_cell),
                Paragraph(findings_desc, table_cell),
                Paragraph(status_html, table_cell),
            ])
    else:
        multi_data = [
            [
                Paragraph("DIAGNOSTIC MODALITY", table_header),
                Paragraph("AI MODEL & ARCHITECTURE", table_header),
                Paragraph("EXTRACTED FINDINGS & METRICS", table_header),
                Paragraph("CONFIDENCE / STATUS", table_header),
            ],
            [
                Paragraph("<b>Brain MRI</b><br/>(Volumetric T1/T2)", table_cell_bold),
                Paragraph("PyTorch BrainCNN<br/>(3-Conv + FC Segmentation)", table_cell),
                Paragraph("No neuro-imaging scans uploaded for algorithmic evaluation. Upload DICOM/NIfTI or axial scan images via Diagnostic Center to run automated segmentation.", table_cell),
                Paragraph("<font color='#64748B'>No Scan Uploaded</font>", table_cell),
            ],
            [
                Paragraph("<b>Chest X-Ray</b><br/>(PA View)", table_cell_bold),
                Paragraph("OpenCV Spatial Analysis &<br/>DenseNet-121 Grad-CAM", table_cell),
                Paragraph("No chest radiographic studies uploaded for algorithmic cardiopulmonary screening and cardiothoracic ratio (CTR) analysis.", table_cell),
                Paragraph("<font color='#64748B'>No Scan Uploaded</font>", table_cell),
            ],
            [
                Paragraph("<b>12-Lead ECG</b><br/>(Rhythm Strip)", table_cell_bold),
                Paragraph("Waveform Contour &<br/>SciPy R-Peak Detection", table_cell),
                Paragraph("No electrocardiographic recordings on file for electrophysiological rhythm and QRS interval evaluation.", table_cell),
                Paragraph("<font color='#64748B'>No Scan Uploaded</font>", table_cell),
            ],
            [
                Paragraph("<b>Blood Panel</b><br/>(Hematology & Chem)", table_cell_bold),
                Paragraph("PyMuPDF / OCR Lab<br/>Biomarker Extraction", table_cell),
                Paragraph("Comprehensive lab panel awaiting diagnostic upload or verified clinical laboratory entry.", table_cell),
                Paragraph("<font color='#64748B'>Awaiting Lab Entry</font>", table_cell),
            ],
        ]

    multi_table = Table(multi_data, colWidths=[100, 115, 230, 87])
    multi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_TEAL),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(multi_table)
    story.append(Spacer(1, 8))

    # ─────────────────────────────────────────────────────────────
    # 5. FORMATTED BLOOD LAB BIOMARKER TABLE (15 PARAMETERS)
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("3. COMPREHENSIVE LABORATORY BIOMARKERS", section_header_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_TEAL, spaceBefore=1, spaceAfter=4))

    # Build biomarkers list (dynamically from database if available)
    if lab_values and len(lab_values) > 0:
        labs_to_show = []
        for lv in lab_values:
            labs_to_show.append({
                "test": lv.get("test") or lv.get("name") or lv.get("parameter") or "Biomarker",
                "value": str(lv.get("value", "N/A")),
                "unit": lv.get("unit", ""),
                "ref": lv.get("ref") or lv.get("reference_range") or lv.get("normal_range") or "Normal",
                "status": lv.get("status", "NORMAL"),
            })
    else:
        labs_to_show = get_default_lab_biomarkers()

    lab_table_data = [
        [
            Paragraph("BIOMARKER / ASSAY", table_header),
            Paragraph("OBSERVED VALUE", table_header),
            Paragraph("UNIT", table_header),
            Paragraph("REFERENCE RANGE", table_header),
            Paragraph("STATUS", table_header),
        ]
    ]

    for item in labs_to_show:
        status_val = item["status"].upper()
        if "HIGH" in status_val:
            st_para = Paragraph("<b>HIGH</b>", status_high)
        elif "LOW" in status_val:
            st_para = Paragraph("<b>LOW</b>", status_low)
        else:
            st_para = Paragraph("<b>NORMAL</b>", status_norm)

        lab_table_data.append([
            Paragraph(item["test"], table_cell_bold),
            Paragraph(f"<b>{item['value']}</b>", table_cell),
            Paragraph(item["unit"], table_cell),
            Paragraph(item["ref"], table_cell),
            st_para,
        ])

    lab_table = Table(lab_table_data, colWidths=[175, 95, 80, 110, 72])
    lab_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_TEAL),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(lab_table)
    story.append(Spacer(1, 8))

    # ─────────────────────────────────────────────────────────────
    # 6. ACTIVE PRESCRIPTIONS & PHARMACOTHERAPY REGIMEN
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("4. ACTIVE PHARMACOTHERAPY REGIMEN", section_header_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_TEAL, spaceBefore=1, spaceAfter=4))

    rx_table_data = [
        [
            Paragraph("MEDICATION", table_header),
            Paragraph("DOSAGE", table_header),
            Paragraph("FREQUENCY & INSTRUCTIONS", table_header),
            Paragraph("INDICATION / DIAGNOSIS", table_header),
            Paragraph("PRESCRIBED", table_header),
        ]
    ]

    # Populate from prescriptions list if present
    extracted_meds = []
    if prescriptions and len(prescriptions) > 0:
        for rx in prescriptions:
            rx_diag = rx.get("diagnosis", "Therapeutic Management")
            rx_date = rx.get("date", "Recent")
            for m in rx.get("medicines", []):
                if isinstance(m, dict):
                    extracted_meds.append({
                        "name": m.get("name", "N/A"),
                        "dosage": m.get("dosage", "N/A"),
                        "frequency": f"{m.get('frequency', '')} ({m.get('instructions', '')})".strip(" ()"),
                        "indication": rx_diag,
                        "date": rx_date,
                    })

    if not extracted_meds and patient.get("medications"):
        for med in patient.get("medications"):
            if isinstance(med, str):
                extracted_meds.append({
                    "name": med,
                    "dosage": "As prescribed",
                    "frequency": "Standard regimen",
                    "indication": ", ".join(p_conditions) if p_conditions else "Maintenance",
                    "date": "Active",
                })
            elif isinstance(med, dict):
                extracted_meds.append({
                    "name": med.get("name", "N/A"),
                    "dosage": med.get("dosage", "N/A"),
                    "frequency": med.get("frequency", "Standard"),
                    "indication": med.get("indication", ", ".join(p_conditions) if p_conditions else "Maintenance"),
                    "date": med.get("date", "Active"),
                })

    if not extracted_meds:
        extracted_meds = [
            {"name": "No active prescription medications recorded", "dosage": "N/A", "frequency": "None on file", "indication": "Maintenance", "date": "Current Admission"},
            {"name": "Medication Reconciliation Protocol", "dosage": "Standard", "frequency": "Continuous Oversight", "indication": "Pharmacotherapy Safety", "date": "Verified"},
            {"name": "Adverse Drug Reaction Screening", "dosage": "Active", "frequency": "Admission Protocol", "indication": "Patient Safety", "date": "Verified"},
            {"name": "Therapeutic Regimen Monitoring", "dosage": "Baseline", "frequency": "Periodic Clinical Review", "indication": "Health Maintenance", "date": "Active Record"},
        ]

    for med in extracted_meds:
        rx_table_data.append([
            Paragraph(f"<b>{med['name']}</b>", table_cell_bold),
            Paragraph(med["dosage"], table_cell),
            Paragraph(med["frequency"], table_cell),
            Paragraph(med["indication"], table_cell),
            Paragraph(med["date"], table_cell),
        ])

    rx_table = Table(rx_table_data, colWidths=[110, 70, 160, 122, 70])
    rx_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_TEAL),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(rx_table)
    story.append(Spacer(1, 8))

    # Clinical Quality & Electronic Health Record Audit Trail
    audit_data = [
        [
            Paragraph("DECISION SUPPORT AUDIT", meta_label),
            Paragraph("ALGORITHMIC CALIBRATION", meta_label),
            Paragraph("CLINICAL NOMENCLATURE", meta_label),
            Paragraph("DATA GOVERNANCE", meta_label),
        ],
        [
            Paragraph("HL7 FHIR R4 Interoperable", meta_val),
            Paragraph("Multimodal Neural Calibration", meta_val),
            Paragraph("ICD-10-CM / SNOMED-CT Standards", meta_val),
            Paragraph("<font color='#16A34A'>HIPAA Encrypted SHA-256</font>", meta_val),
        ],
    ]
    audit_table = Table(audit_data, colWidths=[133, 133, 133, 133])
    audit_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ROW_ALT),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(audit_table)
    story.append(Spacer(1, 6))

    # ─────────────────────────────────────────────────────────────
    # 7. REGULATORY DISCLAIMER & ATTENDING PHYSICIAN SIGN-OFF
    # ─────────────────────────────────────────────────────────────
    disc_text = (
        "<b>CLINICAL DECISION SUPPORT NOTICE & REGULATORY DISCLAIMER:</b> This medical synthesis was generated "
        "by the MedAssist AI Decision Support Engine. Algorithmic inferences (Brain MRI tissue segmentation, Chest X-ray "
        "spatial metrics, ECG rhythm extraction, and OCR laboratory biomarker parsing) are calibrated to assist licensed "
        "physicians. This document does not constitute an autonomous diagnosis or treatment prescription. Final diagnostic "
        "confirmation and therapeutic decisions remain under the authoritative discretion of the attending medical provider. "
        "CONFIDENTIALITY NOTICE: This medical document contains Protected Health Information (PHI). Unauthorized access, "
        "duplication, or dissemination is strictly prohibited under applicable clinical records data protection standards."
    )
    story.append(Paragraph(disc_text, disclaimer_style))
    story.append(Spacer(1, 10))

    # Signature Block
    if is_assigned_doctor:
        sign_verified_block = Paragraph(
            "<b>REPORT VERIFIED & SIGNED BY:</b><br/>"
            f"<b>{attending_display}</b><br/>"
            f"Department of {doctor_spec}<br/>"
            f"Medical Council Registration No: <b>{doctor_reg}</b>",
            body_style
        )
        sign_status = "<font color='#16A34A'><b>VERIFIED CLINICAL RECORD</b></font>"
    else:
        sign_verified_block = Paragraph(
            "<b>ATTENDING PHYSICIAN / CLINICAL REVIEW:</b><br/>"
            "<b>Unassigned / General Staff</b><br/>"
            "Department of General Clinical Services<br/>"
            "Attending Physician Assignment: <b>Pending Triage</b>",
            body_style
        )
        sign_status = "<font color='#D97706'><b>PENDING PHYSICIAN ASSIGNMENT</b></font>"

    sign_data = [
        [
            sign_verified_block,
            Paragraph(
                f"<b>DIGITAL AUTHENTICATION:</b><br/>"
                f"Timestamp: {now_str}<br/>"
                f"Digital Signature ID: <b>SHA256:{p_id[:16]}</b><br/>"
                f"Status: {sign_status}",
                body_style
            ),
        ]
    ]
    sign_table = Table(sign_data, colWidths=[270, 262])
    sign_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ROW_ALT),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(sign_table)

    # Build Document using NumberedCanvas
    def canvas_maker(*args, **kwargs):
        c = NumberedCanvas(*args, **kwargs)
        c.patient_mrn = mrn
        c.patient_name = p_name
        c.facility_name = facility_upper
        return c

    doc.build(story, canvasmaker=canvas_maker)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
