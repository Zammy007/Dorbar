import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export interface ViceAdminPermissions {
  uploadDocuments: boolean;
  editDocuments: boolean;
  deleteDocuments: boolean;
  manageSubjects: boolean;
  manageQuizzes: boolean;
  publishDailyQuiz: boolean;
  manageAnnouncements: boolean;
  viewAnalytics: boolean;
}

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    fullName: text('full_name').notNull(),
    studentClass: text('student_class').notNull().default('Class 12'),
    passwordHash: text('password_hash'),
    authProvider: text('auth_provider').notNull().default('password'),
    avatarUrl: text('avatar_url'),
    resetTokenHash: text('reset_token_hash'),
    resetTokenExpiresAt: timestamp('reset_token_expires_at'),
    lastLoginAt: timestamp('last_login_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_users_email').on(table.email)]
);

export const adminProfiles = pgTable(
  'admin_profiles',
  {
    id: serial('id').primaryKey(),
    role: text('role').notNull(), // 'SUPER_ADMIN' | 'VICE_ADMIN'
    username: text('username').notNull().unique(),
    displayName: text('display_name').notNull(),
    email: text('email').notNull(),
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash'),
    isActive: boolean('is_active').notNull().default(true),
    permissions: jsonb('permissions').$type<ViceAdminPermissions>().notNull(),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('idx_admin_role_unique').on(table.role)]
);

export const subjects = pgTable(
  'subjects',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    bengaliName: text('bengali_name').notNull(),
    icon: text('icon').notNull(),
    description: text('description').notNull(),
    accentColor: text('accent_color').notNull().default('#1D4ED8'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_subjects_slug').on(table.slug)]
);

export const documents = pgTable(
  'documents',
  {
    id: serial('id').primaryKey(),
    subjectId: integer('subject_id')
      .references(() => subjects.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    chapterName: text('chapter_name').notNull().default('General'),
    description: text('description').notNull(),
    category: text('category').notNull().default('Notes'),
    fileFormat: text('file_format').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    storagePath: text('storage_path').notNull(),
    originalFileName: text('original_file_name').notNull(),
    thumbnailPath: text('thumbnail_path'),
    status: text('status').notNull().default('published'), // 'published' | 'draft'
    downloadCount: integer('download_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    uploadedByAdminId: integer('uploaded_by_admin_id').references(() => adminProfiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_documents_subject').on(table.subjectId),
    index('idx_documents_status').on(table.status),
    index('idx_documents_created').on(table.createdAt),
  ]
);

export const documentDownloads = pgTable(
  'document_downloads',
  {
    id: serial('id').primaryKey(),
    documentId: integer('document_id')
      .references(() => documents.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    ipHash: text('ip_hash').notNull(),
    downloadedAt: timestamp('downloaded_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_downloads_document').on(table.documentId),
    index('idx_downloads_user').on(table.userId),
  ]
);

export const studentBookmarks = pgTable(
  'student_bookmarks',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    documentId: integer('document_id')
      .references(() => documents.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('idx_bookmark_user_doc').on(table.userId, table.documentId)]
);

export const studentDocumentViews = pgTable(
  'student_document_views',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    documentId: integer('document_id')
      .references(() => documents.id, { onDelete: 'cascade' })
      .notNull(),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [index('idx_views_user').on(table.userId)]
);

export const quizzes = pgTable(
  'quizzes',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    category: text('category').notNull(),
    quizDate: text('quiz_date').notNull(), // YYYY-MM-DD
    isDaily: boolean('is_daily').notNull().default(false),
    isAiGenerated: boolean('is_ai_generated').notNull().default(false),
    status: text('status').notNull().default('published'), // 'published' | 'draft' | 'suggested'
    timeLimitSeconds: integer('time_limit_seconds').notNull().default(300),
    createdByAdminId: integer('created_by_admin_id').references(() => adminProfiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_quizzes_date').on(table.quizDate),
    index('idx_quizzes_category').on(table.category),
  ]
);

export const quizQuestions = pgTable(
  'quiz_questions',
  {
    id: serial('id').primaryKey(),
    quizId: integer('quiz_id')
      .references(() => quizzes.id, { onDelete: 'cascade' })
      .notNull(),
    questionText: text('question_text').notNull(),
    explanation: text('explanation').notNull(),
    questionHash: text('question_hash').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
  },
  (table) => [
    index('idx_quiz_questions_quiz').on(table.quizId),
    index('idx_quiz_questions_hash').on(table.questionHash),
  ]
);

export const quizOptions = pgTable(
  'quiz_options',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id')
      .references(() => quizQuestions.id, { onDelete: 'cascade' })
      .notNull(),
    optionLabel: text('option_label').notNull(), // A, B, C, D
    optionText: text('option_text').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
  },
  (table) => [index('idx_quiz_options_question').on(table.questionId)]
);

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: serial('id').primaryKey(),
    quizId: integer('quiz_id')
      .references(() => quizzes.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    guestName: text('guest_name'),
    score: integer('score').notNull(),
    totalQuestions: integer('total_questions').notNull(),
    timeTakenSeconds: integer('time_taken_seconds').notNull(),
    completedAt: timestamp('completed_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_quiz_attempts_quiz').on(table.quizId),
    index('idx_quiz_attempts_user').on(table.userId),
  ]
);

export const quizAnswers = pgTable(
  'quiz_answers',
  {
    id: serial('id').primaryKey(),
    attemptId: integer('attempt_id')
      .references(() => quizAttempts.id, { onDelete: 'cascade' })
      .notNull(),
    questionId: integer('question_id')
      .references(() => quizQuestions.id, { onDelete: 'cascade' })
      .notNull(),
    selectedOptionId: integer('selected_option_id').references(() => quizOptions.id, {
      onDelete: 'set null',
    }),
    isCorrect: boolean('is_correct').notNull().default(false),
  },
  (table) => [index('idx_quiz_answers_attempt').on(table.attemptId)]
);

export const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  type: text('type').notNull().default('info'), // 'info' | 'exam' | 'update'
  isActive: boolean('is_active').notNull().default(true),
  createdByAdminId: integer('created_by_admin_id').references(() => adminProfiles.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const adminActivityLogs = pgTable(
  'admin_activity_logs',
  {
    id: serial('id').primaryKey(),
    adminId: integer('admin_id').references(() => adminProfiles.id, { onDelete: 'set null' }),
    adminRole: text('admin_role').notNull(),
    adminName: text('admin_name').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    details: text('details').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_admin_logs_created').on(table.createdAt)]
);

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedByAdminId: integer('updated_by_admin_id').references(() => adminProfiles.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: serial('id').primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    actorType: text('actor_type').notNull(), // 'student' | 'admin'
    actorId: integer('actor_id').notNull(),
    role: text('role').notNull(), // 'STUDENT' | 'SUPER_ADMIN' | 'VICE_ADMIN'
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_auth_sessions_token').on(table.tokenHash)]
);

export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Drizzle Relations
export const subjectsRelations = relations(subjects, ({ many }) => ({
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [documents.subjectId],
    references: [subjects.id],
  }),
  uploadedBy: one(adminProfiles, {
    fields: [documents.uploadedByAdminId],
    references: [adminProfiles.id],
  }),
  downloads: many(documentDownloads),
}));

export const quizzesRelations = relations(quizzes, ({ many }) => ({
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
  options: many(quizOptions),
}));

export const quizOptionsRelations = relations(quizOptions, ({ one }) => ({
  question: one(quizQuestions, {
    fields: [quizOptions.questionId],
    references: [quizQuestions.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  answers: many(quizAnswers),
}));

export const quizAnswersRelations = relations(quizAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(quizQuestions, {
    fields: [quizAnswers.questionId],
    references: [quizQuestions.id],
  }),
}));
