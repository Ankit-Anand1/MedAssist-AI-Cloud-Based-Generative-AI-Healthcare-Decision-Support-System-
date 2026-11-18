"""
Blood Report OCR and Structured Laboratory Biomarker Parser.
"""

from ai.blood.analyzer import BloodReportAnalyzer, BLOOD_PARAMETERS

async def parse_blood_report(file_path: str, upload_dir: str = "./uploads"):
    analyzer = BloodReportAnalyzer(upload_dir=upload_dir)
    return await analyzer.analyze(file_path, "application/pdf")

