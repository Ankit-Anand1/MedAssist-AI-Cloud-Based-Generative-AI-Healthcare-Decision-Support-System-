import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from database import db
from routes import auth, patients, reports, prescriptions, appointments, doctor_notes, medical_history, ai_analysis, rag_ai, dashboard, doctors
from routes import settings as settings_route

logger = logging.getLogger("main")


async def _auto_seed():
    """Run seed logic when database is empty to populate it with demo data."""
    # Check if DB is already populated
    existing_user = await db.users.find_one({"email": "dr.priya@medcare.in"})
    if existing_user:
        logger.info("✓ Database already populated (dr.priya@medcare.in exists)")
        return

    logger.info("⏳ Auto-seeding database with demo data...")
    try:
        from seed import seed
        await seed()
        logger.info("✓ Auto-seed completed successfully")
        if db.is_mock:
            await db.persist_mock()
    except Exception as e:
        logger.error(f"⚠ Auto-seed failed: {e}", exc_info=True)
        # Seed minimal data so login works even if full seed fails
        await _seed_minimal()
        if db.is_mock:
            await db.persist_mock()


async def _seed_minimal():
    """Seed just enough data for login to work."""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # Doctor user
    doc_result = await db.users.insert_one({
        "email": "dr.priya@medcare.in",
        "name": "Dr. Priya Sharma",
        "role": "doctor",
        "password_hash": pwd_context.hash("password123"),
    })
    doc_user_id = str(doc_result.inserted_id)

    # Patient user
    pat_result = await db.users.insert_one({
        "email": "rajesh.kumar@email.com",
        "name": "Rajesh Kumar",
        "role": "patient",
        "password_hash": pwd_context.hash("password123"),
    })
    pat_user_id = str(pat_result.inserted_id)

    # Patient profile
    pat_profile = await db.patients.insert_one({
        "user_id": pat_user_id,
        "name": "Rajesh Kumar", "age": 45, "gender": "Male", "blood_group": "B+",
        "phone": "+91 99876 54321", "email": "rajesh.kumar@email.com",
        "address": "42 MG Road, Sector 15, Noida, UP 201301",
        "emergency_contact": "+91 98765 12345",
        "allergies": ["Penicillin"], "conditions": ["Type 2 Diabetes", "Hypertension"],
        "avatar": "", "last_visit": "2026-08-28", "next_appointment": "2026-09-12",
        "status": "Follow-up Due",
    })
    pat_id = str(pat_profile.inserted_id)

    # Doctor profile
    await db.doctors.insert_one({
        "user_id": doc_user_id,
        "name": "Dr. Priya Sharma",
        "specialization": "Neurologist",
        "qualification": "MBBS, MD (Neurology), DM",
        "phone": "+91 98765 43210",
        "email": "dr.priya@medcare.in",
        "avatar": "", "experience": 12,
        "hospital": "MedCare Multi-Specialty Hospital",
        "assigned_patients": [pat_id],
    })

    logger.info("✓ Minimal seed completed (doctor + 1 patient)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    await db.connect()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    print(f"✓ Connected to {'mock' if db.is_mock else 'real'} MongoDB")
    print(f"✓ Upload directory: {os.path.abspath(settings.UPLOAD_DIR)}")

    # Auto-seed if using mock DB or if DB is empty
    await _auto_seed()

    # Initialize RAG knowledge base (non-blocking)
    try:
        from rag.knowledge_base import knowledge_base
        knowledge_base.initialize()
        print(f"✓ RAG knowledge base: {knowledge_base.chunk_count} chunks indexed")
    except Exception as e:
        print(f"⚠ RAG knowledge base initialization skipped: {e}")

    yield
    await db.close()
    print("✓ Database connection closed")


app = FastAPI(
    title="MedAssist AI Backend",
    description="Healthcare Decision Support System API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for local dev (Safari compatibility)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Routes
app.include_router(auth.router)
app.include_router(doctors.router)
app.include_router(patients.router)
app.include_router(reports.router)
app.include_router(prescriptions.router)
app.include_router(appointments.router)
app.include_router(doctor_notes.router)
app.include_router(medical_history.router)
app.include_router(ai_analysis.router)
app.include_router(rag_ai.router)
app.include_router(dashboard.router)
app.include_router(settings_route.router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "MedAssist AI Backend",
        "version": "2.0.0",
        "database": "mock" if db.is_mock else "mongodb",
    }


@app.get("/api/users")
async def list_users(role: str = ""):
    query = {"role": role} if role else {}
    users = []
    async for u in db.users.find(query, {"password_hash": 0}):
        u["id"] = str(u.pop("_id"))
        users.append(u)
    return users


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
