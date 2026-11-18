"""
Brain MRI Segmentation Module.
Provides BrainCNN model and MRIAnalyzer with PyTorch inference and tissue segmentation.
"""

from ai.mri.analyzer import BrainCNN, MRIAnalyzer, CLASS_NAMES, CLASS_COLORS, PATCH_SIZE

async def analyze_mri_segmentation(file_path: str, upload_dir: str = "./uploads"):
    analyzer = MRIAnalyzer(upload_dir=upload_dir)
    return await analyzer.analyze(file_path, "image/png")

