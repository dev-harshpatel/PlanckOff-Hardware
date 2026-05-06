
import React, { useState } from 'react';
import { Role } from '../../types';
import {
  EnvelopeIcon,
  UserPlusIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  LockClosedIcon
} from '../shared/icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface InviteUserPanelProps {
  onInvite: (userData: { email: string; role: Role; id: string; }) => void;
}

const InviteUserPanel: React.FC<InviteUserPanelProps> = ({ onInvite }) => {
  const [view, setView] = useState<'form' | 'success'>('form');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.Estimator);
  
  // Generated Credentials State
  const [generatedId, setGeneratedId] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const generateCredentials = () => {
    // Generate User ID (e.g., USR-8921)
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const newId = `USR-${randomId}`;

    // Generate Temp Password (e.g., Tve#9X2p)
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    let newPassword = "";
    for (let i = 0; i < 10; i++) {
        newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setGeneratedId(newId);
    setGeneratedPassword(newPassword);
    
    return { newId, newPassword };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const { newId } = generateCredentials();
    
    // Trigger parent action
    onInvite({ email, role, id: newId });
    
    // Switch view
    setView('success');
  };

  const copyToClipboard = () => {
    const text = `User ID: ${generatedId}\nPassword: ${generatedPassword}\nLogin URL: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const resetForm = () => {
    setEmail('');
    setRole(Role.Estimator);
    setView('form');
    setIsCopied(false);
  };

  if (view === 'success') {
      return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden w-full h-fit">
            <div className="bg-green-50 p-6 border-b border-green-100 flex flex-col items-center text-center">
                <div className="rounded-full bg-green-100 p-3 mb-3">
                    <CheckCircleIcon className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-green-900">User Invited Successfully</h3>
                <p className="text-green-700 text-sm mt-1">
                    Please copy these temporary credentials and send them to the user securely.
                </p>
            </div>

            <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Invitee</label>
                        <p className="text-gray-900 font-medium">{email}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">User ID</label>
                            <div className="font-mono text-lg font-bold text-primary-700 mt-1 select-all">{generatedId}</div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Temp Password</label>
                            <div className="font-mono text-lg font-bold text-primary-700 mt-1 select-all">{generatedPassword}</div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={copyToClipboard}
                    className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${
                        isCopied 
                        ? 'bg-green-600 text-white' 
                        : 'bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg'
                    }`}
                >
                    {isCopied ? <CheckCircleIcon className="w-5 h-5" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
                    {isCopied ? 'Copied to Clipboard' : 'Copy Credentials'}
                </button>

                <button 
                    onClick={resetForm}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                    Invite Another User
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-full h-fit">
      {/* Header */}
      <div className="bg-primary-900 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary-800 p-2 rounded-lg">
                <UserPlusIcon className="w-6 h-6 text-primary-300" />
            </div>
            <div>
                <h2 className="text-lg font-bold">Invite New User</h2>
                <p className="text-primary-200 text-xs">Generate credentials for team access</p>
            </div>
          </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email Address</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <EnvelopeIcon className="w-5 h-5" />
            </div>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Access Role</label>
            <Select value={role} onValueChange={v => setRole(v as Role)}>
                <SelectTrigger className="w-full h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {Object.values(Role).map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-3">
             <LockClosedIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
             <p className="text-xs text-blue-800 leading-relaxed">
                A secure <strong>User ID</strong> and <strong>Temporary Password</strong> will be generated automatically upon creation. You must share these with the user manually.
             </p>
        </div>

        <button 
            type="submit"
            disabled={!email}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
            <ArrowPathIcon className="w-4 h-4" />
            Generate Credentials & Invite
        </button>
      </form>
    </div>
  );
};

export default InviteUserPanel;
