'use client';

import React from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { LogOut, Moon, Shield, Sun, UserCircle2, Users } from 'lucide-react';
import { Page } from '../types';
import type { AuthUser, RoleName } from '@/types/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  currentPage: Page;
  projectName?: string;
  onNavigate: (page: Page) => void;
  user: AuthUser;
  onLogout: () => Promise<void>;
}

const NavLink: React.FC<{
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ isActive, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
      isActive
        ? 'bg-[var(--primary-bg)] text-[var(--primary-text)] font-semibold border border-[var(--primary-border)]'
        : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
    }`}
  >
    {children}
  </button>
);

const TEAM_ROLES: RoleName[] = ['Administrator', 'Team Lead'];

const Header: React.FC<HeaderProps> = ({ currentPage, projectName, onNavigate, user, onLogout }) => {
  const { theme, setTheme } = useTheme();
  const canManageTeam = TEAM_ROLES.includes(user.role);

  return (
    <header className="bg-[var(--bg)] border-b border-[var(--border)] sticky top-0 z-40 flex-shrink-0">
      <div className="px-6 h-12 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="flex items-center flex-shrink-0">
            <Image
              src="/images/logo.svg"
              alt="PlanckOff"
              width={110}
              height={26}
              priority
            />
          </button>

          {currentPage === 'project' && projectName && (
            <div className="hidden min-w-0 md:block">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                Project
              </div>
              <div className="truncate text-sm font-semibold text-[var(--text)]">
                {projectName}
              </div>
            </div>
          )}
        </div>

        <nav className="flex items-center gap-1">
          <NavLink
            isActive={currentPage === 'dashboard' || currentPage === 'project'}
            onClick={() => onNavigate('dashboard')}
          >
            Dashboard
          </NavLink>
          <NavLink
            isActive={currentPage === 'database'}
            onClick={() => onNavigate('database')}
          >
            Database
          </NavLink>
          {canManageTeam && (
            <NavLink
              isActive={currentPage === 'team'}
              onClick={() => onNavigate('team')}
            >
              Team Management
            </NavLink>
          )}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            <Sun className="w-3.5 h-3.5 dark:hidden" />
            <Moon className="w-3.5 h-3.5 hidden dark:block" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-1 flex items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1 hover:bg-[var(--bg-muted)] transition-colors"
                aria-label="Open profile menu"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary-bg)] text-xs font-semibold text-[var(--primary-text)]">
                  {user.initials || user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-semibold text-[var(--text)]">{user.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{user.role}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuItem className="cursor-default">
                <Shield className="h-4 w-4" />
                <span>{user.role}</span>
              </DropdownMenuItem>
              {canManageTeam && (
                <DropdownMenuItem onClick={() => onNavigate('team')}>
                  <Users className="h-4 w-4" />
                  <span>Team Management</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void onLogout()}>
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
};

export default Header;
