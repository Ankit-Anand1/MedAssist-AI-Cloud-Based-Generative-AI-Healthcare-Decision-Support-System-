# MedAssist AI — Healthcare Decision Support System

**MedAssist AI** is an AI-powered healthcare web application designed to help both doctors and patients. It helps doctors review scans, check lab reports, and write clinical notes faster, while translating complex medical terms into simple, easy-to-understand language for patients.

---

## 1. Key Features

### 🩺 Separate Portals for Doctors & Patients

* **Doctor Portal (`/doctor`)**:
  * **Dashboard Overview**: View total patients, pending medical scans, critical lab alerts, and upcoming appointments in one place.
  * **Private Patient Lists**: Each doctor only sees their own assigned patients.
  * **AI Scan Review**: Inspect AI predictions and confidence scores for uploaded medical scans.
  * **One-Click Clinical Briefs**: Automatically summarize a patient's medical history, vitals, lab tests, and scan results.
  * **Safe Prescription Writing**: Write prescriptions with automatic warnings for drug allergies and medication conflicts.
  * **Medical Literature Search**: Quickly look up clinical guidelines and research papers for rare conditions.
  * **Appointment Calendar**: Manage in-person, follow-up, and online consultations.

* **Patient Portal (`/patient`)**:
  * **Personal Health Dashboard**: Check your assigned doctor, latest vital signs, and upcoming visits.
  * **Simple Medical Explanations**: Translates complicated medical reports and diagnoses into plain, everyday language.
  * **Health Tracking Charts**: Track blood pressure, heart rate, blood sugar, and oxygen levels over time.
  * **Easy Report Uploads**: Upload PDF lab reports or medical scan images directly from your device.
  * **Doctor Selection & Booking**: Choose a specialist (such as a Cardiologist or Neurologist) when registering and booking visits.

---

### 🧠 Built-in AI Medical Analysis

The backend uses trained deep learning (PyTorch) models and OCR tools to analyze medical records:
* **Brain MRI Scans**: Checks scans for signs of Glioma, Meningioma, Pituitary tumors, or normal results.
* **Chest X-Rays**: Detects signs of pneumonia, lung infiltrations, or normal chest structure.
* **ECG Heart Waveforms**: Analyzes heart rhythms to help spot irregular heartbeats (arrhythmias).
* **Blood Test Reports (`blood_parser.py`)**: Reads uploaded blood test PDFs/images, extracts key values (like HbA1c, glucose, platelets, and cholesterol), and highlights any results outside normal ranges.

---

### 📚 Medical Knowledge Assistant (RAG & Copilot)

* **Verified Medical Knowledge Base**: Uses a vector database (ChromaDB) loaded with medical guidelines and drug safety rules so the AI gives accurate, grounded answers.
* **24/7 AI Health Copilot**: Helps doctors with diagnostic questions and drug checks, and helps patients understand their health and prepare for appointments.
* **Downloadable PDF Reports**: Generates clean, printable PDF clinical summaries with doctor details and clinic headers.

---

## 2. How It Works & Technologies Used

```text
                        ┌──────────────────────────────────────┐
                        │   Frontend (Next.js 16 + React 19)   │
                        │   Tailwind CSS 4 + Framer Motion     │
                        └──────────────────┬───────────────────┘
                                           │ REST API (JWT Login)
                                           ▼
                        ┌──────────────────────────────────────┐
                        │       Backend Server (FastAPI)       │
                        │       Python 3.13 + Pydantic         │
                        └──────┬───────────────────────┬───────┘
                               │                       │
           ┌───────────────────┴──────────┐   ┌────────┴───────────────────┐
           ▼                              ▼   ▼                            ▼
┌──────────────────────┐  ┌─────────────────┐ ┌───────────────┐ ┌──────────────┐
│  Medical AI Models   │  │  AI Chat & RAG  │ │   Database    │ │ File Storage │
│  PyTorch, Pillow     │  │ ChromaDB        │ │ MongoDB       │ │ Uploaded     │
│  MRI/X-Ray/ECG/Blood │  │ Gemini / OpenAI │ │ (+ Local JSON)│ │ PDFs & Scans │
└──────────────────────┘  └─────────────────┘ └───────────────┘ └──────────────┘
