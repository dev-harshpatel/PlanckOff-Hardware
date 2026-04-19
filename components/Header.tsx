'use client';

import React from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Page, Role } from '../types';

interface HeaderProps {
  currentPage: Page;
  projectName?: string;
  onNavigate: (page: Page) => void;
  userRole: Role;
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

const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate, userRole }) => {
  const { theme, setTheme } = useTheme();

  return (
    <header className="bg-[var(--bg)] border-b border-[var(--border)] sticky top-0 z-40 flex-shrink-0">
      <div className="px-6 h-12 flex items-center justify-between">
        <button onClick={() => onNavigate('dashboard')} className="flex items-center">
          <Image
            src="/images/logo.svg"
            alt="PlanckOff"
            width={110}
            height={26}
            priority
          />
        </button>

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
          {(userRole === Role.Administrator || userRole === Role.SeniorEstimator) && (
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
        </nav>
      </div>
    </header>
  );
};

export default Header;
