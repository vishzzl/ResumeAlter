'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}

export async function register(
    prevState: string | undefined,
    formData: FormData,
) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const inviteCode = formData.get('inviteCode') as string;

    if (!email || !password || !inviteCode) {
        return 'Please fill in all fields.';
    }

    if (inviteCode !== process.env.INVITE_CODE) {
        return 'Invalid invite code.';
    }

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
        return 'User already exists.';
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await db.insert(users).values({
            email,
            password: hashedPassword,
            role: 'user', // Default role
        });
    } catch (error) {
        console.error('Registration error:', error);
        return 'Failed to register user.';
    }

    // Redirect to login (handled by returning success message or client-side redirect)
    // Since we are in a server action called by useFormState, we return a message.
    // Ideally we should sign them in automatically or redirect.
    // For simplicity, let's return 'Success' and handle redirect in client.
    return 'Success';
}
