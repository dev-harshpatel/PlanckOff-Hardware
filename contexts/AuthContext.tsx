import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TeamMember, Role } from '../types';

interface AuthContextType {
    currentUser: TeamMember | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ error: any }>;
    register: (email: string, password: string) => Promise<{ error: any }>;
    logout: () => void;
    teamMembers: TeamMember[];
    inviteUser: (email: string, role: Role) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initialize with a default user to bypass login screen
    const [currentUser, setCurrentUser] = useState<TeamMember | null>(() => {
        const stored = localStorage.getItem('mock_user');
        if (stored) {
            const user = JSON.parse(stored);
            // Fix: Force update role to Administrator if it's not (to fix missing UI elements for existing users)
            if (user.role !== Role.Administrator) {
                user.role = Role.Administrator;
                localStorage.setItem('mock_user', JSON.stringify(user));
            }
            return user;
        }

        return {
            id: 'default-estimator',
            name: 'Estimator',
            email: 'estimator@value-engineering.com',
            role: Role.Administrator,
            status: 'Active',
            lastActive: new Date().toISOString()
        };
    });

    // Always start authenticated
    const [isAuthenticated, setIsAuthenticated] = useState(true);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    useEffect(() => {
        // Persist the user if it was auto-generated
        if (currentUser && !localStorage.getItem('mock_user')) {
            localStorage.setItem('mock_user', JSON.stringify(currentUser));
        }
    }, [currentUser]);

    const login = async () => { return { error: null }; };
    const register = async () => { return { error: null }; };

    const logout = async () => {
        // No-op or reset default
        setIsAuthenticated(true);
    };

    const inviteUser = async (email: string, role: Role) => {
        const newUser: TeamMember = {
            id: `temp-${Date.now()}`,
            name: email.split('@')[0],
            email,
            role,
            status: 'Pending',
            lastActive: ''
        };
        setTeamMembers(prev => [...prev, newUser]);
    };

    return (
        <AuthContext.Provider value={{
            currentUser,
            isAuthenticated,
            login,
            register,
            logout,
            teamMembers,
            inviteUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
