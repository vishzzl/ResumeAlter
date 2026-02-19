'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { FileText, Menu, PlusCircle, Settings, User as UserIcon, X, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ModelSelector } from '@/components/ModelSelector';

interface MainNavProps {
    user?: any; // Avoiding strict type issues for now, as User type might need extension
}

export function MainNav({ user }: MainNavProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Auto-redirect if logged in and on auth page
    useEffect(() => {
        if (user && (pathname === '/login' || pathname === '/register')) {
            router.replace('/');
        }
    }, [user, pathname, router]);

    // Hide navbar ONLY if not logged in AND on auth pages
    const isAuthPage = pathname === '/login' || pathname === '/register';
    if (isAuthPage && !user) {
        return null;
    }

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-indigo-100/50 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
            <div className="container mx-auto flex h-12 md:h-16 items-center px-3 md:px-4 justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 font-bold text-lg md:text-xl text-slate-900 data-[hover]:text-indigo-600 transition-colors shrink-0 group">
                    <div className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
                        <FileText className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <span className="hidden sm:inline bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">ResumeAlter</span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-1 text-sm font-medium">
                    <Link
                        href="/"
                        className={cn(
                            "px-4 py-2 rounded-full transition-all duration-200",
                            isActive('/')
                                ? "bg-indigo-50 text-indigo-700 font-semibold"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
                        )}
                    >
                        Dashboard
                    </Link>
                    <Link
                        href="/profile"
                        className={cn(
                            "px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-2",
                            isActive('/profile')
                                ? "bg-indigo-50 text-indigo-700 font-semibold"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
                        )}
                    >
                        <UserIcon className="h-4 w-4" />
                        Master Profile
                    </Link>
                    <Link
                        href="/new"
                        className={cn(
                            "px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-2",
                            isActive('/new')
                                ? "bg-indigo-50 text-indigo-700 font-semibold"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
                        )}
                    >
                        <PlusCircle className="h-4 w-4" />
                        New Application
                    </Link>
                    <Link
                        href="/settings"
                        className={cn(
                            "px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-2",
                            isActive('/settings')
                                ? "bg-indigo-50 text-indigo-700 font-semibold"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
                        )}
                    >
                        <Settings className="h-4 w-4" />
                        Settings
                    </Link>
                    {user?.role === 'admin' && (
                        <Link
                            href="/admin/users"
                            className={cn(
                                "px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-2",
                                isActive('/admin/users')
                                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
                            )}
                        >
                            <UserIcon className="h-4 w-4" />
                            Users
                        </Link>
                    )}
                </div>

                {/* Right Side: Model Selector & User Info */}
                <div className="hidden md:flex items-center gap-4">
                    <div className="border-l border-slate-200 pl-4 h-8 flex items-center">
                        <ModelSelector />
                    </div>

                    {user && (
                        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-medium text-slate-900">{user.email}</span>
                                <span className="text-[10px] text-slate-500 capitalize">{user.role || 'User'}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => signOut()}
                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                title="Log out"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="md:hidden p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                    aria-label="Toggle menu"
                >
                    {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-xl absolute w-full left-0 animate-in slide-in-from-top-5 fade-in duration-200 shadow-xl">
                    <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
                        {user && (
                            <div className="mb-4 pb-4 border-b border-slate-100 flex items-center justify-between px-2">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-900">{user.email}</span>
                                    <span className="text-xs text-slate-500 capitalize">{user.role || 'User'}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => signOut()}
                                    className="text-slate-500 hover:text-red-600 hover:bg-red-50 h-8"
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
                                    isActive('/') ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <FileText className="h-4 w-4" />
                                Dashboard
                            </Link>
                            <Link
                                href="/profile"
                                onClick={() => setIsMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm",
                                    isActive('/profile') ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <UserIcon className="h-4 w-4" />
                                Master Profile
                            </Link>
                            <Link
                                href="/new"
                                onClick={() => setIsMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm",
                                    isActive('/new') ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
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
                                    isActive('/settings') ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <Settings className="h-4 w-4" />
                                Settings
                            </Link>
                            {user?.role === 'admin' && (
                                <Link
                                    href="/admin/users"
                                    onClick={() => setIsMenuOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm",
                                        isActive('/admin/users') ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                                    )}
                                >
                                    <UserIcon className="h-4 w-4" />
                                    Users
                                </Link>
                            )}
                        </div>

                        <div className="mt-2 pt-4 border-t border-slate-100">
                            <p className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">AI Model</p>
                            <div className="flex items-center justify-center">
                                <ModelSelector />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
