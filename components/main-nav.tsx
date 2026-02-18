'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText, PlusCircle, Settings, Menu, X, User } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function MainNav() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();

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
                </div>

                {/* Desktop Model Selector */}
                <div className="hidden md:flex items-center gap-4">
                    <div className="border-l border-slate-200 pl-4 h-8 flex items-center">
                        <ModelSelector />
                    </div>
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
                                <User className="h-4 w-4" />
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
