'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { FileText, Menu, PlusCircle, Settings, User as UserIcon, X, LogOut, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ModelSelector } from '@/components/ModelSelector';

interface MainNavProps {
    user?: any;
}

export function MainNav({ user }: MainNavProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        if (user && (pathname === '/login' || pathname === '/register')) {
            router.replace('/');
        }
    }, [user, pathname, router]);

    const isAuthPage = pathname === '/login' || pathname === '/register';
    const isApplicationWorkspace = /^\/applications\/[^/]+$/.test(pathname);
    if ((isAuthPage && !user) || isApplicationWorkspace) {
        return null;
    }

    const isActive = (path: string) => pathname === path;

    return (
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 lg:hidden transition-colors duration-300 overflow-visible">
            <div className="flex h-14 md:h-16 items-center px-4 justify-between">
                {/* Mobile Logo */}
                <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-slate-100 group">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                        <FileText className="h-4 w-4" />
                    </div>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300">
                        ResumeAlter
                    </span>
                </Link>

                <div className="flex items-center gap-2">
                    <div className="hidden sm:flex">
                        <ModelSelector />
                    </div>
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors"
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="lg:hidden border-t border-slate-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl absolute w-full left-0 z-50 animate-in slide-in-from-top-2 fade-in duration-200 shadow-2xl">
                    <div className="px-4 py-4 flex flex-col gap-2">
                        {user && (
                            <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between px-2">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{user.email}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role || 'User'}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => signOut()}
                                    className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 h-8"
                                >
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <Link
                                href="/"
                                onClick={() => setIsMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm",
                                    isActive('/') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                )}
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                Dashboard
                            </Link>
                            <Link
                                href="/profile"
                                onClick={() => setIsMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm",
                                    isActive('/profile') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                )}
                            >
                                <UserIcon className="h-4 w-4" />
                                My Resume
                            </Link>
                            <Link
                                href="/new"
                                onClick={() => setIsMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm",
                                    isActive('/new') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                )}
                            >
                                <PlusCircle className="h-4 w-4" />
                                New Application
                            </Link>
                            <Link
                                href="/settings"
                                onClick={() => setIsMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm",
                                    isActive('/settings') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                )}
                            >
                                <Settings className="h-4 w-4" />
                                Settings
                            </Link>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50 sm:hidden">
                            <p className="px-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">AI Model</p>
                            <div className="flex items-center px-2">
                                <ModelSelector />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
