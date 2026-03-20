'use server';

import { db } from '@/lib/db';
import { users, applications, profiles } from '@/lib/db/schema';
import { auth } from '@/auth';
import { eq, desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
    const session = await auth();
    if (session?.user?.role !== 'admin') {
        throw new Error('Unauthorized');
    }

    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).all();
    return allUsers;
}

export async function createUser(prevState: any, formData: FormData) {
    const session = await auth();
    if (session?.user?.role !== 'admin') {
        return { message: 'Unauthorized' };
    }

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string || 'user';

    if (!email || !password) {
        return { message: 'Email and password are required' };
    }

    try {
        const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
        if (existingUser) {
            return { message: 'User already exists' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.insert(users).values({
            email,
            password: hashedPassword,
            role,
        });

        revalidatePath('/admin/users');
        return { message: 'Success' };
    } catch (error) {
        console.error('Failed to create user:', error);
        return { message: 'Failed to create user' };
    }
}

export async function deleteUser(userId: number) {
    const session = await auth();
    if (session?.user?.role !== 'admin') {
        return { success: false, message: 'Unauthorized' };
    }

    try {
        // Delete related records first to avoid foreign key constraints
        await db.delete(applications).where(eq(applications.userId, userId));
        await db.delete(profiles).where(eq(profiles.userId, userId));

        // Then delete the user
        await db.delete(users).where(eq(users.id, userId));

        revalidatePath('/admin/users');
        return { success: true, message: 'User deleted successfully' };
    } catch (error) {
        console.error('Failed to delete user:', error);
        return { success: false, message: 'Failed to delete user' };
    }
}

export async function resetUserPassword(userId: number, newPassword: string) {
    const session = await auth();
    if (session?.user?.role !== 'admin') {
        return { success: false, message: 'Unauthorized' };
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, userId));

        revalidatePath('/admin/users');
        return { success: true, message: 'Password reset successfully' };
    } catch (error) {
        console.error('Failed to reset password:', error);
        return { success: false, message: 'Failed to reset password' };
    }
}
