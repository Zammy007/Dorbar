import type { AdminPermissionSet, AdminRole } from '../lib/permissions';

export type AppRoute =
  | 'home'
  | 'materials'
  | 'subject'
  | 'quiz'
  | 'student'
  | 'about'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'admin-login'
  | 'admin-dashboard';

export interface PlatformStats {
  totalDocuments: number;
  totalSubjects: number;
  totalQuizzes: number;
  totalStudents: number;
}

export interface HomepageContent {
  heroTitle: string;
  heroSubtitle: string;
  welcomeHeading: string;
  welcomeBody: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
}

export interface SubjectItem {
  id: number;
  slug: string;
  name: string;
  bengaliName: string;
  icon: string;
  description: string;
  accentColor: string;
  displayOrder: number;
  documentCount?: number;
}

export interface DocumentItem {
  id: number;
  subjectId: number;
  subjectSlug: string;
  subjectName: string;
  title: string;
  chapterName: string;
  description: string;
  category: string;
  fileFormat: string;
  mimeType?: string;
  fileSizeBytes: number;
  originalFileName?: string;
  thumbnailPath?: string | null;
  status?: 'published' | 'draft';
  downloadCount: number;
  viewCount: number;
  createdAt: string;
}

export interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  type: 'info' | 'exam' | 'update';
  isActive: boolean;
  createdAt: string;
}

export interface QuizOptionItem {
  id: number;
  optionLabel: string;
  optionText: string;
  isCorrect?: boolean;
}

export interface QuizQuestionItem {
  id: number;
  questionText: string;
  orderIndex: number;
  explanation?: string;
  options: QuizOptionItem[];
}

export interface QuizDetail {
  id: number;
  title: string;
  category: string;
  quizDate: string;
  isDaily: boolean;
  isAiGenerated: boolean;
  timeLimitSeconds: number;
  createdAt: string;
  questions: QuizQuestionItem[];
}

export interface QuizSummaryItem {
  id: number;
  title: string;
  category: string;
  quizDate: string;
  isDaily: boolean;
  isAiGenerated: boolean;
  status: string;
  timeLimitSeconds: number;
  questionCount: number;
  attemptCount: number;
  createdAt: string;
}

export interface QuizReviewItem {
  questionId: number;
  questionText: string;
  explanation: string;
  selectedOptionId: number | null;
  correctOptionId: number;
  isCorrect: boolean;
  options: Array<{
    id: number;
    optionLabel: string;
    optionText: string;
    isCorrect: boolean;
  }>;
}

export interface QuizSubmitResult {
  attemptId: number;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTakenSeconds: number;
  review: QuizReviewItem[];
}

export interface StudentProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  studentClass: string;
  authProvider: string;
  avatarUrl: string | null;
}

export interface AdminProfileData {
  id: number;
  role: AdminRole;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  permissions: AdminPermissionSet;
  lastLoginAt: string | null;
}

export interface AdminActivityLogItem {
  id: number;
  adminId: number | null;
  adminRole: string;
  adminName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  createdAt: string;
}
