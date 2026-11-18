"""
ECG Rhythm Analyzer & Waveform Contour R-Peak Extraction.
"""

from ai.ecg.analyzer import ECGAnalyzer, _extract_and_analyze_ecg_trace

async def analyze_ecg(file_path: str, upload_dir: str = "./uploads"):
    analyzer = ECGAnalyzer(upload_dir=upload_dir)
    return await analyzer.analyze(file_path, "image/png")

