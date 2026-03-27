
import React, { useState } from 'react';
import { Role } from '../types';
import {
  EnvelopeIcon,
  LockClosedIcon,
  UserPlusIcon,
  ArrowRightOnRectangleIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ShieldCheckIcon
} from './icons';
import { useAuth } from '../contexts/AuthContext';


// Custom SVG Logo for The Value Engineering
const TveLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className={className} fill="none">
    {/* T */}
    <path d="M20 20 H80 V35 H60 V80 H40 V35 H20 Z" fill="#ecfeff" />
    {/* V */}
    <path d="M85 20 L105 80 L125 20 H105 L105 20 Z" stroke="#ecfeff" strokeWidth="15" strokeLinejoin="round" />
    <path d="M82 20 L105 85 L128 20" fill="none" stroke="#ecfeff" strokeWidth="15" strokeLinecap="square" />
    {/* E */}
    <path d="M135 20 H180 V35 H155 V42 H175 V55 H155 V65 H180 V80 H135 Z" fill="#ecfeff" />

    {/* Swoosh */}
    <path d="M50 10 Q 100 5, 140 40" stroke="#84cc16" strokeWidth="3" fill="none" opacity="0.9" />
    <path d="M100 90 Q 150 95, 190 50" stroke="#84cc16" strokeWidth="3" fill="none" opacity="0.9" />
  </svg>
);

interface UserAuthDashboardProps {
  initialTab?: 'auth' | 'invite';
  onLogin?: () => void;
  onInvite?: (email: string, role: Role) => void;
  isLoading?: boolean;
}

const UserAuthDashboard: React.FC<UserAuthDashboardProps> = ({
  initialTab = 'auth',
  isLoading = false
}) => {
  const [activeTab, setActiveTab] = useState<'auth' | 'invite'>(initialTab);


  return (
    <div className="flex items-center justify-center p-4 font-sans text-gray-800 w-full">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">

        {/* Header Section */}
        <div className="bg-primary-900 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-10">
            <TveLogo className="w-48 h-24" />
          </div>
          <div className="flex flex-col items-center justify-center gap-3 mb-2 relative z-10">
            <TveLogo className="w-24 h-12" />
            <h1 className="text-xl font-bold tracking-wide text-center">The Value Engineering</h1>
          </div>
          <p className="text-primary-200 text-sm text-center relative z-10">Estimating & Team Portal</p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex p-2 bg-gray-100 m-4 rounded-lg">
          <button
            onClick={() => setActiveTab('auth')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === 'auth'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Login / Register
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === 'invite'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <UserPlusIcon className="w-4 h-4" />
            Invite User
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 pt-2">
          {activeTab === 'auth' ? <AuthForm /> : <InviteForm isLoading={isLoading} />}
        </div>
      </div>
    </div>
  );
};

// --- Tab 1: Authentication Form ---
const AuthForm: React.FC = () => {
  const { login, register } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');

    try {
      if (isLogin) {
        const { error } = await login(email, password);
        if (error) throw error;
      } else {
        const { error } = await register(email, password);
        if (error) throw error;
        setSuccessMessage('Account created! Please check your email to confirm.');
      }
    } catch (error: any) {
      alert(error.message || "Authentication failed"); // Simple alert for now
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successMessage) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 animate-fade-in">
        <div className="rounded-full bg-green-100 p-3">
          <CheckCircleIcon className="w-12 h-12 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">{successMessage}</h3>
        <p className="text-gray-500 text-sm">Redirecting to workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {isLogin ? 'Enter your credentials to access your dashboard.' : 'Sign up to get started with the platform.'}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Email Address</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none">
              <EnvelopeIcon className="w-5 h-5" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Password</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none">
              <LockClosedIcon className="w-5 h-5" />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              required
            />
          </div>
        </div>

        {!isLogin && (
          <div className="text-xs text-gray-500 flex items-start gap-2 bg-blue-50 p-3 rounded-lg text-blue-700">
            <div className="min-w-[4px] h-[4px] rounded-full bg-blue-500 mt-1.5"></div>
            By clicking register, you agree to our Terms of Service and Privacy Policy.
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-wait"
        >
          {isSubmitting ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <>
              {isLogin ? 'Sign In' : 'Create Account'}
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-4">
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setEmail('');
            setPassword('');
          }}
          className="text-sm text-primary-600 hover:text-primary-800 font-medium hover:underline transition-colors"
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
};

// --- Tab 2: Invitation & Password Generation Form ---
const InviteForm: React.FC<{ isLoading?: boolean }> = ({ isLoading }) => {
  const { inviteUser } = useAuth();
  const onInvite = inviteUser;

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.Estimator);
  const [tempPassword, setTempPassword] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      const randomNumber = Math.floor(Math.random() * chars.length);
      password += chars.substring(randomNumber, randomNumber + 1);
    }
    setTempPassword(password);
    setIsCopied(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tempPassword);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (onInvite) onInvite(email, role);
    setEmail('');
    setTempPassword('');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 rounded-full bg-primary-50 text-primary-600 mb-3">
          <UserPlusIcon className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Invite New Member</h2>
        <p className="text-gray-500 text-sm mt-1">
          Send an invitation link with a temporary secure credential.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleInvite}>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Invitee Email</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none">
              <EnvelopeIcon className="w-5 h-5" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
          >
            {Object.values(Role).map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-gray-500 uppercase">Temporary Credential</label>
            <button
              type="button"
              onClick={generatePassword}
              className="text-xs flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium transition-colors"
            >
              <ArrowPathIcon className="w-3 h-3" />
              {tempPassword ? 'Regenerate' : 'Generate'}
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2.5 font-mono text-sm text-gray-700 tracking-wider truncate min-h-[42px] flex items-center">
              {tempPassword || <span className="text-gray-300 select-none">Click generate...</span>}
            </div>
            <button
              type="button"
              disabled={!tempPassword}
              onClick={copyToClipboard}
              className={`p-2.5 rounded-lg border transition-all duration-200 ${tempPassword
                  ? 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                  : 'bg-gray-100 border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              title="Copy to clipboard"
            >
              {isCopied ? <CheckCircleIcon className="w-5 h-5 text-green-600" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          disabled={!email || !tempPassword || isLoading}
          className="w-full bg-primary-900 hover:bg-primary-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 mt-4"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <>
              <EnvelopeIcon className="w-4 h-4" />
              Send Invitation
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default UserAuthDashboard;
