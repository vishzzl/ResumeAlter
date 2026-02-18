import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const applications = sqliteTable('applications', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobUrl: text('job_url').notNull(),
    jobTitle: text('job_title'),
    companyName: text('company_name'),
    jobDescription: text('job_description').notNull(),
    jobDetails: text('job_details'), // JSON string of structured data
    baseResume: text('base_resume'),
    tailoredResume: text('tailored_resume'),
    status: text('status').default('draft'), // draft, applied, interview, rejected, offer
    analysis: text('analysis'), // JSON string of ATS score and changes
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    dateApplied: text('date_applied'), // ISO 8601 string
});

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

export const profiles = sqliteTable('profiles', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    linkedin: text('linkedin'),
    website: text('website'),
    summary: text('summary'),
    experience: text('experience'), // JSON Array of {company, role, dates, description, highlights[]}
    education: text('education'), // JSON Array
    skills: text('skills'), // JSON Array or Object
    projects: text('projects'), // JSON Array
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
