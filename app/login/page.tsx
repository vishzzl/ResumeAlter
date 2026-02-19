'use client';

import { useActionState } from 'react';
import { authenticate } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined);

    return (
        <div className="min-h-screen flex items-center justify-center bg-white text-slate-900">
            <div className="w-full max-w-sm p-6 space-y-6">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                    <p className="text-sm text-slate-500">
                        Enter your email to sign in to your account
                    </p>
                </div>

                <form action={dispatch} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            type="email"
                            id="email"
                            name="email"
                            required
                            placeholder="name@example.com"
                            className="bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <Link
                                href="/forgot-password"
                                className="text-sm text-slate-500 hover:text-slate-900 hover:underline"
                            >
                                Forgot password?
                            </Link>
                        </div>
                        <Input
                            type="password"
                            id="password"
                            name="password"
                            required
                            className="bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                        />
                    </div>

                    {errorMessage && (
                        <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                            <AlertCircle className="w-4 h-4" />
                            {errorMessage}
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                        disabled={isPending}
                    >
                        {isPending ? 'Signing in...' : 'Sign In'}
                    </Button>
                </form>

                <div className="text-center text-sm text-slate-500">
                    Don&apos;t have an account?{' '}
                    <Link href="/register" className="font-semibold text-slate-900 hover:underline">
                        Sign up
                    </Link>
                </div>

                <p className="px-8 text-center text-xs text-slate-400">
                    By clicking continue, you agree to our{' '}
                    <Link href="/terms" className="underline underline-offset-4 hover:text-slate-900">
                        Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="underline underline-offset-4 hover:text-slate-900">
                        Privacy Policy
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}
