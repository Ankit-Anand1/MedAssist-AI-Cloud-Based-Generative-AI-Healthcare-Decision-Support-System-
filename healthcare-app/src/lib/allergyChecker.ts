/**
 * Automated Drug-Allergy Contraindication Checker
 * Cross-checks entered medications against patient allergies, drug classes,
 * and high-risk pharmacological cross-sensitivities.
 */

export interface AllergyConflict {
  medicineName: string;
  matchedAllergy: string;
  drugClass: string;
  severity: 'CRITICAL' | 'HIGH';
  warningMessage: string;
  clinicalMechanism: string;
}

// Drug class knowledge base for cross-sensitivity detection
const DRUG_CLASS_CROSS_REACTIVITY: Record<string, {
  className: string;
  allergies: string[];
  medications: string[];
  mechanism: string;
  severity: 'CRITICAL' | 'HIGH';
}> = {
  penicillins: {
    className: 'Beta-Lactam / Penicillin Antibiotics',
    allergies: [
      'penicillin', 'penicillins', 'pencillin', 'pencillins', 'penecillin', 'penicilin',
      'amoxicillin', 'amoxcillin', 'amoxicilin', 'ampicillin', 'augmentin',
      'piperacillin', 'amoxil', 'clavamox', 'tazobactam', 'methicillin',
      'oxacillin', 'ampicillin-sulbactam', 'bicillin'
    ],
    medications: [
      'penicillin', 'pencillin', 'amoxicillin', 'amoxcillin', 'ampicillin', 'augmentin',
      'piperacillin', 'amoxil', 'clavamox', 'tazobactam', 'methicillin', 'oxacillin',
      'unasyn', 'zosyn', 'bicillin', 'ampicillin/sulbactam', 'amoxicillin-clavulanate'
    ],
    mechanism: 'Type I IgE-mediated hypersensitivity reaction risk. Poses high risk of acute anaphylaxis, bronchospasm, and severe urticaria.',
    severity: 'CRITICAL',
  },
  sulfonamides: {
    className: 'Sulfonamides (Sulfa Drugs)',
    allergies: [
      'sulfa', 'sulpha', 'sulfonamide', 'sulfonamides', 'sulfamethoxazole', 'bactrim',
      'septra', 'sulfasalazine', 'sulfadiazine', 'cotrimoxazole',
      'trimethoprim-sulfamethoxazole', 'dapsone'
    ],
    medications: [
      'bactrim', 'septra', 'sulfamethoxazole', 'sulfasalazine', 'sulfadiazine',
      'cotrimoxazole', 'dapsone', 'sulfisoxazole', 'silver sulfadiazine',
      'trimethoprim/sulfamethoxazole', 'trimethoprim-sulfamethoxazole'
    ],
    mechanism: 'Arylamine metabolite hypersensitivity. Poses severe risk of Stevens-Johnson syndrome (SJS), toxic epidermal necrolysis (TEN), and acute erythema multiforme.',
    severity: 'CRITICAL',
  },
  nsaids: {
    className: 'Non-Steroidal Anti-Inflammatory Drugs (NSAIDs)',
    allergies: [
      'nsaid', 'nsaids', 'aspirin', 'asprin', 'ibuprofen', 'ibuprophen', 'ibuprofin',
      'naproxen', 'diclofenac', 'ketorolac', 'celecoxib', 'meloxicam', 'indomethacin',
      'advil', 'motrin', 'aleve', 'toradol', 'voltaren'
    ],
    medications: [
      'ibuprofen', 'ibuprophen', 'aspirin', 'asprin', 'naproxen', 'diclofenac', 'ketorolac',
      'celecoxib', 'meloxicam', 'indomethacin', 'advil', 'motrin', 'aleve', 'toradol', 'voltaren',
      'etodolac', 'nabumetone', 'piroxicam', 'sulindac', 'mobic'
    ],
    mechanism: 'COX-1 inhibition leading to leukotriene shunting. Poses acute risk of aspirin-exacerbated respiratory disease (AERD), bronchospasm, and facial angioedema.',
    severity: 'HIGH',
  },
  cephalosporins: {
    className: 'Cephalosporin Antibiotics',
    allergies: [
      'cephalosporin', 'cephalosporins', 'cephalexin', 'keflex', 'ceftriaxone',
      'rocephin', 'cefuroxime', 'cefazolin', 'cefdinir', 'cefaclor'
    ],
    medications: [
      'cephalexin', 'keflex', 'ceftriaxone', 'rocephin', 'cefuroxime', 'cefazolin',
      'cefdinir', 'cefaclor', 'cefepime', 'ceftazidime', 'cefoxitin', 'cefpodoxime'
    ],
    mechanism: 'Beta-lactam ring cross-reactivity. Patients with severe penicillin or cephalosporin allergies share side-chain immunogenic cross-reactivity.',
    severity: 'HIGH',
  },
  opioids: {
    className: 'Opioid Analgesics',
    allergies: [
      'codeine', 'morphine', 'tramadol', 'oxycodone', 'hydrocodone', 'fentanyl'
    ],
    medications: [
      'codeine', 'morphine', 'tramadol', 'oxycodone', 'hydrocodone', 'fentanyl',
      'percocet', 'vicodin', 'tylenol #3', 'norco', 'ultram'
    ],
    mechanism: 'Mast-cell degranulation and opioid receptor hypersensitivity. May trigger respiratory depression, profound hypotension, and acute pruritus.',
    severity: 'HIGH',
  },
};

/**
 * Normalizes text for case-insensitive and punctuation-free matching,
 * including phonetic drug typo normalization.
 */
function normalize(str: string): string {
  let s = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Normalize common phonetic drug typos (e.g., Pencillin -> penicillin)
  s = s.replace(/pencill?i?n?/g, 'penicillin');
  s = s.replace(/penicil+in/g, 'penicillin');
  s = s.replace(/penecil+in/g, 'penicillin');
  s = s.replace(/amoxcill?i?n?/g, 'amoxicillin');
  s = s.replace(/amoxicil+in/g, 'amoxicillin');
  s = s.replace(/asprin/g, 'aspirin');
  s = s.replace(/ibuproph?e?i?n/g, 'ibuprofen');
  s = s.replace(/sulpha/g, 'sulfa');
  return s;
}

/**
 * Checks a list of medication names against patient's allergies and drug allergies.
 */
export function checkDrugContraindications(
  medicines: Array<{ name: string }>,
  patient: { allergies?: string[] | string; drug_allergies?: string[] | string } | null
): AllergyConflict[] {
  if (!patient || !medicines || medicines.length === 0) return [];

  // Parse all allergy terms
  const rawAllergies: string[] = [];
  if (Array.isArray(patient.allergies)) {
    rawAllergies.push(...patient.allergies);
  } else if (typeof patient.allergies === 'string' && patient.allergies.trim()) {
    rawAllergies.push(...patient.allergies.split(/[,;\n]+/).map(s => s.trim()));
  }

  if (Array.isArray(patient.drug_allergies)) {
    rawAllergies.push(...patient.drug_allergies);
  } else if (typeof patient.drug_allergies === 'string' && patient.drug_allergies.trim()) {
    rawAllergies.push(...patient.drug_allergies.split(/[,;\n]+/).map(s => s.trim()));
  }

  const cleanAllergies = rawAllergies
    .map(a => a.trim())
    .filter(a => a.length > 0 && a.toLowerCase() !== 'none' && a.toLowerCase() !== 'n/a');

  if (cleanAllergies.length === 0) return [];

  const conflicts: AllergyConflict[] = [];

  for (const med of medicines) {
    const medName = med.name.trim();
    if (!medName) continue;
    const medNorm = normalize(medName);

    // 1. Check known drug-class cross reactivities
    for (const key of Object.keys(DRUG_CLASS_CROSS_REACTIVITY)) {
      const cls = DRUG_CLASS_CROSS_REACTIVITY[key];

      // Check if med belongs to this class
      const medMatchesClass = cls.medications.some(m => medNorm.includes(normalize(m)));

      if (medMatchesClass) {
        // Check if patient has any allergy from this class
        const matchedAllergy = cleanAllergies.find(allergy => {
          const allgNorm = normalize(allergy);
          return cls.allergies.some(a => allgNorm.includes(normalize(a)) || normalize(a).includes(allgNorm));
        });

        if (matchedAllergy) {
          conflicts.push({
            medicineName: medName,
            matchedAllergy: matchedAllergy,
            drugClass: cls.className,
            severity: cls.severity,
            warningMessage: `Patient has documented allergy to "${matchedAllergy}". "${medName}" is a member of the ${cls.className} family.`,
            clinicalMechanism: cls.mechanism,
          });
          continue; // Handled this medicine
        }
      }
    }

    // 2. Direct name / substring matching for non-class or specific drug allergies
    const directMatch = cleanAllergies.find(allergy => {
      const allgNorm = normalize(allergy);
      if (allgNorm.length < 3) return false;
      return medNorm.includes(allgNorm) || allgNorm.includes(medNorm);
    });

    if (directMatch && !conflicts.some(c => c.medicineName === medName)) {
      conflicts.push({
        medicineName: medName,
        matchedAllergy: directMatch,
        drugClass: 'Direct Medication Hypersensitivity',
        severity: 'CRITICAL',
        warningMessage: `Direct allergy match detected: Patient has recorded allergy to "${directMatch}" which matches prescribed "${medName}".`,
        clinicalMechanism: 'Documented patient-specific adverse drug reaction. Prescribing may trigger immediate hypersensitivity response.',
      });
    }
  }

  return conflicts;
}

