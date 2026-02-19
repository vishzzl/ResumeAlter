'use server';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
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
