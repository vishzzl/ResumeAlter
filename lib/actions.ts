'use server';

import { db } from '@/lib/db';
import { applications, profiles } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getProfile() {
    const result = await db.select().from(profiles).limit(1);
    return result[0] || null;
}

export async function createProfile(data: typeof profiles.$inferInsert) {
    const result = await db.insert(profiles).values(data).returning();
    revalidatePath('/profile');
    return result[0];
}

export async function updateProfile(id: number, data: Partial<typeof profiles.$inferInsert>) {
    await db.update(profiles).set(data).where(eq(profiles.id, id));
    revalidatePath('/profile');
}


export async function getApplications() {
    return await db.select().from(applications).orderBy(desc(applications.createdAt));
}

export async function getApplication(id: number) {
    const result = await db.select().from(applications).where(eq(applications.id, id));
    return result[0];
}

export async function createApplication(jobUrl: string, jobDescription?: string, baseResume?: string) {
    const result = await db.insert(applications).values({
        jobUrl,
        jobDescription: jobDescription || '', // Use provided description or default to empty (will be scraped)
        baseResume: baseResume, // Use provided base resume (e.g. from Master Profile)
    }).returning({ insertedId: applications.id });

    revalidatePath('/');
    return result[0].insertedId;
}

export async function updateApplication(id: number, data: Partial<typeof applications.$inferInsert>) {
    await db.update(applications).set(data).where(eq(applications.id, id));
    revalidatePath('/');
    revalidatePath(`/applications/${id}`);
}

export async function deleteApplication(id: number) {
    await db.delete(applications).where(eq(applications.id, id));
    revalidatePath('/');
}
