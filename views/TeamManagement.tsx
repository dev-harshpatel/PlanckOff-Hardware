'use client';

import React, { useState, useMemo } from 'react';
import { TeamMember, Role, TeamMemberStatus } from '../types';
import InviteUserPanel from '../components/InviteUserPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TeamManagementProps {
  teamMembers: TeamMember[];
  onInviteUser: (email: string, role: Role, id: string) => void;
}

const SearchIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
    </svg>
);

const formatDate = (isoDate?: string): string => {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const TeamManagement: React.FC<TeamManagementProps> = ({ teamMembers, onInviteUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TeamMemberStatus | 'all'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof TeamMember; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });

  const handleInvite = (userData: { email: string, role: Role, id: string }) => {
      onInviteUser(userData.email, userData.role, userData.id);
  };

  const handleSort = (key: keyof TeamMember) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const filteredAndSortedMembers = useMemo(() => {
    let result = [...teamMembers];
    
    // Filtering
    result = result.filter(member => {
        const searchMatch = searchQuery.trim() === '' || 
                            member.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            member.email.toLowerCase().includes(searchQuery.toLowerCase());
        const roleMatch = roleFilter === 'all' || member.role === roleFilter;
        const statusMatch = statusFilter === 'all' || member.status === statusFilter;
        return searchMatch && roleMatch && statusMatch;
    });

    // Sorting
    if (sortConfig !== null) {
        result.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    return result;
  }, [teamMembers, searchQuery, roleFilter, statusFilter, sortConfig]);

  const SortIcon: React.FC<{ columnKey: keyof TeamMember }> = ({ columnKey }) => {
    if (sortConfig?.key !== columnKey) {
        return <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z" /><path d="M5 14l5 5 5-5H5z" /></svg>;
    }
    return sortConfig.direction === 'asc' ? (
        <svg className="w-3 h-3 text-primary-600" fill="currentColor" viewBox="0 0 20 20"><path d="M5 14l5-5 5 5H5z" /></svg>
    ) : (
        <svg className="w-3 h-3 text-primary-600" fill="currentColor" viewBox="0 0 20 20"><path d="M5 6l5 5 5-5H5z" /></svg>
    );
  };
  
  const renderHeader = (label: string, key: keyof TeamMember) => (
      <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-200 group" onClick={() => handleSort(key)}>
          <div className="flex items-center gap-1">
            {label}
            <SortIcon columnKey={key} />
          </div>
      </th>
  );


  return (
    <>
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between mb-6 gap-6">
            <div className="flex-grow min-w-[600px]">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Team Management</h2>
                <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row items-center gap-4">
                        <div className="relative w-full md:w-1/3">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                        </div>
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <Select value={roleFilter} onValueChange={v => setRoleFilter(v as Role | 'all')}>
                                <SelectTrigger className="w-full md:w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Roles</SelectItem>
                                    {Object.values(Role).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as TeamMemberStatus | 'all')}>
                                <SelectTrigger className="w-full md:w-auto min-w-[140px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                        <tr>
                            {renderHeader('Name', 'name')}
                            {renderHeader('Email', 'email')}
                            {renderHeader('Role', 'role')}
                            {renderHeader('Status', 'status')}
                            {renderHeader('Last Active', 'lastActive')}
                            <th scope="col" className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedMembers.map(member => (
                        <tr key={member.id} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-900">{member.name}</td>
                            <td className="px-6 py-4">{member.email}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    member.role === Role.Administrator ? 'bg-red-100 text-red-800' :
                                    member.role === Role.SeniorEstimator ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>
                                    {member.role}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center">
                                    <div className={`h-2.5 w-2.5 rounded-full mr-2 ${member.status === 'Active' ? 'bg-green-500' : 'bg-yellow-400'}`}></div>
                                    {member.status}
                                </div>
                            </td>
                            <td className="px-6 py-4">{formatDate(member.lastActive)}</td>
                            <td className="px-6 py-4 text-right">
                                {member.status === 'Pending' ? (
                                    <button
                                        onClick={() => alert(`Resending invite to ${member.email}`)}
                                        className="font-medium text-primary-600 hover:text-primary-800"
                                    >
                                        Resend Invite
                                    </button>
                                ) : (
                                    <button
                                        className="font-medium text-gray-400 cursor-not-allowed"
                                        disabled
                                    >
                                        —
                                    </button>
                                )}
                            </td>
                        </tr>
                        ))}
                        {filteredAndSortedMembers.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-gray-500">
                                    No team members found matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    </table>
                </div>
                </div>
            </div>
            
            {/* New Invite User Panel */}
            <div className="w-full lg:w-96 flex-shrink-0">
                <InviteUserPanel onInvite={handleInvite} />
            </div>
        </div>
      </div>
    </>
  );
};

export default TeamManagement;
