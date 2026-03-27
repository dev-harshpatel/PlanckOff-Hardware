

import React from 'react';
import { Page, Role } from '../types';

// Custom SVG Logo approximating the TVE Logo
const TveLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className={className} fill="none">
        {/* T */}
        <path d="M20 20 H80 V35 H60 V80 H40 V35 H20 Z" fill="#22d3ee" />
        {/* V */}
        <path d="M85 20 L105 80 L125 20 H105 L105 20 Z" stroke="#22d3ee" strokeWidth="15" strokeLinejoin="round" />
        <path d="M82 20 L105 85 L128 20" fill="none" stroke="#22d3ee" strokeWidth="15" strokeLinecap="square" />
        {/* E */}
        <path d="M135 20 H180 V35 H155 V42 H175 V55 H155 V65 H180 V80 H135 Z" fill="#22d3ee" />

        {/* Swoosh (approximate) */}
        <path d="M50 10 Q 100 5, 140 40" stroke="#84cc16" strokeWidth="3" fill="none" opacity="0.8" />
        <path d="M100 90 Q 150 95, 190 50" stroke="#84cc16" strokeWidth="3" fill="none" opacity="0.8" />
    </svg>
);

interface HeaderProps {
    currentPage: Page;
    projectName?: string;
    onNavigate: (page: Page) => void;
    onOpenSettings: () => void;
    userRole: Role;
}

const NavLink: React.FC<{
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ isActive, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${isActive
            ? 'bg-primary-100 text-primary-700'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
    >
        {children}
    </button>
);

const CogIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 5.389c-.42.18-.81.406-1.174.659l-2.116-1.196a1.908 1.908 0 00-2.618.786l-1.957 3.39c-.482.834-.159 1.907.569 2.461l1.82 1.37c-.026.246-.04.497-.04.75 0 .253.015.504.04.75l-1.82 1.37c-.728.553-1.051 1.627-.569 2.461l1.957 3.391a1.908 1.908 0 002.618.786l2.116-1.196c.364.253.754.479 1.174.659l.179 1.572c.15.904.933 1.567 1.85 1.567h3.914c.916 0 1.699-.663 1.85-1.567l.179-1.572c.42-.18.81-.406 1.174-.659l2.116 1.196a1.908 1.908 0 002.618-.786l1.957-3.39c.482-.834.159 1.907-.569-2.461l-1.82-1.37c.026-.246.04-.497.04-.75 0 .253-.015.504-.04-.75l1.82-1.37c.728.553-1.051 1.627.569-2.461l-1.957-3.39a1.908 1.908 0 00-2.618-.786l-2.116 1.196a8.57 8.57 0 00-1.174-.659l-.179-1.572a1.909 1.909 0 00-1.85-1.567h-3.914zm2.574 11.75a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
);


const Header: React.FC<HeaderProps> = ({ currentPage, projectName, onNavigate, onOpenSettings, userRole }) => {
    return (
        <header className="bg-white shadow-md sticky top-0 z-40 border-b border-primary-100">
            <div className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center">
                    {/* Logo Container */}
                    <div className="mr-4 flex flex-col items-center justify-center">
                        <TveLogo className="w-16 h-10" />
                    </div>

                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-primary-500 leading-none">
                            THE VALUE <span className="text-[#84cc16]">ENGINEERING</span>
                        </h1>
                        {currentPage === 'project' && projectName ? (
                            <p className="text-sm text-gray-500 mt-1">
                                <button onClick={() => onNavigate('dashboard')} className="hover:underline">Projects</button>
                                <span className="mx-1">/</span>
                                <span className="font-semibold text-primary-700">{projectName}</span>
                            </p>
                        ) : (
                            <p className="text-sm font-medium text-gray-500 tracking-wide mt-1">Hardware Estimating</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <nav className="flex items-center gap-2">
                        <NavLink isActive={currentPage === 'dashboard' || currentPage === 'project'} onClick={() => onNavigate('dashboard')}>
                            Dashboard
                        </NavLink>
                        <NavLink isActive={currentPage === 'database'} onClick={() => onNavigate('database')}>
                            Database
                        </NavLink>
                        {(userRole === Role.Administrator || userRole === Role.SeniorEstimator) && (
                            <NavLink isActive={currentPage === 'team'} onClick={() => onNavigate('team')}>
                                Team Management
                            </NavLink>
                        )}
                    </nav>
                    <div className="border-l border-gray-300 h-6"></div>
                    {userRole === Role.Administrator && (
                        <button
                            onClick={onOpenSettings}
                            className="text-gray-500 hover:text-primary-600 transition-colors p-1.5 rounded-full hover:bg-gray-100"
                            title="Settings"
                        >
                            <CogIcon className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
