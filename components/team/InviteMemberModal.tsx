import React, { useState } from 'react';
import { Role } from '../../types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: Role) => void;
  isLoading: boolean;
}

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
            <Select value={role} onValueChange={v => setRole(v as Role)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(Role).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
          <Button onClick={onClose} variant="outline" className="bg-white">
            Cancel
          </Button>
          <Button
            onClick={handleInviteClick}
            disabled={!email.trim() || isLoading}
            loading={isLoading}
            loadingText="Sending Invite..."
            className="w-32"
          >
            Send Invite
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InviteMemberModal;
