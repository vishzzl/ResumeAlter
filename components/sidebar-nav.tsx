'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  User as UserIcon,
  Users,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface SidebarNavProps {
  user?: any;
}

export function SidebarNav({ user }: SidebarNavProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/register';
  if (isAuthPage && !user) {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  return (
    <aside className={cn(
      "hidden lg:flex flex-col h-screen sticky top-0 border-r border-slate-200/50 bg-white/40 dark:bg-slate-950/40 dark:border-slate-800/50 backdrop-blur-2xl z-40 transition-all duration-300 ease-in-out",
      isCollapsed ? "w-[80px]" : "w-[260px]"
    )}>


      {/* Logo Area */}
      <div className="h-16 flex items-center px-4 shrink-0 border-b border-slate-200/50 dark:border-slate-800/50 relative">
        <Link href="/" className={cn("flex items-center group transition-all", isCollapsed ? "hidden" : "gap-3 flex-1 min-w-0")}>
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-all duration-300 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <span className="font-extrabold text-lg bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 tracking-tight truncate">
            ResumeAlter
          </span>
        </Link>
        
        {/* The Professional Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors h-8 w-8",
            isCollapsed ? "mx-auto w-10 h-10" : "shrink-0 ml-auto"
          )}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2 custom-scrollbar">
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  User as UserIcon,
  Users,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface SidebarNavProps {
  user?: any;
}

export function SidebarNav({ user }: SidebarNavProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/register';
  if (isAuthPage && !user) {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  return (
    <aside className={cn(
      "hidden lg:flex flex-col h-screen sticky top-0 border-r border-slate-200/50 bg-white/40 dark:bg-slate-950/40 dark:border-slate-800/50 backdrop-blur-2xl z-40 transition-all duration-300 ease-in-out",
      isCollapsed ? "w-[80px]" : "w-[260px]"
    )}>


      {/* Logo Area */}
      <div className="h-16 flex items-center px-4 shrink-0 border-b border-slate-200/50 dark:border-slate-800/50 relative">
        <Link href="/" className={cn("flex items-center group transition-all", isCollapsed ? "hidden" : "gap-3 flex-1 min-w-0")}>
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-all duration-300 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <span className="font-extrabold text-lg bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 tracking-tight truncate">
            ResumeAlter
          </span>
        </Link>
        
        {/* The Professional Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors h-8 w-8",
            isCollapsed ? "mx-auto w-10 h-10" : "shrink-0 ml-auto"
          )}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2 custom-scrollbar">
        {!isCollapsed && (
          <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 px-3">
            Menu
          </div>
        )}
        
        <Link
          href="/"
          title="Dashboard"
          className={cn(
            "flex items-center gap-3 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium",
            isCollapsed ? "justify-center px-0" : "px-3",
            isActive('/') 
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50"
          )}
        >
          <LayoutDashboard className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-105", isActive('/') ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-indigo-500")} />
          {!isCollapsed && <span>Dashboard</span>}
        </Link>

        <Link
          href="/profile"
          title="My Resume"
          className={cn(
            "flex items-center gap-3 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium",
            isCollapsed ? "justify-center px-0" : "px-3",
            isActive('/profile') 
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50"
          )}
        >
          <UserIcon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-105", isActive('/profile') ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-indigo-500")} />
          {!isCollapsed && <span>My Resume</span>}
        </Link>

        <div className="my-2">
          <Link
            href="/new"
            title="New Application"
            className={cn(
              "flex items-center gap-3 py-2.5 rounded-lg transition-all duration-300 group text-sm font-semibold shadow-sm",
              isCollapsed ? "justify-center px-0 bg-indigo-600 text-white" : "px-3 bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md"
            )}
          >
            <PlusCircle className="h-5 w-5 shrink-0 transition-transform group-hover:scale-105 duration-300" />
            {!isCollapsed && <span>New Application</span>}
          </Link>
        </div>

        {!isCollapsed && (
          <div className="mt-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 px-3">
            System
          </div>
        )}

        <Link
          href="/settings"
          title="Settings"
          className={cn(
            "flex items-center gap-3 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium",
            isCollapsed ? "justify-center px-0 mt-4" : "px-3",
            isActive('/settings') 
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50"
          )}
        >
          <Settings className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-105 group-hover:rotate-90 duration-300", isActive('/settings') ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-indigo-500")} />
          {!isCollapsed && <span>Settings</span>}
        </Link>

        {user?.role === 'admin' && (
          <Link
            href="/admin/users"
            title="Admin / Users"
            className={cn(
              "flex items-center gap-3 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium",
              isCollapsed ? "justify-center px-0" : "px-3",
              isActive('/admin/users') 
                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50"
            )}
          >
            <Users className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-105", isActive('/admin/users') ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-indigo-500")} />
            {!isCollapsed && <span>Admin / Users</span>}
          </Link>
        )}
      </div>

      {/* User Area - Bottom */}
      {user && (
        <div className="p-3 border-t border-slate-200/50 dark:border-slate-800/50 shrink-0">
          <div className={cn("flex items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer", isCollapsed ? "justify-center p-2" : "gap-3 px-2 py-2")}>
            <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-sm shrink-0">
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {user.email}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
