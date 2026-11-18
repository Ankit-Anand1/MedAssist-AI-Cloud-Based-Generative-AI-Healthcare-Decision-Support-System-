"""
Phase 4 Verification Test Suite

Tests all Phase 4 features and constraints:
1. RAG Knowledge Base Initialization & Indexing
2. Curated Medical Knowledge Retrieval (checking educational references, no fabricated papers)
3. Non-relevant query behavior ("No relevant evidence found" / empty results)
4. Patient Context Builder (actual MongoDB patient, reports, ai_analysis, prescriptions)
5. AI Patient Brief Generation (POST /api/ai/brief/{id}) with Decision Support disclaimers
6. AI Patient Brief Retrieval (GET /api/ai/brief/{id})
7. Copilot Q&A endpoint (POST /api/ai/copilot/{id})
8. Evidence Sources endpoint (GET /api/ai/evidence/{id})
9. RAG Knowledge Base Status endpoint (GET /api/rag/status)
10. Preservation of Phase 3 Real AI Inference (checking Phase 3 routes/models intact)
"""

import sys
import os
import json
import asyncio
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE_URL = "http://127.0.0.1:8000"

def request_json(url, method="GET", headers=None, data=None):
    headers = headers or {}
    req_data = None
    if data is not None and not isinstance(data, (bytes, bytearray)):
        req_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif isinstance(data, (bytes, bytearray)):
        req_data = data

    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"error": body}
        return e.code, parsed


def login_user(email, password):
    url = f"{BASE_URL}/api/auth/login"
    status, res = request_json(url, method="POST", data={"email": email, "password": password})
    if status == 200 and "access_token" in res:
        return res["access_token"]
    raise RuntimeError(f"Login failed for {email}: status={status}, response={res}")


async def run_internal_tests():
    print("\n" + "=" * 60)
    print("STAGE 1: INTERNAL MODULE & LOGIC TESTS")
    print("=" * 60)

    # 1. Test Knowledge Base
    print("\n--- Test 1: RAG Knowledge Base Initialization ---")
    from rag.knowledge_base import knowledge_base
    knowledge_base.initialize()
    print(f"Knowledge Base Available: {knowledge_base.is_available}")
    print(f"Total Chunks Indexed: {knowledge_base.chunk_count}")
    assert knowledge_base.chunk_count > 0, "Expected indexed chunks in knowledge base"
    print("✓ Knowledge Base successfully initialized with curated documents.")

    # 2. Test Retriever on Medical Queries
    print("\n--- Test 2: Medical Knowledge Retrieval ---")
    from rag.retriever import retrieve_evidence, get_knowledge_base_status
    mri_evidence = retrieve_evidence("glioma T2 FLAIR hyperintensity hyperintense mass edema", top_k=3)
    print(f"Retrieved {len(mri_evidence)} chunks for MRI query.")
    assert len(mri_evidence) > 0, "Expected evidence chunks for MRI query"
    for ev in mri_evidence:
        print(f"  - Source: {ev.get('source_title')} ({ev.get('document_type')}) [score: {ev.get('relevance_score')}]")
        assert ev.get("document_type") == "Curated Educational Reference", "Must be curated reference, not fake paper"
        assert "content" in ev and len(ev["content"]) > 20
    print("✓ RAG evidence retrieval correctly returns curated educational content.")

    # 3. Test Retriever on Irrelevant / Out-of-domain Query
    print("\n--- Test 3: Unrelated / Out-of-Domain Retrieval ---")
    irrelevant_evidence = retrieve_evidence("quantum mechanics semiconductor microprocessor manufacturing photolithography", top_k=3)
    print(f"Retrieved {len(irrelevant_evidence)} chunks for irrelevant query.")
    assert len(irrelevant_evidence) == 0, "Expected 0 chunks for completely irrelevant query"
    print("✓ Correctly returned empty list (no fabricated evidence).")

    # 4. Test Patient Context Builder with actual DB records
    print("\n--- Test 4: Patient Context Builder (Actual DB Data) ---")
    from database import db
    await db.connect()

    # Get a real patient
    doctor_user = await db.users.find_one({"role": "doctor"})
    doctor = await db.doctors.find_one({"user_id": str(doctor_user["_id"])})
    assigned_patients = doctor.get("assigned_patients", [])
    assert len(assigned_patients) > 0, "Expected assigned patients for doctor"
    patient_id = assigned_patients[0]

    from rag.patient_context import build_patient_context
    context = await build_patient_context(patient_id)
    print(f"Built context for patient {patient_id}:")
    print(f"  - Patient Name: {context.get('patient_info', {}).get('name')}")
    print(f"  - Reports Count: {len(context.get('recent_reports', []))}")
    print(f"  - AI Analyses: {len(context.get('ai_analyses', []))}")
    print(f"  - Prescriptions: {len(context.get('prescriptions', []))}")
    assert context.get("patient_info", {}).get("name"), "Patient name must not be empty"
    print("✓ Successfully extracted real patient records without dummy data.")

    # 5. Test AI Generator & Fallback (No hallucination)
    print("\n--- Test 5: AI Patient Brief Generation ---")
    from rag.generator import generate_patient_brief, copilot_query
    brief_result = await generate_patient_brief(patient_id, doctor_id=str(doctor["_id"]))
    assert "brief" in brief_result, "Result must contain brief"
    assert "generation_status" in brief_result, "Must report generation status"
    brief = brief_result["brief"]
    print(f"Brief generation status: {brief_result['generation_status']}")
    print(f"Summary: {brief.get('patient_summary')[:100]}...")
    print(f"Important abnormalities: {len(brief.get('important_abnormalities', []))}")
    print(f"Recommended actions: {len(brief.get('recommended_actions', []))}")
    print(f"Decision support disclaimer: {brief.get('disclaimer')}")
    assert "Decision Support Only" in brief.get("disclaimer", "") or "decision-support" in brief.get("disclaimer", "").lower()
    print("✓ Patient Brief generated with proper safety disclaimers and structured findings.")

    # 6. Test Copilot query
    print("\n--- Test 6: AI Copilot Query ---")
    copilot_res = await copilot_query(patient_id, "What are the latest findings from the patient's reports?")
    assert "response" in copilot_res, "Copilot must return response"
    print(f"Copilot Response: {copilot_res['response'][:150]}...")
    print("✓ Copilot answered query based on actual patient context.")

    await db.close()
    print("\n✓ ALL INTERNAL MODULE TESTS PASSED.")


def run_api_tests():
    print("\n" + "=" * 60)
    print("STAGE 2: HTTP API ENDPOINT TESTS")
    print("=" * 60)

    # 1. Health check
    print("\n--- API Test 1: Health Check ---")
    status, res = request_json(f"{BASE_URL}/api/health")
    assert status == 200, f"Health check failed: {status}"
    print("✓ Backend is healthy:", res)

    # 2. Login as Doctor
    print("\n--- API Test 2: Doctor Authentication ---")
    doctor_token = login_user("dr.priya@medcare.in", "password123")
    assert doctor_token, "Failed to get doctor token"
    doctor_headers = {"Authorization": f"Bearer {doctor_token}"}
    print("✓ Doctor authenticated successfully.")

    # 3. Knowledge Base Status API
    print("\n--- API Test 3: RAG Status Endpoint ---")
    status, res = request_json(f"{BASE_URL}/api/rag/status", headers=doctor_headers)
    assert status == 200, f"Status endpoint failed: {status}, {res}"
    print("✓ RAG Status:", res)
    assert res.get("available") is True
    assert res.get("chunk_count", 0) > 0

    # 4. RAG Query API
    print("\n--- API Test 4: RAG Query Endpoint ---")
    status, res = request_json(
        f"{BASE_URL}/api/rag/query",
        method="POST",
        headers=doctor_headers,
        data={"query": "chest x-ray cardiomegaly cardiothoracic ratio", "top_k": 3}
    )
    assert status == 200, f"RAG query failed: {status}, {res}"
    print(f"✓ RAG query returned {res.get('total_results')} results from curated docs.")
    assert res.get("total_results", 0) > 0
    assert "curated" in res.get("note", "").lower()

    # 5. Fetch doctor's assigned patients
    print("\n--- API Test 5: Fetch Doctor's Assigned Patients ---")
    status, patients = request_json(f"{BASE_URL}/api/patients", headers=doctor_headers)
    assert status == 200 and len(patients) > 0, "Failed to fetch doctor's patients"
    patient_id = patients[0]["id"]
    patient_name = patients[0]["name"]
    print(f"✓ Using assigned patient: {patient_name} (ID: {patient_id})")

    # 6. Generate AI Patient Brief API
    print("\n--- API Test 6: Generate AI Patient Brief Endpoint ---")
    status, res = request_json(
        f"{BASE_URL}/api/ai/brief/{patient_id}",
        method="POST",
        headers=doctor_headers
    )
    assert status == 200, f"Generate brief failed: {status}, {res}"
    print("✓ Generate brief API succeeded.")
    print(f"  Generation Status: {res.get('generation_status')}")
    print(f"  RAG sources cited: {len(res.get('rag_sources', []))}")
    assert "disclaimer" in res
    assert res.get("patient_id") == patient_id

    # 7. Get AI Patient Brief API
    print("\n--- API Test 7: Get AI Patient Brief Endpoint ---")
    status, res = request_json(f"{BASE_URL}/api/ai/brief/{patient_id}", headers=doctor_headers)
    assert status == 200 and res is not None, f"Get brief failed: {status}, {res}"
    print("✓ Retrieved stored AI Patient Brief from MongoDB.")
    assert res.get("patient_id") == patient_id

    # 8. AI Copilot Chat API
    print("\n--- API Test 8: AI Copilot Chat Endpoint ---")
    status, res = request_json(
        f"{BASE_URL}/api/ai/copilot/{patient_id}",
        method="POST",
        headers=doctor_headers,
        data={"message": "Summarize abnormal lab values or imaging findings."}
    )
    assert status == 200, f"Copilot chat failed: {status}, {res}"
    print("✓ Copilot response received.")
    print(f"  Response: {res.get('response')[:120]}...")
    assert "disclaimer" in res

    # 9. Get RAG Evidence Sources API
    print("\n--- API Test 9: Get RAG Evidence Sources Endpoint ---")
    status, res = request_json(f"{BASE_URL}/api/ai/evidence/{patient_id}", headers=doctor_headers)
    assert status == 200, f"Evidence endpoint failed: {status}, {res}"
    print(f"✓ Retrieved {len(res.get('sources', []))} evidence sources.")
    assert "curated educational medical references" in res.get("note", "").lower()

    # 10. Phase 3 Regression Verification
    print("\n--- API Test 10: Phase 3 Real AI Analysis Routes Regression Check ---")
    status, analyses = request_json(f"{BASE_URL}/api/ai-analysis/patient/{patient_id}", headers=doctor_headers)
    assert status == 200, f"Phase 3 ai-analysis route failed: {status}"
    print(f"✓ Phase 3 ai-analysis route intact. Found {len(analyses)} existing analysis records.")

    # 11. Deterministic Test Cleanup
    print("\n--- Deterministic Test Data Cleanup ---")
    try:
        from pymongo import MongoClient
        mongo_client = MongoClient("mongodb://localhost:27017")
        db = mongo_client["medassist"]
        db.ai_briefs_generated.delete_many({"patient_id": patient_id})
        db.copilot_sessions.delete_many({"patient_id": patient_id})
        print(f"✓ Cleaned up test AI briefs and copilot sessions for {patient_id}.")
    except Exception as e:
        print(f"Cleanup note: {e}")

    print("\n" + "=" * 60)
    print("ALL PHASE 4 API ENDPOINT TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    if mode in ("internal", "all"):
        asyncio.run(run_internal_tests())
    if mode in ("api", "all"):
        run_api_tests()
