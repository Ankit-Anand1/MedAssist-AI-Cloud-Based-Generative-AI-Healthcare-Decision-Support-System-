'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'hi';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation & Groups
    'nav.dashboard': 'AI Clinical Dashboard',
    'dashboard': 'Clinical Dashboard',
    'nav.analysis': 'AI Analysis',
    'aiAnalysis': 'AI Analysis',
    'nav.brief': 'AI Patient Brief',
    'patientBrief': 'AI Patient Brief',
    'nav.evidence': 'Evidence & Knowledge',
    'evidence': 'Evidence & Knowledge',
    'nav.patients': 'Patients',
    'patients': 'Patients',
    'nav.reports': 'Reports',
    'reports': 'Reports',
    'clinicalReports': 'Clinical Reports',
    'myReports': 'My Reports',
    'nav.my_reports': 'My Reports',
    'nav.prescriptions': 'Prescriptions',
    'prescriptions': 'Prescriptions',
    'newPrescription': 'New Prescription',
    'nav.appointments': 'Appointments',
    'appointments': 'Appointments',
    'nav.architecture': 'System Architecture',
    'systemArchitecture': 'System Architecture',
    'nav.settings': 'Settings & System Preferences',
    'settings': 'Settings',
    'nav.health_history': 'Health History',
    'healthHistory': 'Health History',
    'nav.profile': 'Profile',
    'profile': 'My Profile',
    'nav.group.clinical_ai': 'Clinical AI',
    'nav.group.patient_care': 'Patient Care',
    'nav.group.workflow': 'Workflow',
    'nav.group.system': 'System',
    'sidebar.decision_support': 'Clinical Decision',
    'sidebar.ai_subtext': 'AI Decision Support System',
    'sidebar.footer_title': 'Clinical Decision Support',
    'sidebar.footer_subtitle': 'Final decisions remain with the physician',

    // Header
    'header.search_placeholder': 'Search patients, reports, prescriptions...',
    'searchPlaceholder': 'Search patients, reports, prescriptions...',
    'header.notifications': 'Notifications',
    'notifications': 'Notifications',
    'header.mark_all_read': 'Mark all as read',
    'markAllRead': 'Mark all as read',
    'header.no_notifications': 'No new notifications',
    'header.logout': 'Logout',
    'logout': 'Logout',
    'header.profile': 'My Profile',
    'header.settings': 'Settings',
    'header.doctor_role': 'Attending Physician',
    'header.patient_role': 'Patient Portal',

    // Dashboard
    'dashboard.title': 'Clinical Decision Support',
    'dashboard.tag': 'AI-Powered CDSS',
    'dashboard.subtitle': 'Multimodal decision support for clinical review',
    'dashboard.active_patients': 'Active Patients',
    'activePatients': 'Active Patients',
    'dashboard.inferences_overview': 'Multimodal Inferences Overview',
    'dashboard.total_inferences': 'Total Inferences',
    'totalInferences': 'Total Inferences',
    'dashboard.brain_mri': 'Brain MRI',
    'brainMri': 'Brain MRI',
    'dashboard.chest_xray': 'Chest X-Ray',
    'chestXray': 'Chest X-Ray',
    'dashboard.ecg': 'ECG Rhythm',
    'ecgRhythm': 'ECG Rhythm',
    'dashboard.blood_report': 'Blood Report',
    'bloodReport': 'Blood Report',
    'dashboard.view_scans': 'View Scans',
    'dashboard.view_traces': 'View Traces',
    'dashboard.view_labs': 'View Labs',
    'dashboard.patient_brief_card_title': 'AI PATIENT BRIEF',
    'dashboard.patient_brief_desc': 'RAG-grounded longitudinal patient synthesis',
    'dashboard.copilot_card_title': 'HEALTHCARE AI COPILOT',
    'dashboard.copilot_desc': 'Conversational clinical decision companion',
    'dashboard.launch_copilot': 'Launch AI Copilot',
    'dashboard.open_brief': 'Open AI Patient Brief',
    'dashboard.pending_reviews': 'Reports Pending Physician Review',
    'pendingReviews': 'Reports Pending Review',
    'dashboard.clinical_alerts': 'Clinical Alerts',
    'clinicalAlerts': 'Clinical Alerts',
    'dashboard.scheduled_consultations': 'Scheduled Patient Consultations',
    'scheduledConsultations': 'Scheduled Consultations',
    'dashboard.disclaimer': 'Decision Support Only • Final clinical diagnosis, prescription, and judgment remain under physician authority.',

    // Common Buttons & Actions
    'btn.save_changes': 'Save Changes',
    'save': 'Save',
    'btn.cancel': 'Cancel',
    'cancel': 'Cancel',
    'btn.close': 'Close',
    'close': 'Close',
    'btn.delete': 'Delete',
    'btn.add_patient': 'Add Patient',
    'btn.onboard_patient': 'Onboard Patient',
    'btn.new_appointment': 'New Appointment',
    'btn.new_prescription': 'New Prescription',
    'btn.mark_reviewed': 'Mark as Reviewed',
    'btn.reviewed_validated': 'Clinically Reviewed & Validated',
    'btn.generate_brief': 'Generate AI Brief',
    'btn.generating': 'Generating...',
    'btn.refresh': 'Refresh',
    'refresh': 'Refresh',
    'btn.print': 'Print Prescription',
    'print': 'Print',
    'btn.filter': 'Filter',
    'btn.view_all': 'View All',
    'viewAll': 'View All',
    'btn.complete_apt': 'Mark Completed',
    'btn.cancel_apt': 'Cancel Appointment',
    'uploadReport': 'Upload Report',
    'actions': 'Actions',
    'status': 'Status',
    'date': 'Date',
    'patient': 'Patient',
    'modality': 'Modality',
    'urgency': 'Urgency',
    'report': 'Report',
    'all': 'All',

    // Telemetry & Vitals
    'bloodPressure': 'Blood Pressure',
    'heartRate': 'Heart Rate',
    'oxygenSaturation': 'SpO₂ Oxygen',
    'bloodGlucose': 'Blood Glucose',

    // Statuses
    'status.active': 'Active',
    'status.stable': 'Stable',
    'status.followup_due': 'Follow-up Due',
    'status.pending': 'Pending',
    'status.ai_processing': 'AI Processing',
    'status.ai_analyzed': 'AI Analyzed',
    'status.reviewed': 'Reviewed',
    'status.flagged': 'Flagged',
    'status.scheduled': 'Scheduled',
    'status.completed': 'Completed',
    'status.cancelled': 'Cancelled',
    'status.normal': 'Normal',
    'status.borderline': 'Borderline',
    'status.critical': 'Critical',
    'status.high': 'High',
    'status.low': 'Low',

    // Modalities
    'modality.all': 'All',
    'modality.mri': 'Brain MRI',
    'modality.xray': 'Chest X-ray',
    'modality.ecg': 'ECG',
    'modality.blood': 'Blood Test',
    'modality.medical_report': 'Medical Report',

    // Settings page
    'settings.title': 'Settings & System Preferences',
    'settings.subtitle': 'Manage clinical profile, localization, theme mode, and real-time alert preferences',
    'settings.physician_profile': 'Physician Profile',
    'settings.full_name': 'Full Name',
    'settings.specialization': 'Specialization',
    'settings.email': 'Email',
    'settings.phone': 'Contact Phone',
    'settings.hospital': 'Hospital / Clinical Institution',
    'settings.theme_appearance': 'Localization & Theme Appearance',
    'settings.color_scheme': 'Color Scheme',
    'settings.display_language': 'Display Language',
    'settings.notifications': 'Notification & Alert Preferences',
    'settings.saved_toast': 'Settings saved successfully!',
  },
  hi: {
    // Navigation & Groups
    'nav.dashboard': 'एआई नैदानिक डैशबोर्ड',
    'dashboard': 'नैदानिक डैशबोर्ड',
    'nav.analysis': 'एआई विश्लेषण',
    'aiAnalysis': 'एआई विश्लेषण',
    'nav.brief': 'एआई रोगी सारांश',
    'patientBrief': 'एआई रोगी सारांश',
    'nav.evidence': 'साक्ष्य एवं ज्ञान',
    'evidence': 'साक्ष्य एवं ज्ञान',
    'nav.patients': 'मरीज़',
    'patients': 'मरीज़',
    'nav.reports': 'रिपोर्ट्स',
    'reports': 'रिपोर्ट्स',
    'clinicalReports': 'नैदानिक रिपोर्ट्स',
    'myReports': 'मेरी रिपोर्ट्स',
    'nav.my_reports': 'मेरी रिपोर्ट्स',
    'nav.prescriptions': 'नुस्खे (दवाइयाँ)',
    'prescriptions': 'नुस्खे (दवाइयाँ)',
    'newPrescription': 'नया नुस्खा लिखें',
    'nav.appointments': 'अपॉइंटमेंट्स',
    'appointments': 'अपॉइंटमेंट्स',
    'nav.architecture': 'सिस्टम संरचना',
    'systemArchitecture': 'सिस्टम संरचना',
    'nav.settings': 'सेटिंग्स एवं प्राथमिकताएं',
    'settings': 'सेटिंग्स',
    'nav.health_history': 'स्वास्थ्य इतिहास',
    'healthHistory': 'स्वास्थ्य इतिहास',
    'nav.profile': 'मेरी प्रोफ़ाइल',
    'profile': 'मेरी प्रोफ़ाइल',
    'nav.group.clinical_ai': 'नैदानिक एआई',
    'nav.group.patient_care': 'रोगी देखभाल',
    'nav.group.workflow': 'कार्यप्रवाह',
    'nav.group.system': 'सिस्टम',
    'sidebar.decision_support': 'नैदानिक निर्णय',
    'sidebar.ai_subtext': 'एआई निर्णय सहायता प्रणाली',
    'sidebar.footer_title': 'नैदानिक निर्णय सहायता',
    'sidebar.footer_subtitle': 'अंतिम निर्णय चिकित्सक के अधिकार में रहेगा',

    // Header
    'header.search_placeholder': 'मरीज़, रिपोर्ट, नुस्खे खोजें...',
    'searchPlaceholder': 'मरीज़, रिपोर्ट, नुस्खे खोजें...',
    'header.notifications': 'सूचनाएं',
    'notifications': 'सूचनाएं',
    'header.mark_all_read': 'सभी को पढ़ा हुआ चिह्नित करें',
    'markAllRead': 'सभी को पढ़ा हुआ चिह्नित करें',
    'header.no_notifications': 'कोई नई सूचना नहीं',
    'header.logout': 'लॉग आउट',
    'logout': 'लॉग आउट',
    'header.profile': 'मेरी प्रोफ़ाइल',
    'header.settings': 'सेटिंग्स',
    'header.doctor_role': 'उपचारक चिकित्सक',
    'header.patient_role': 'मरीज़ पोर्टल',

    // Dashboard
    'dashboard.title': 'नैदानिक निर्णय सहायता प्रणाली',
    'dashboard.tag': 'एआई-संचालित सीडीएसएस',
    'dashboard.subtitle': 'नैदानिक समीक्षा हेतु मल्टीमॉडल निर्णय सहायता प्रणाली',
    'dashboard.active_patients': 'सक्रिय मरीज़',
    'activePatients': 'सक्रिय मरीज़',
    'dashboard.inferences_overview': 'मल्टीमॉडल विश्लेषण अवलोकन',
    'dashboard.total_inferences': 'कुल विश्लेषण',
    'totalInferences': 'कुल विश्लेषण',
    'dashboard.brain_mri': 'ब्रेन एमआरआई',
    'brainMri': 'ब्रेन एमआरआई',
    'dashboard.chest_xray': 'चेस्ट एक्स-रे',
    'chestXray': 'चेस्ट एक्स-रे',
    'dashboard.ecg': 'ईसीजी रिदम',
    'ecgRhythm': 'ईसीजी रिदम',
    'dashboard.blood_report': 'रक्त रिपोर्ट',
    'bloodReport': 'रक्त रिपोर्ट',
    'dashboard.view_scans': 'स्कैन देखें',
    'dashboard.view_traces': 'तरंगें देखें',
    'dashboard.view_labs': 'लैब देखें',
    'dashboard.patient_brief_card_title': 'एआई रोगी सारांश',
    'dashboard.patient_brief_desc': 'रैग-आधारित व्यापक रोगी स्वास्थ्य सारांश',
    'dashboard.copilot_card_title': 'स्वास्थ्य एआई कोपायलट',
    'dashboard.copilot_desc': 'संवादात्मक नैदानिक निर्णय सहायक साथी',
    'dashboard.launch_copilot': 'कोपायलट शुरू करें',
    'dashboard.open_brief': 'रोगी सारांश खोलें',
    'dashboard.pending_reviews': 'समीक्षा हेतु लंबित रिपोर्ट्स',
    'pendingReviews': 'लंबित समीक्षाएं',
    'dashboard.clinical_alerts': 'नैदानिक चेतावनियाँ',
    'clinicalAlerts': 'नैदानिक चेतावनियाँ',
    'dashboard.scheduled_consultations': 'निर्धारित परामर्श',
    'scheduledConsultations': 'निर्धारित परामर्श',
    'dashboard.disclaimer': 'केवल निर्णय सहायता हेतु • अंतिम नैदानिक निदान और उपचार निर्णय चिकित्सक के अधिकार क्षेत्र में है।',

    // Common Buttons & Actions
    'btn.save_changes': 'परिवर्तन सहेजें',
    'save': 'सहेजें',
    'btn.cancel': 'रद्द करें',
    'cancel': 'रद्द करें',
    'btn.close': 'बंद करें',
    'close': 'बंद करें',
    'btn.delete': 'हटाएं',
    'btn.add_patient': 'नया मरीज़ जोड़ें',
    'btn.onboard_patient': 'मरीज़ ऑनबोर्ड करें',
    'btn.new_appointment': 'नया अपॉइंटमेंट',
    'btn.new_prescription': 'नया नुस्खा',
    'btn.mark_reviewed': 'समीक्षित चिह्नित करें',
    'btn.reviewed_validated': 'समीक्षित एवं सत्यापित',
    'btn.generate_brief': 'एआई सारांश बनाएं',
    'btn.generating': 'बनाया जा रहा है...',
    'btn.refresh': 'ताज़ा करें',
    'refresh': 'ताज़ा करें',
    'btn.print': 'नुस्खा प्रिंट करें',
    'print': 'प्रिंट करें',
    'btn.filter': 'फ़िल्टर',
    'btn.view_all': 'सभी देखें',
    'viewAll': 'सभी देखें',
    'btn.complete_apt': 'पूर्ण चिह्नित करें',
    'btn.cancel_apt': 'अपॉइंटमेंट रद्द करें',
    'uploadReport': 'रिपोर्ट अपलोड करें',
    'actions': 'कार्रवाई',
    'status': 'स्थिति',
    'date': 'दिनांक',
    'patient': 'मरीज़',
    'modality': 'जांच का प्रकार',
    'urgency': 'प्राथमिकता',
    'report': 'रिपोर्ट',
    'all': 'सभी',

    // Telemetry & Vitals
    'bloodPressure': 'रक्तचाप (BP)',
    'heartRate': 'हृदय गति (HR)',
    'oxygenSaturation': 'ऑक्सीजन (SpO₂)',
    'bloodGlucose': 'ब्लड शुगर (Glucose)',

    // Statuses
    'status.active': 'सक्रिय',
    'status.stable': 'स्थिर',
    'status.followup_due': 'फॉलो-अप देय',
    'status.pending': 'लंबित',
    'status.ai_processing': 'एआई प्रोसेसिंग',
    'status.ai_analyzed': 'एआई विश्लेषित',
    'status.reviewed': 'समीक्षित',
    'status.flagged': 'फ्लैग किया गया',
    'status.scheduled': 'निर्धारित',
    'status.completed': 'पूर्ण',
    'status.cancelled': 'रद्द',
    'status.normal': 'सामान्य',
    'status.borderline': 'सीमावर्ती',
    'status.critical': 'गंभीर',
    'status.high': 'उच्च',
    'status.low': 'निम्न',

    // Modalities
    'modality.all': 'सभी',
    'modality.mri': 'ब्रेन एमआरआई',
    'modality.xray': 'एक्स-रे',
    'modality.ecg': 'ईसीजी',
    'modality.blood': 'रक्त परीक्षण',
    'modality.medical_report': 'चिकित्सा रिपोर्ट',

    // Settings page
    'settings.title': 'सेटिंग्स एवं सिस्टम प्राथमिकताएं',
    'settings.subtitle': 'नैदानिक प्रोफ़ाइल, भाषा, थीम मोड और अलर्ट प्राथमिकताएं प्रबंधित करें',
    'settings.physician_profile': 'चिकित्सक प्रोफ़ाइल',
    'settings.full_name': 'पूरा नाम',
    'settings.specialization': 'विशेषज्ञता',
    'settings.email': 'ईमेल पता',
    'settings.phone': 'संपर्क फ़ोन',
    'settings.hospital': 'अस्पताल / संस्थान',
    'settings.theme_appearance': 'भाषा एवं थीम प्रकटन',
    'settings.color_scheme': 'रंग योजना',
    'settings.display_language': 'प्रदर्शित भाषा',
    'settings.notifications': 'सूचना एवं चेतावनी प्राथमिकताएं',
    'settings.saved_toast': 'सेटिंग्स सफलतापूर्वक सहेजी गईं!',
  },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('medassist_lang') as Language | null;
      if (stored && (stored === 'en' || stored === 'hi')) {
        setLangState(stored);
      }
    } catch {}
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('medassist_lang', newLang);
      // Dispatch custom event to let components react immediately
      window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: newLang } }));
    } catch {}
  };

  const toggleLang = () => {
    const next = lang === 'en' ? 'hi' : 'en';
    setLang(next);
  };

  const t = (key: string, fallback?: string): string => {
    const dict = translations[lang] || translations.en;
    
    // 1. Direct key match
    if (dict[key]) {
      return dict[key];
    }
    
    // 2. Check prefix alternatives: e.g. 'nav.dashboard' -> 'dashboard', or 'dashboard' -> 'nav.dashboard'
    const withoutPrefix = key.includes('.') ? key.split('.').pop()! : null;
    if (withoutPrefix && dict[withoutPrefix]) {
      return dict[withoutPrefix];
    }

    // 3. Fallback to English dictionary
    if (translations.en[key]) {
      return translations.en[key];
    }
    if (withoutPrefix && translations.en[withoutPrefix]) {
      return translations.en[withoutPrefix];
    }

    // 4. Custom fallback or original key
    return fallback !== undefined ? fallback : key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
