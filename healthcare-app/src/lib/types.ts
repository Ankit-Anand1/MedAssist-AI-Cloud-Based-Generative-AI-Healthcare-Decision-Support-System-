export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: string;
  allergies: string[];
  conditions: string[];
  avatar: string;
  lastVisit: string;
  nextAppointment: string;
  status: 'Active' | 'Follow-up Due' | 'Stable';
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  phone: string;
  email: string;
  avatar: string;
  experience: number;
  hospital: string;
}

export interface VitalSign {
  date: string;
  bloodPressure: string;
  heartRate: number;
  temperature: number;
  oxygenSaturation: number;
  glucose: number;
  weight: number;
}

export interface MedicalReport {
  id: string;
  patientId: string;
  patient_id?: string;
  type: 'Brain MRI' | 'X-ray' | 'ECG' | 'Blood Test' | 'Medical Report';
  title: string;
  date: string;
  file_url?: string;
  file_name?: string;
  status: 'Pending' | 'AI Processing' | 'AI Analyzed' | 'AI Analysis Failed' | 'Unsupported File' | 'Reviewed' | 'Flagged' | 'Error';
  processing_status?: string;
  aiConfidence?: number;
  ai_confidence?: number;
  findings?: string[];
  summary?: string;
  doctorNotes?: string;
  doctor_notes?: string;
  urgency: 'Normal' | 'Moderate' | 'High' | 'Critical';
}

export interface AIAnalysisResult {
  id?: string;
  reportId?: string;
  report_id?: string;
  patient_id?: string;
  type: MedicalReport['type'];
  modality?: string;
  modelName?: string;
  model_name?: string;
  modelType?: string;
  model_type?: string;
  confidence: number;
  findings: Finding[];
  summary: string;
  recommendations: string[];
  output_image_url?: string;
  processedAt?: string;
  processed_at?: string;
  status: 'Completed' | 'Processing' | 'Error';
  error_message?: string;
}

export interface Finding {
  label: string;
  value: string;
  status: 'Normal' | 'Abnormal' | 'Critical' | 'Borderline';
  detail?: string;
}

export interface LabValue {
  id?: string;
  patient_id?: string;
  report_id?: string;
  name: string;
  value: number | null;
  unit: string;
  referenceRange?: string;
  reference_range?: string;
  status: 'Normal' | 'Low' | 'High' | 'Critical' | 'Not determined';
  extraction_note?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  date: string;
  medicines: Medicine[];
  notes: string;
  followUpDate: string;
  status: 'Active' | 'Completed' | 'Draft';
  diagnosis: string;
}

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  type: 'Consultation' | 'Follow-up' | 'Emergency' | 'Report Review';
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'In Progress';
  notes?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'alert';
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: 'diagnosis' | 'prescription' | 'report' | 'visit' | 'surgery';
}

export interface ResearchEvidence {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  doi: string;
  relevance: string;
  summary: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ResearchEvidence[];
  timestamp: string;
}

export interface AIPatientBrief {
  patientInfo: {
    name: string;
    age: number;
    gender: string;
    bloodGroup: string;
    conditions: string[];
  };
  symptoms: string[];
  medicalHistory: TimelineEvent[];
  currentReports: {
    type: string;
    date: string;
    keyFindings: string[];
  }[];
  mriFindings: string[];
  xrayFindings: string[];
  ecgFindings: string[];
  bloodReportAbnormalities: string[];
  previousPrescriptions: string[];
  importantObservations: string[];
  relevantEvidence: ResearchEvidence[];
  generatedAt: string;
}

// ── Phase 4: Generated Brief Types ──

export interface GeneratedBrief {
  patient_id: string;
  brief: BriefContent | null;
  rag_sources: RAGSource[];
  generation_status: string;
  error_message: string;
  generated_at: string;
  disclaimer: string;
}

export interface BriefContent {
  patient_overview: string;
  symptoms: string[];
  relevant_medical_history: string;
  recent_reports: { type: string; date: string; key_findings: string[] }[];
  ai_model_findings: {
    mri: string[];
    xray: string[];
    ecg: string[];
    blood_test: string[];
  };
  important_abnormalities: string[];
  relevant_evidence: { source_title: string; document_type: string; relevant_excerpt: string }[];
  attention_areas: string[];
  follow_up_considerations: string[];
  summary: string;
}

export interface RAGSource {
  source_title: string;
  source_file: string;
  document_type: string;
  relevance_score: number;
  content_snippet: string;
}

export interface CopilotResponse {
  response: string;
  sources: {
    source_title: string;
    document_type: string;
    content_snippet: string;
  }[];
  disclaimer: string;
}

