'use client';

import Image from 'next/image';
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
    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
      isActive
        ? 'bg-green-50 text-green-700 font-semibold'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`}
  >
    {children}
  </button>
);

import React from 'react';

const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate, userRole }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => onNavigate('dashboard')} className="flex items-center">
          <Image
            src="/images/logo.svg"
            alt="PlanckOff"
            width={120}
            height={28}
            priority
          />
        </button>

        {/* Nav */}
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
        </nav>
      </div>
    </header>
  );
};

export default Header;
