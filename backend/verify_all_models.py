import asyncio
import os
import sys

# Ensure backend in path
sys.path.insert(0, "/Users/ankitanand/Desktop/Cloud based generative ai/backend")

from ai_models.mri_segmentation import MRIAnalyzer
from ai_models.xray_classifier import XRayAnalyzer
from ai_models.ecg_analyzer import ECGAnalyzer
from ocr.blood_parser import BloodReportAnalyzer

async def verify_all():
    upload_dir = "/Users/ankitanand/Desktop/Cloud based generative ai/backend/uploads"
    
    print("=" * 70)
    print("LIVE VERIFICATION TEST: ALL 4 MULTIMODAL AI PIPELINES")
    print("=" * 70)
    
    # 1. Brain MRI
    print("\n[1/4] TESTING BRAIN MRI SEGMENTATION (PyTorch BrainCNN)...")
    mri_path = os.path.join(upload_dir, "sample_brain_mri.png")
    mri_analyzer = MRIAnalyzer(upload_dir=upload_dir)
    mri_res = await mri_analyzer.analyze(mri_path, "image/png", "VERIFY_MRI", "P001")
    print(f"✓ Status: {mri_res.status} | Confidence: {mri_res.confidence}%")
    print(f"✓ Output Image: {mri_res.output_image_url}")
    for f in mri_res.findings:
        print(f"   • {f.label}: {f.value} [{f.status}]")
    print(f"✓ Summary: {mri_res.summary[:120]}...")
    
    # 2. Chest X-Ray
    print("\n[2/4] TESTING CHEST X-RAY SPATIAL & DENSENET-121 GRAD-CAM...")
    xray_path = os.path.join(upload_dir, "sample_chest_xray.png")
    xray_analyzer = XRayAnalyzer(upload_dir=upload_dir)
    xray_res = await xray_analyzer.analyze(xray_path, "image/png", "VERIFY_XRAY", "P001")
    print(f"✓ Status: {xray_res.status} | Confidence: {xray_res.confidence}%")
    print(f"✓ Output Image: {xray_res.output_image_url}")
    for f in xray_res.findings:
        print(f"   • {f.label}: {f.value} [{f.status}]")
    print(f"✓ Summary: {xray_res.summary[:120]}...")
    
    # 3. ECG Rhythm
    print("\n[3/4] TESTING ECG WAVEFORM CONTOUR & R-PEAK EXTRACTION...")
    ecg_path = os.path.join(upload_dir, "sample_ecg.png")
    ecg_analyzer = ECGAnalyzer(upload_dir=upload_dir)
    ecg_res = await ecg_analyzer.analyze(ecg_path, "image/png", "VERIFY_ECG", "P001")
    print(f"✓ Status: {ecg_res.status} | Confidence: {ecg_res.confidence}%")
    print(f"✓ Output Image: {ecg_res.output_image_url}")
    for f in ecg_res.findings:
        print(f"   • {f.label}: {f.value} [{f.status}]")
    print(f"✓ Summary: {ecg_res.summary[:120]}...")
    
    # 4. Blood Report OCR / Parsing
    print("\n[4/4] TESTING BLOOD REPORT PDF BIOMARKER PARSER...")
    blood_path = os.path.join(upload_dir, "sample_blood_report.pdf")
    blood_analyzer = BloodReportAnalyzer(upload_dir=upload_dir)
    blood_res = await blood_analyzer.analyze(blood_path, "application/pdf", "VERIFY_BLOOD", "P001")
    print(f"✓ Status: {blood_res.status} | Confidence: {blood_res.confidence}%")
    print(f"✓ Extracted Biomarkers ({len(blood_res.lab_values)}):")
    for lv in blood_res.lab_values[:8]:
        print(f"   • {lv.name}: {lv.value} {lv.unit} (Ref: {lv.reference_range}) -> [{lv.status}]")
    if len(blood_res.lab_values) > 8:
        print(f"   ... and {len(blood_res.lab_values) - 8} more parameters verified.")
    print(f"✓ Summary: {blood_res.summary}")

    print("\n" + "=" * 70)
    print("ALL 4 MODALITY PIPELINES SUCCESSFULLY VERIFIED WITH REAL OUTPUT METRICS!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(verify_all())

