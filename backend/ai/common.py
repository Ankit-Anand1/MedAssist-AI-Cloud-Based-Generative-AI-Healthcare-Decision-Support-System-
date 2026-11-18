"""
Common interfaces and utilities shared across all AI modality analyzers.
"""

import os
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

logger = logging.getLogger("ai.common")


@dataclass
class Finding:
    """A single finding from AI analysis."""
    label: str
    value: str
    status: str  # Normal | Abnormal | Critical | Borderline
    detail: Optional[str] = None


@dataclass
class LabValueResult:
    """Extracted lab value from blood report."""
    name: str
    value: Optional[float] = None
    unit: str = ""
    reference_range: str = ""
    status: str = "Not determined"  # Normal | Low | High | Critical | Not determined
    raw_text: str = ""
    extraction_note: str = ""


@dataclass
class AnalysisResponse:
    """Standardized response from any modality analyzer."""
    modality: str
    model_name: str
    model_type: str
    confidence: float
    findings: list[Finding] = field(default_factory=list)
    summary: str = ""
    recommendations: list[str] = field(default_factory=list)
    output_image_url: str = ""
    lab_values: list[LabValueResult] = field(default_factory=list)
    status: str = "Completed"  # Completed | Error
    error_message: str = ""
    processed_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


class BaseAnalyzer(ABC):
    """Abstract base class for all modality analyzers."""

    @abstractmethod
    async def analyze(
        self, file_path: str, file_type: str = "", report_id: str = "", patient_id: str = ""
    ) -> AnalysisResponse:
        """
        Run inference on the given file.

        Args:
            file_path: Absolute path to the uploaded file.
            file_type: MIME type of the file.
            report_id: Database ID of the report.
            patient_id: Database ID of the patient.

        Returns:
            AnalysisResponse with findings, confidence, etc.
        """
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the model/dependencies are available."""
        ...


def safe_analyze(func):
    """
    Decorator that wraps analyzer.analyze() with error handling.
    Catches all exceptions and returns an error AnalysisResponse with explicit
    'Unsupported File' or 'AI Analysis Failed' status instead of propagating stack traces.
    """
    async def wrapper(self, file_path: str, file_type: str = "", report_id: str = "", patient_id: str = ""):
        try:
            return await func(self, file_path, file_type, report_id, patient_id)
        except ValueError as e:
            logger.warning(f"Validation error during analysis: {e}")
            return AnalysisResponse(
                modality=getattr(self, "MODALITY", "Unknown"),
                model_name=getattr(self, "MODEL_NAME", "Unknown"),
                model_type=getattr(self, "MODEL_TYPE", "Unknown"),
                confidence=0.0,
                status="Unsupported File",
                error_message=str(e),
            )
        except FileNotFoundError as e:
            logger.error(f"File not found during analysis: {e}")
            return AnalysisResponse(
                modality=getattr(self, "MODALITY", "Unknown"),
                model_name=getattr(self, "MODEL_NAME", "Unknown"),
                model_type=getattr(self, "MODEL_TYPE", "Unknown"),
                confidence=0.0,
                status="AI Analysis Failed",
                error_message="The uploaded file could not be found for processing.",
            )
        except Exception as e:
            logger.error(f"Analysis failed: {type(e).__name__}: {e}", exc_info=True)
            return AnalysisResponse(
                modality=getattr(self, "MODALITY", "Unknown"),
                model_name=getattr(self, "MODEL_NAME", "Unknown"),
                model_type=getattr(self, "MODEL_TYPE", "Unknown"),
                confidence=0.0,
                status="AI Analysis Failed",
                error_message=f"AI analysis could not be completed: {str(e)}",
            )
    return wrapper


def validate_image_file(file_path: str, allowed_extensions: list[str] | None = None) -> bool:
    """Check that the file exists, has a valid image extension, and is readable by PIL."""
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    if allowed_extensions:
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in allowed_extensions:
            raise ValueError(
                f"Unsupported file format '{ext}'. Accepted formats: {', '.join(allowed_extensions)}"
            )
    try:
        from PIL import Image
        with Image.open(file_path) as img:
            img.verify()
    except Exception as e:
        raise ValueError(f"Incompatible or corrupted image file: {e}")
    return True
