'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText, PlusCircle, Settings, Menu, X } from 'lucide-react';
import { ModelSelector } from './ModelSelector';

export function MainNav() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
            <div className="container mx-auto flex h-14 items-center px-4 justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 font-bold text-xl text-slate-900 hover:text-indigo-600 transition-colors shrink-0">
                    <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                        <FileText className="h-5 w-5" />
                    </div>
                    <span className="hidden sm:inline">ResumeAlter</span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-4 text-sm font-medium">
                    <Link
                        href="/"
                        className="transition-colors hover:text-indigo-600 text-slate-600 hover:bg-slate-100/50 px-3 py-2 rounded-md"
                    >
                        Dashboard
                    </Link>
                    <Link
                        href="/profile"
                        className="flex items-center gap-2 transition-colors hover:text-indigo-600 text-slate-600 hover:bg-slate-100/50 px-3 py-2 rounded-md"
                    >
                        Master Profile
                    </Link>
                    <Link
                        href="/new"
                        className="flex items-center gap-2 transition-colors hover:text-indigo-600 text-slate-600 hover:bg-slate-100/50 px-3 py-2 rounded-md"
                    >
                        <PlusCircle className="h-4 w-4" />
                        New Application
                    </Link>
                    <Link
                        href="/settings"
                        className="flex items-center gap-2 transition-colors hover:text-indigo-600 text-slate-600 hover:bg-slate-100/50 px-3 py-2 rounded-md"
                    >
                        <Settings className="h-4 w-4" />
                        Settings
                    </Link>
                </div>

                {/* Desktop Model Selector */}
                <div className="hidden md:flex items-center gap-4">
                    <div className="border-l border-slate-200 pl-4">
                        <ModelSelector />
                    </div>
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="Toggle menu"
                >
                    {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden border-t border-slate-200 bg-white">
                    <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
                        <Link
                            href="/"
                            onClick={() => setIsMenuOpen(false)}
                            className="px-4 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/profile"
                            onClick={() => setIsMenuOpen(false)}
                            className="px-4 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                        >
                            Master Profile
                        </Link>
                        <Link
                            href="/new"
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                        >
                            <PlusCircle className="h-4 w-4" />
                            New Application
                        </Link>
                        <Link
                            href="/settings"
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                        >
                            <Settings className="h-4 w-4" />
                            Settings
                        </Link>

                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <ModelSelector />
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
