"""
Chest X-Ray Spatial Analysis & DenseNet-121 Grad-CAM Classifier.
"""

from ai.xray.analyzer import XRayAnalyzer, _analyze_lung_fields_spatial

async def analyze_chest_xray(file_path: str, upload_dir: str = "./uploads"):
    analyzer = XRayAnalyzer(upload_dir=upload_dir)
    return await analyzer.analyze(file_path, "image/png")

