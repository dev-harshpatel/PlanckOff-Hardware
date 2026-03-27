import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import React from 'react';

describe('App', () => {
    it('renders without crashing and shows login or dashboard', () => {
        render(<App />);
        // Initially we might be redirected to login because isAuthenticated is false
        // But AuthProvider defaults to Alice and setIsAuthenticated(false) in AppContent?
        // Let's check App.tsx source.
        // const [isAuthenticated, setIsAuthenticated] = useState(false);
        // if (!isAuthenticated) return <UserAuthDashboard ... />

        // So we should see "Login" or "Sign Up" or "Welcome" from UserAuthDashboard.
        // Let's check for "Sign In" or "Log In".

        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
});
