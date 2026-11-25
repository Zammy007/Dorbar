import { count, eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import {
  adminActivityLogs,
  adminProfiles,
  announcements,
  platformSettings,
  quizOptions,
  quizQuestions,
  quizzes,
  subjects,
} from '../src/db/schema.ts';
import {
  DEFAULT_SUPER_ADMIN_PERMISSIONS,
  DEFAULT_VICE_ADMIN_PERMISSIONS,
} from '../src/lib/permissions.ts';
import { normalizeQuestionHash } from '../src/lib/quizLogic.ts';
import { ensureStorageDirs } from './storage.ts';

let seedPromise: Promise<void> | null = null;
let seededDone = false;

export const DEFAULT_HOMEPAGE_SETTINGS = {
  heroTitle: 'Your Learning Journey Starts Here.',
  heroSubtitle: 'Everything you need to study smarter, learn better, and stay ahead.',
  welcomeHeading: 'Welcome to দরবার (Darbar)',
  welcomeBody:
    'Built specifically for Class 11 and Class 12 learners across West Bengal and India, Darbar gathers structured subject notes, solved board question papers, chapter practice sets, and daily general knowledge challenges in one calm, reliable study hall.',
  contactEmail: 'academic@darbar-edu.org',
  contactPhone: '+91 33 4018 7420',
  contactAddress: 'College Street Academic Wing, Kolkata 700073, West Bengal',
};

const SEED_SUBJECTS = [
  {
    slug: 'bengali',
    name: 'বাংলা (Bengali)',
    bengaliName: 'বাংলা সাহিত্য ও ব্যাকরণ',
    icon: 'BookOpenText',
    description:
      'Higher Secondary prose, poetry, classical drama, grammar rules, essay outlines, and model board question papers for Class 11 & 12.',
    accentColor: '#0F2447',
    displayOrder: 1,
  },
  {
    slug: 'english',
    name: 'English',
    bengaliName: 'ইংরেজি সাহিত্য ও রচনা',
    icon: 'Feather',
    description:
      'Prose and poetry analyses, unseen comprehension techniques, formal report and letter writing templates, and grammar drills.',
    accentColor: '#1D4ED8',
    displayOrder: 2,
  },
  {
    slug: 'physics',
    name: 'Physics',
    bengaliName: 'পদার্থবিদ্যা',
    icon: 'Atom',
    description:
      'Step-by-step derivations, numerical problem banks, circuit diagrams, optics ray guides, and formula compendiums for board and entrance exams.',
    accentColor: '#0D9488',
    displayOrder: 3,
  },
  {
    slug: 'mathematics',
    name: 'Mathematics',
    bengaliName: 'গণিত',
    icon: 'Sigma',
    description:
      'Calculus, vectors, matrices, probability theorems, solved previous-year papers, and rapid revision formula sheets.',
    accentColor: '#2563EB',
    displayOrder: 4,
  },
  {
    slug: 'chemistry',
    name: 'Chemistry',
    bengaliName: 'রসায়ন',
    icon: 'FlaskConical',
    description:
      'Organic named reaction mechanisms, physical chemistry equilibrium sheets, inorganic periodic trends, and laboratory viva guides.',
    accentColor: '#0F766E',
    displayOrder: 5,
  },
  {
    slug: 'biology',
    name: 'Biology',
    bengaliName: 'জীববিদ্যা',
    icon: 'Dna',
    description:
      'Genetics, human physiology, plant reproduction, labeled anatomical charts, and NCERT-aligned Class 11 & 12 board notes.',
    accentColor: '#047857',
    displayOrder: 6,
  },
  {
    slug: 'general-knowledge',
    name: 'General Knowledge',
    bengaliName: 'সাধারণ জ্ঞান',
    icon: 'Globe2',
    description:
      'Curated Indian polity, modern history, geography, scientific milestones, and current affairs digests for competitive readiness.',
    accentColor: '#1E3A8A',
    displayOrder: 7,
  },
];

const SEED_QUIZZES = [
  {
    title: 'দরবার Daily General Knowledge Challenge',
    category: 'General Knowledge',
    isDaily: true,
    isAiGenerated: false,
    timeLimitSeconds: 300,
    questions: [
      {
        questionText: 'Which Article of the Indian Constitution guarantees the Right to Constitutional Remedies?',
        explanation:
          'Article 32 allows citizens to directly move the Supreme Court for enforcement of Fundamental Rights; Dr. B. R. Ambedkar called it the heart and soul of the Constitution.',
        options: [
          { label: 'A', text: 'Article 19', isCorrect: false },
          { label: 'B', text: 'Article 21', isCorrect: false },
          { label: 'C', text: 'Article 32', isCorrect: true },
          { label: 'D', text: 'Article 44', isCorrect: false },
        ],
      },
      {
        questionText: 'Which Indian space mission successfully placed a solar observatory at the Sun-Earth Lagrange Point L1?',
        explanation:
          'ISRO launched Aditya-L1 in September 2023 to continuously observe the solar corona, chromosphere, and solar wind from the L1 halo orbit.',
        options: [
          { label: 'A', text: 'Aditya-L1', isCorrect: true },
          { label: 'B', text: 'Astrosat-2', isCorrect: false },
          { label: 'C', text: 'Gaganyaan-1', isCorrect: false },
          { label: 'D', text: 'Mangalyaan-2', isCorrect: false },
        ],
      },
      {
        questionText: 'What is the SI unit of electrical conductance?',
        explanation:
          'Electrical conductance is the reciprocal of electrical resistance (ohm) and is measured in siemens (S).',
        options: [
          { label: 'A', text: 'Tesla', isCorrect: false },
          { label: 'B', text: 'Siemens', isCorrect: true },
          { label: 'C', text: 'Weber', isCorrect: false },
          { label: 'D', text: 'Henry', isCorrect: false },
        ],
      },
      {
        questionText: 'Rabindranath Tagore received the Nobel Prize in Literature in 1913 primarily for which collection?',
        explanation:
          'Tagore became the first non-European Nobel laureate in Literature for the English translation of Gitanjali (Song Offerings).',
        options: [
          { label: 'A', text: 'Gora', isCorrect: false },
          { label: 'B', text: 'Chokher Bali', isCorrect: false },
          { label: 'C', text: 'Gitanjali', isCorrect: true },
          { label: 'D', text: 'Ghare-Baire', isCorrect: false },
        ],
      },
      {
        questionText: 'Which layer of the Earth’s atmosphere contains the majority of the protective ozone layer?',
        explanation:
          'Roughly 90% of atmospheric ozone resides in the stratosphere, absorbing harmful ultraviolet-B solar radiation.',
        options: [
          { label: 'A', text: 'Troposphere', isCorrect: false },
          { label: 'B', text: 'Stratosphere', isCorrect: true },
          { label: 'C', text: 'Mesosphere', isCorrect: false },
          { label: 'D', text: 'Thermosphere', isCorrect: false },
        ],
      },
    ],
  },
  {
    title: 'Class 11–12 Science & Technology Sprint',
    category: 'Science',
    isDaily: false,
    isAiGenerated: false,
    timeLimitSeconds: 240,
    questions: [
      {
        questionText: 'Which phenomenon is primarily responsible for the blue color of a clear daytime sky?',
        explanation:
          'Rayleigh scattering scatters shorter wavelengths (blue/violet) much more strongly than longer red wavelengths because intensity scales inversely with the fourth power of wavelength.',
        options: [
          { label: 'A', text: 'Total internal reflection', isCorrect: false },
          { label: 'B', text: 'Rayleigh scattering', isCorrect: true },
          { label: 'C', text: 'Dispersion', isCorrect: false },
          { label: 'D', text: 'Diffraction', isCorrect: false },
        ],
      },
      {
        questionText: 'In DNA replication, which enzyme synthesizes the new complementary strand in the 5′ to 3′ direction?',
        explanation:
          'DNA polymerase catalyzes the addition of deoxynucleotides onto the free 3′-OH end of the growing DNA strand.',
        options: [
          { label: 'A', text: 'DNA ligase', isCorrect: false },
          { label: 'B', text: 'Helicase', isCorrect: false },
          { label: 'C', text: 'DNA polymerase', isCorrect: true },
          { label: 'D', text: 'Topoisomerase', isCorrect: false },
        ],
      },
      {
        questionText: 'What is the hybridization state of the central carbon atom in ethyne (C2H2)?',
        explanation:
          'Each carbon in ethyne forms two sigma bonds and two pi bonds, corresponding to linear sp hybridization with a 180° bond angle.',
        options: [
          { label: 'A', text: 'sp', isCorrect: true },
          { label: 'B', text: 'sp2', isCorrect: false },
          { label: 'C', text: 'sp3', isCorrect: false },
          { label: 'D', text: 'dsp2', isCorrect: false },
        ],
      },
      {
        questionText: 'Which blood vessel carries oxygenated blood from the lungs back to the left atrium of the heart?',
        explanation:
          'The pulmonary veins are the unique veins in systemic-pulmonary circulation that transport oxygenated blood to the left atrium.',
        options: [
          { label: 'A', text: 'Pulmonary artery', isCorrect: false },
          { label: 'B', text: 'Superior vena cava', isCorrect: false },
          { label: 'C', text: 'Pulmonary vein', isCorrect: true },
          { label: 'D', text: 'Coronary sinus', isCorrect: false },
        ],
      },
    ],
  },
  {
    title: 'Indian GK & Modern History Essentials',
    category: 'Indian GK',
    isDaily: false,
    isAiGenerated: false,
    timeLimitSeconds: 240,
    questions: [
      {
        questionText: 'Where is the headquarters of the Botanical Survey of India located?',
        explanation:
          'Founded in 1890, the Botanical Survey of India is headquartered in Kolkata, West Bengal.',
        options: [
          { label: 'A', text: 'Dehradun', isCorrect: false },
          { label: 'B', text: 'Kolkata', isCorrect: true },
          { label: 'C', text: 'Bengaluru', isCorrect: false },
          { label: 'D', text: 'Pune', isCorrect: false },
        ],
      },
      {
        questionText: 'Which river is known as the "Sorrow of Bengal" historically prior to the Damodar Valley Project?',
        explanation:
          'The Damodar River frequently flooded the plains of West Bengal until multipurpose dams were built by the Damodar Valley Corporation.',
        options: [
          { label: 'A', text: 'Damodar', isCorrect: true },
          { label: 'B', text: 'Teesta', isCorrect: false },
          { label: 'C', text: 'Mahananda', isCorrect: false },
          { label: 'D', text: 'Subarnarekha', isCorrect: false },
        ],
      },
      {
        questionText: 'In which year was the Asiatic Society founded in Calcutta by Sir William Jones?',
        explanation:
          'Sir William Jones founded the Asiatic Society on 15 January 1784 to advance Oriental research in literature, history, and science.',
        options: [
          { label: 'A', text: '1757', isCorrect: false },
          { label: 'B', text: '1784', isCorrect: true },
          { label: 'C', text: '1817', isCorrect: false },
          { label: 'D', text: '1857', isCorrect: false },
        ],
      },
      {
        questionText: 'Which Indian state has the longest coastline along the Arabian Sea and Indian Ocean?',
        explanation:
          'Gujarat has the longest coastline among Indian states, stretching roughly 1,600 km along the Kathiawar and Kutch peninsulas.',
        options: [
          { label: 'A', text: 'Tamil Nadu', isCorrect: false },
          { label: 'B', text: 'Andhra Pradesh', isCorrect: false },
          { label: 'C', text: 'Gujarat', isCorrect: true },
          { label: 'D', text: 'Maharashtra', isCorrect: false },
        ],
      },
    ],
  },
];

async function runSeed() {
  ensureStorageDirs();

  // 1. Seed admin profiles (without hardcoded passwords; set securely during first-run claim or env setup)
  const existingAdmins = await db.select().from(adminProfiles);
  let superAdminId: number;
  if (existingAdmins.length === 0) {
    const insertedAdmins = await db
      .insert(adminProfiles)
      .values([
        {
          role: 'SUPER_ADMIN',
          username: 'superadmin',
          displayName: 'Dr. Subhajit Chatterjee',
          email: 'superadmin@darbar-edu.org',
          avatarUrl: '/src/assets/images/avatar_super_admin_1795581779563.jpg',
          passwordHash: null,
          isActive: true,
          permissions: DEFAULT_SUPER_ADMIN_PERMISSIONS,
        },
        {
          role: 'VICE_ADMIN',
          username: 'viceadmin',
          displayName: 'Ananya Mukherjee',
          email: 'viceadmin@darbar-edu.org',
          avatarUrl: '/src/assets/images/avatar_vice_admin_1795581778846.jpg',
          passwordHash: null,
          isActive: true,
          permissions: DEFAULT_VICE_ADMIN_PERMISSIONS,
        },
      ])
      .returning();
    superAdminId = insertedAdmins.find((a) => a.role === 'SUPER_ADMIN')!.id;
  } else {
    superAdminId = existingAdmins.find((a) => a.role === 'SUPER_ADMIN')?.id ?? existingAdmins[0].id;
  }

  // 2. Seed subjects
  const [{ totalSubjects }] = await db.select({ totalSubjects: count() }).from(subjects);
  if (Number(totalSubjects) === 0) {
    await db.insert(subjects).values(SEED_SUBJECTS);
  }

  // 3. Seed quizzes
  const [{ totalQuizzes }] = await db.select({ totalQuizzes: count() }).from(quizzes);
  if (Number(totalQuizzes) === 0) {
    const today = new Date().toISOString().slice(0, 10);
    for (const qSpec of SEED_QUIZZES) {
      const [insertedQuiz] = await db
        .insert(quizzes)
        .values({
          title: qSpec.title,
          category: qSpec.category,
          quizDate: today,
          isDaily: qSpec.isDaily,
          isAiGenerated: qSpec.isAiGenerated,
          status: 'published',
          timeLimitSeconds: qSpec.timeLimitSeconds,
          createdByAdminId: superAdminId,
        })
        .returning();

      for (let i = 0; i < qSpec.questions.length; i++) {
        const q = qSpec.questions[i];
        const [insertedQ] = await db
          .insert(quizQuestions)
          .values({
            quizId: insertedQuiz.id,
            questionText: q.questionText,
            explanation: q.explanation,
            questionHash: normalizeQuestionHash(q.questionText),
            orderIndex: i,
          })
          .returning();

        await db.insert(quizOptions).values(
          q.options.map((o) => ({
            questionId: insertedQ.id,
            optionLabel: o.label,
            optionText: o.text,
            isCorrect: o.isCorrect,
          }))
        );
      }
    }
  }

  // 4. Seed announcements & homepage settings
  const [{ totalAnnouncements }] = await db.select({ totalAnnouncements: count() }).from(announcements);
  if (Number(totalAnnouncements) === 0) {
    await db.insert(announcements).values([
      {
        title: 'Daily General Knowledge Challenge is Live',
        content:
          'Test your exam readiness every day with timed 4-option GK quizzes and instant explanations across 9 categories.',
        type: 'exam',
        isActive: true,
        createdByAdminId: superAdminId,
      },
    ]);
  }

  const existingHome = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'homepage_content'))
    .limit(1);

  if (existingHome.length === 0) {
    await db.insert(platformSettings).values({
      key: 'homepage_content',
      value: DEFAULT_HOMEPAGE_SETTINGS,
      updatedByAdminId: superAdminId,
    });
  }

  const [{ totalLogs }] = await db.select({ totalLogs: count() }).from(adminActivityLogs);
  if (Number(totalLogs) === 0) {
    await db.insert(adminActivityLogs).values({
      adminId: superAdminId,
      adminRole: 'SUPER_ADMIN',
      adminName: 'Dr. Subhajit Chatterjee',
      action: 'PLATFORM_INITIALIZED',
      entityType: 'system',
      entityId: '1',
      details: 'Initialized Darbar academic catalog with 7 subjects and 3 starter quizzes.',
    });
  }

  seededDone = true;
}

export async function ensureSeeded(): Promise<void> {
  if (seededDone) return;
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;
}
