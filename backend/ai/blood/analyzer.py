"""
Blood Report Analyzer — Structured Extraction from PDFs and Images.

Extracts common blood test values from uploaded PDF reports using:
1. PyMuPDF (fitz) for text-based PDF extraction
2. Regex patterns for structured value parsing
3. Built-in reference ranges for status classification

Supported parameters:
  Hemoglobin, WBC, RBC, Platelets, Glucose (Fasting/Random),
  HbA1c, Cholesterol (Total/HDL/LDL), Creatinine, Urea/BUN,
  TSH, ALT/SGPT, AST/SGOT, Bilirubin

Does NOT make medical diagnoses. Classifies as Normal/High/Low based
on standard reference ranges only.
"""

import os
import re
import logging
from pathlib import Path

from ai.common import (
    BaseAnalyzer,
    AnalysisResponse,
    Finding,
    LabValueResult,
    safe_analyze,
)

logger = logging.getLogger("ai.blood")

# ── Reference ranges (adult, general) ──
# Each entry: (name, aliases, unit, low, high, critical_low, critical_high)
BLOOD_PARAMETERS = [
    {
        "name": "Hemoglobin",
        "aliases": ["haemoglobin", "hgb", "hb"],
        "unit": "g/dL",
        "low": 12.0, "high": 17.5,
        "critical_low": 7.0, "critical_high": 20.0,
    },
    {
        "name": "WBC",
        "aliases": ["white blood cell", "white blood cells", "wbc count", "total wbc",
                     "total leucocyte count", "tlc", "leukocyte"],
        "unit": "×10³/µL",
        "low": 4.0, "high": 11.0,
        "critical_low": 2.0, "critical_high": 30.0,
    },
    {
        "name": "RBC",
        "aliases": ["red blood cell", "red blood cells", "rbc count", "total rbc",
                     "erythrocyte"],
        "unit": "×10⁶/µL",
        "low": 4.0, "high": 6.0,
        "critical_low": 2.5, "critical_high": 7.5,
    },
    {
        "name": "Platelets",
        "aliases": ["platelet count", "plt", "thrombocyte"],
        "unit": "×10³/µL",
        "low": 150.0, "high": 400.0,
        "critical_low": 50.0, "critical_high": 1000.0,
    },
    {
        "name": "Glucose (Fasting)",
        "aliases": ["fasting glucose", "fasting blood sugar", "fbs", "fasting blood glucose",
                     "glucose fasting", "blood sugar fasting"],
        "unit": "mg/dL",
        "low": 70.0, "high": 100.0,
        "critical_low": 40.0, "critical_high": 400.0,
    },
    {
        "name": "Glucose (Random)",
        "aliases": ["random glucose", "random blood sugar", "rbs", "blood glucose",
                     "glucose", "blood sugar"],
        "unit": "mg/dL",
        "low": 70.0, "high": 140.0,
        "critical_low": 40.0, "critical_high": 500.0,
    },
    {
        "name": "HbA1c",
        "aliases": ["glycated hemoglobin", "glycosylated hemoglobin", "a1c",
                     "hba1c", "hemoglobin a1c"],
        "unit": "%",
        "low": 4.0, "high": 5.7,
        "critical_low": None, "critical_high": 10.0,
    },
    {
        "name": "Total Cholesterol",
        "aliases": ["cholesterol", "total cholesterol", "serum cholesterol", "tc"],
        "unit": "mg/dL",
        "low": 0.0, "high": 200.0,
        "critical_low": None, "critical_high": 300.0,
    },
    {
        "name": "HDL Cholesterol",
        "aliases": ["hdl", "hdl-c", "hdl cholesterol", "high density lipoprotein"],
        "unit": "mg/dL",
        "low": 40.0, "high": 200.0,
        "critical_low": 20.0, "critical_high": None,
    },
    {
        "name": "LDL Cholesterol",
        "aliases": ["ldl", "ldl-c", "ldl cholesterol", "low density lipoprotein"],
        "unit": "mg/dL",
        "low": 0.0, "high": 100.0,
        "critical_low": None, "critical_high": 190.0,
    },
    {
        "name": "Creatinine",
        "aliases": ["serum creatinine", "creat", "s.creatinine", "s. creatinine"],
        "unit": "mg/dL",
        "low": 0.6, "high": 1.2,
        "critical_low": None, "critical_high": 4.0,
    },
    {
        "name": "Urea",
        "aliases": ["blood urea", "bun", "blood urea nitrogen", "serum urea",
                     "s.urea", "s. urea"],
        "unit": "mg/dL",
        "low": 7.0, "high": 20.0,
        "critical_low": None, "critical_high": 100.0,
    },
    {
        "name": "TSH",
        "aliases": ["thyroid stimulating hormone", "serum tsh", "s.tsh"],
        "unit": "mIU/L",
        "low": 0.4, "high": 4.0,
        "critical_low": 0.1, "critical_high": 10.0,
    },
    {
        "name": "ALT/SGPT",
        "aliases": ["alt", "sgpt", "alanine aminotransferase", "alanine transaminase",
                     "s.alt", "s. alt"],
        "unit": "U/L",
        "low": 0.0, "high": 40.0,
        "critical_low": None, "critical_high": 200.0,
    },
    {
        "name": "AST/SGOT",
        "aliases": ["ast", "sgot", "aspartate aminotransferase", "aspartate transaminase",
                     "s.ast", "s. ast"],
        "unit": "U/L",
        "low": 0.0, "high": 40.0,
        "critical_low": None, "critical_high": 200.0,
    },
    {
        "name": "Total Bilirubin",
        "aliases": ["bilirubin", "total bilirubin", "serum bilirubin", "s.bilirubin"],
        "unit": "mg/dL",
        "low": 0.1, "high": 1.2,
        "critical_low": None, "critical_high": 5.0,
    },
]


def _extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file using PyMuPDF."""
    text = ""
    try:
        import pymupdf
        doc = pymupdf.open(file_path)
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
    except ImportError:
        logger.warning("PyMuPDF not installed. Cannot extract text from PDF.")
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
    return text


def _extract_text_from_image(file_path: str) -> str:
    """Attempt OCR on image files. Falls back gracefully if tesseract unavailable."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(file_path)
        return pytesseract.image_to_string(img)
    except ImportError:
        logger.warning("pytesseract not installed — skipping OCR.")
        return ""
    except Exception as e:
        logger.warning(f"OCR failed: {e}")
        return ""


def _parse_value(text: str, param: dict) -> LabValueResult | None:
    """
    Search for a blood parameter in extracted text using regex.
    Returns a LabValueResult or None if not found.
    """
    all_names = [param["name"].lower()] + [a.lower() for a in param["aliases"]]

    for name in all_names:
        # Build regex: parameter name, optional separators, then a number
        escaped_name = re.escape(name)
        # Allow for : , spaces, tabs between name and value
        pattern = rf"{escaped_name}[\s:=\-,]*(\d+\.?\d*)"
        matches = re.findall(pattern, text.lower())

        if matches:
            try:
                value = float(matches[0])

                # Try to find reference range near the value
                ref_pattern = rf"{escaped_name}.*?(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)"
                ref_matches = re.findall(ref_pattern, text.lower())
                ref_range = ""
                if ref_matches:
                    ref_range = f"{ref_matches[0][0]} - {ref_matches[0][1]} {param['unit']}"

                # Try to find unit in text
                unit_text = param["unit"]
                unit_pattern = rf"{escaped_name}.*?{re.escape(str(value))}[\s]*([a-zA-Z/%×µ³⁶·]+)"
                unit_matches = re.findall(unit_pattern, text.lower())
                if unit_matches:
                    found_unit = unit_matches[0].strip()
                    if len(found_unit) > 1:
                        unit_text = found_unit

                # Determine status
                status = "Normal"
                if param.get("critical_low") is not None and value < param["critical_low"]:
                    status = "Critical"
                elif param.get("critical_high") is not None and value > param["critical_high"]:
                    status = "Critical"
                elif value < param["low"]:
                    status = "Low"
                elif value > param["high"]:
                    status = "High"

                return LabValueResult(
                    name=param["name"],
                    value=value,
                    unit=unit_text if unit_text else param["unit"],
                    reference_range=ref_range if ref_range else f"{param['low']} - {param['high']} {param['unit']}",
                    status=status,
                    raw_text=matches[0],
                )
            except (ValueError, IndexError):
                continue

    return None


class BloodReportAnalyzer(BaseAnalyzer):
    """Blood report extraction from PDFs and images."""

    MODALITY = "Blood Test"
    MODEL_NAME = "Structured Extraction Engine"
    MODEL_TYPE = "Rule-based + Regex Parser"

    def __init__(self, upload_dir: str = "./uploads"):
        self.upload_dir = upload_dir

    def is_available(self) -> bool:
        """Always available — regex parsing doesn't require external models."""
        return True

    @safe_analyze
    async def analyze(
        self, file_path: str, file_type: str, report_id: str, patient_id: str
    ) -> AnalysisResponse:
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()

        # Extract text based on file type
        text = ""
        if ext == ".pdf" or file_type == "application/pdf":
            text = _extract_text_from_pdf(file_path)
            if not text.strip():
                # Fallback to OCR for scanned PDFs
                text = _extract_text_from_image(file_path)
        elif ext in [".jpg", ".jpeg", ".png", ".bmp"]:
            text = _extract_text_from_image(file_path)

        if not text.strip():
            return AnalysisResponse(
                modality="Blood Test",
                model_name=self.MODEL_NAME,
                model_type=self.MODEL_TYPE,
                confidence=0.0,
                findings=[],
                summary="Unable to extract readable text from this document. Please ensure the uploaded file is a valid PDF report.",
                status="Unsupported File",
                error_message="Unable to extract readable text from the uploaded document.",
            )

        # Parse parameters from extracted text
        lab_values: list[LabValueResult] = []
        extracted_count = 0
        abnormal_count = 0

        for param in BLOOD_PARAMETERS:
            result = _parse_value(text, param)
            if result:
                lab_values.append(result)
                extracted_count += 1
                if result.status in ("High", "Low", "Critical"):
                    abnormal_count += 1

        if extracted_count == 0:
            return AnalysisResponse(
                modality="Blood Test",
                model_name=self.MODEL_NAME,
                model_type=self.MODEL_TYPE,
                confidence=0.0,
                findings=[],
                summary="No standard clinical laboratory parameters were detected in the extracted text.",
                status="Unsupported File",
                error_message="No recognized laboratory test parameters were found in the document. Please ensure it contains standard blood panel text.",
            )

        # Build findings ONLY from genuinely extracted values (no placeholder findings)
        findings = []
        for lv in lab_values:
            findings.append(Finding(
                label=lv.name,
                value=f"{lv.value} {lv.unit}",
                status="Normal" if lv.status == "Normal" else "Abnormal" if lv.status in ("High", "Low") else "Critical" if lv.status == "Critical" else "Borderline",
                detail=f"Reference: {lv.reference_range}. Status: {lv.status}.",
            ))

        total_params = len(BLOOD_PARAMETERS)
        confidence = min(98.0, round((extracted_count / total_params * 100) + 20.0, 1))

        # Summary
        summary_parts = [
            f"Blood report analysis completed. Extracted {extracted_count}/{total_params} parameters.",
        ]
        if abnormal_count > 0:
            summary_parts.append(f"{abnormal_count} value(s) outside reference range.")
        else:
            summary_parts.append("All extracted values within reference range.")
        summary_parts.append("AI-assisted extraction — requires physician review.")

        recommendations = []
        for lv in lab_values:
            if lv.status == "Critical":
                recommendations.append(
                    f"CRITICAL: {lv.name} = {lv.value} {lv.unit} — immediate clinical attention advised."
                )
            elif lv.status in ("High", "Low"):
                recommendations.append(
                    f"{lv.name} is {lv.status.lower()} ({lv.value} {lv.unit}) — clinical correlation recommended."
                )

        if not recommendations:
            recommendations.append("All extracted values within normal reference ranges.")
        recommendations.append("Verify extracted values against original report document.")

        return AnalysisResponse(
            modality="Blood Test",
            model_name=self.MODEL_NAME,
            model_type=self.MODEL_TYPE,
            confidence=round(confidence, 1),
            findings=findings,
            summary=" ".join(summary_parts),
            recommendations=recommendations,
            lab_values=lab_values,
        )


# Alias for convenience
BloodAnalyzer = BloodReportAnalyzer

