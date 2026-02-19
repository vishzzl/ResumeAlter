'use server';

import { db } from '@/lib/db';
import { applications, profiles } from '@/lib/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

async function getUserId() {
    const session = await auth();
    if (!session?.user?.id) return null;
    return parseInt(session.user.id);
}

export async function getProfile() {
    const userId = await getUserId();
    if (!userId) return null;
    const result = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    return result[0] || null;
}

export async function createProfile(data: typeof profiles.$inferInsert) {
    const userId = await getUserId();
    if (!userId) throw new Error('Unauthorized');

    // Check if profile already exists
    const existing = await getProfile();
    if (existing) {
        // Update instead
        return updateProfile(existing.id, data);
    }

    const result = await db.insert(profiles).values({ ...data, userId }).returning();
    revalidatePath('/profile');
    return result[0];
}

export async function updateProfile(id: number, data: Partial<typeof profiles.$inferInsert>) {
    const userId = await getUserId();
    if (!userId) throw new Error('Unauthorized');

    // Ensure user owns the profile
    await db.update(profiles).set(data).where(and(eq(profiles.id, id), eq(profiles.userId, userId)));
    revalidatePath('/profile');
}


export async function getApplications() {
    const userId = await getUserId();
    if (!userId) return [];
    return await db.select().from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.createdAt));
}

export async function getApplication(id: number) {
    const userId = await getUserId();
    if (!userId) return null;
    const result = await db.select().from(applications).where(and(eq(applications.id, id), eq(applications.userId, userId)));
    return result[0];
}

export async function createApplication(jobUrl: string, jobDescription?: string, baseResume?: string) {
    const userId = await getUserId();
    if (!userId) throw new Error('Unauthorized');

    const result = await db.insert(applications).values({
        jobUrl,
        jobDescription: jobDescription || '', // Use provided description or default to empty (will be scraped)
        baseResume: baseResume, // Use provided base resume (e.g. from Master Profile)
        userId
    }).returning({ insertedId: applications.id });

    revalidatePath('/');
    return result[0].insertedId;
}

export async function updateApplication(id: number, data: Partial<typeof applications.$inferInsert>) {
    const userId = await getUserId();
    if (!userId) throw new Error('Unauthorized');

    await db.update(applications).set(data).where(and(eq(applications.id, id), eq(applications.userId, userId)));
    revalidatePath('/');
    revalidatePath(`/applications/${id}`);
}

export async function deleteApplication(id: number) {
    const userId = await getUserId();
    if (!userId) throw new Error('Unauthorized');

    await db.delete(applications).where(and(eq(applications.id, id), eq(applications.userId, userId)));
    revalidatePath('/');
}
