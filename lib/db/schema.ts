import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    role: text('role').default('user').notNull(),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const applications = sqliteTable('applications', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobUrl: text('job_url').notNull(),
    jobTitle: text('job_title'),
    companyName: text('company_name'),
    jobDescription: text('job_description').notNull(),
    jobDetails: text('job_details'), // JSON string of structured data
    baseResume: text('base_resume'),
    tailoredResume: text('tailored_resume'),
    coverLetter: text('cover_letter'), // Generated cover letter text
    status: text('status').default('draft'), // draft, applied, interview, rejected, offer
    analysis: text('analysis'), // JSON string of ATS score and changes
    tailorStatus: text('tailor_status').default('idle'), // idle, tailoring, verifying, analyzing, complete, error
    selectedCertifications: text('selected_certifications'), // JSON array of selected certs
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    dateApplied: text('date_applied'), // ISO 8601 string
    isArchived: integer('is_archived', { mode: 'boolean' }).default(false), // Manual archive flag
    profileId: integer('profile_id').references(() => profiles.id),
    userId: integer('user_id').references(() => users.id),
});

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

export const profiles = sqliteTable('profiles', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    profileName: text('profile_name').default('Default Profile').notNull(),
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    linkedin: text('linkedin'),
    website: text('website'),
    summary: text('summary'),
    skills: text('skills'), // JSON Array or Object
    experience: text('experience'), // JSON Array of {company, role, dates, description, highlights[]}
    education: text('education'), // JSON Array
    projects: text('projects'), // JSON Array
    certifications: text('certifications'), // JSON Array of {name, issuer, date, url}
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
    userId: integer('user_id').references(() => users.id),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
