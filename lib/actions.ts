'use server';

import { db } from '@/lib/db';
import { applications, profiles, users } from '@/lib/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { generateUserToken } from '@/app/api/resume/route';

async function getUserId() {
    const session = await auth();
    if (!session?.user?.id) return null;
    return parseInt(session.user.id);
}

export async function getResumeDownloadLink() {
    const userId = await getUserId();
    if (!userId) return null;
    const token = generateUserToken(userId);
    return `/api/resume?userId=${userId}&token=${token}`;
}

export async function getMasterResume() {
    const userId = await getUserId();
    if (!userId) return '';

    const result = await db
        .select({ masterResume: users.masterResume })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    return result[0]?.masterResume || '';
}

export async function updateMasterResume(masterResume: string) {
    const userId = await getUserId();
    if (!userId) throw new Error('Unauthorized');

    await db
        .update(users)
        .set({
            masterResume,
            masterResumeUpdatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId));

    revalidatePath('/profile');
    revalidatePath('/new');
}

export async function getProfiles() {
    const userId = await getUserId();
    if (!userId) return [];
    return await db.select().from(profiles).where(eq(profiles.userId, userId));
}

export async function getProfile(profileId?: number) {
    const userId = await getUserId();
    if (!userId) return null;

    if (profileId) {
        const result = await db.select().from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.userId, userId))).limit(1);
        return result[0] || null;
    }

    const result = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    if (result[0]) return result[0];

    // Create a default profile if none exists
    const defaultProfile = await db.insert(profiles).values({
        userId,
        profileName: 'Default Profile',
        name: '',
        email: '',
        phone: '',
        linkedin: '',
        website: '',
        summary: '',
        skills: '[]',
        experience: '[]',
        education: '[]',
        projects: '[]',
        certifications: '[]',
    }).returning();

    return defaultProfile[0];
}

export async function createProfile(data: typeof profiles.$inferInsert) {
    const userId = await getUserId();
    if (!userId) throw new Error('Unauthorized');

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

export async function deleteProfile(id: number) {
    const userId = await getUserId();
    if (!userId) throw new Error('Unauthorized');

    await db.delete(profiles).where(and(eq(profiles.id, id), eq(profiles.userId, userId)));
    revalidatePath('/profile');
}


export async function getApplications() {
    const userId = await getUserId();
    if (!userId) return [];
    try {
        return await db.select().from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.createdAt));
    } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('SERVER_ERROR')) {
            console.error('[getApplications] DB auth error — check TURSO_AUTH_TOKEN:', msg);
        } else {
            console.error('[getApplications] DB error:', msg);
        }
        return [];
    }
}

export async function getApplication(id: number) {
    const userId = await getUserId();
    if (!userId) return null;
    try {
        const result = await db.select().from(applications).where(and(eq(applications.id, id), eq(applications.userId, userId)));
        return result[0];
    } catch (err: any) {
        console.error('[getApplication] DB error:', err?.message || err);
        return null;
    }
}

export async function createApplication(jobUrl: string, jobDescription?: string, baseResume?: string, profileId?: number) {
    const userId = await getUserId();
    if (!userId) throw new Error('Unauthorized');

    const result = await db.insert(applications).values({
        jobUrl,
        jobDescription: jobDescription || '', // Use provided description or default to empty (will be scraped)
        baseResume,
        profileId: profileId || null,
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
