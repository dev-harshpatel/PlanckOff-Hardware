
import React, { useState } from 'react';
import { Role } from '../types';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: Role) => void;
  isLoading: boolean;
}

const LoadingSpinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ isOpen, onClose, onInvite, isLoading }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.Estimator);
  const [error, setError] = useState('');

  const handleInviteClick = () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    onInvite(email, role);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Invite New Team Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700">Email Address</label>
            <input 
              type="email" 
              id="inviteEmail" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              placeholder="name@company.com"
              required
            />
          </div>
          <div>
            <label htmlFor="inviteRole" className="block text-sm font-medium text-gray-700">Role</label>
            <select
              id="inviteRole"
              value={role}
              onChange={e => setRole(e.target.value as Role)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 text-sm font-semibold"
          >
            Cancel
          </button>
          <button 
            onClick={handleInviteClick}
            disabled={!email.trim() || isLoading}
            className="w-32 flex justify-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-semibold disabled:opacity-50"
          >
            {isLoading ? <LoadingSpinner /> : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteMemberModal;
