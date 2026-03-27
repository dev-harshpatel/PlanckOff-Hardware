
import React, { useState, useEffect, useRef } from 'react';
import { ProjectStatus, NewProjectData, Toast, TeamMember } from '../types';
import {
  BuildingOffice2Icon,
  CalendarDaysIcon,
  MapPinIcon,
  UserIcon,
  CheckIcon
} from './icons';

const statusOptions: { id: ProjectStatus; label: string }[] = [
  { id: 'Active', label: 'In Progress' },
  { id: 'Under Review', label: 'Review' },
  { id: 'Submitted', label: 'Submitted' },
  { id: 'On Hold', label: 'Hold' },
  { id: 'Archived', label: 'Archive' }
];

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (projectData: NewProjectData, doorScheduleFile?: File, hardwareSetFile?: File) => void;
  isLoading: boolean;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  teamMembers?: TeamMember[];
}

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onSave, isLoading, addToast, teamMembers = [] }) => {
  const [projectData, setProjectData] = useState<NewProjectData>({
    name: '',
    description: '',
    client: '',
    location: '',
    dueDate: '',
    status: 'Active',
    projectNumber: '',
    assignedTo: ''
  });

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setProjectData({
        name: '',
        description: '',
        client: '',
        location: '',
        dueDate: '',
        status: 'Active',
        projectNumber: '',
        assignedTo: teamMembers.length > 0 ? teamMembers[0].id : ''
      });
    }
  }, [isOpen, teamMembers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProjectData(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (status: ProjectStatus) => {
    setProjectData(prev => ({ ...prev, status }));
  };

  const handleSave = () => {
    if (projectData.name.trim()) {
      onSave(projectData, undefined, undefined);
    } else {
      addToast({ type: 'error', message: 'Project Name is required.' });
    }
  };

  if (!isOpen) return null;

  const isSaveDisabled = projectData.name.trim() === '' || isLoading;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
      onClick={isLoading ? undefined : onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">New Project</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Project Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <BuildingOffice2Icon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="name"
                id="name"
                value={projectData.name}
                onChange={handleInputChange}
                placeholder="e.g. Skyline Apartments Phase 2"
                className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Client and Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="client" className="block text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Client / Company <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <BuildingOffice2Icon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="client"
                  id="client"
                  value={projectData.client}
                  onChange={handleInputChange}
                  placeholder="e.g. Apex Construction"
                  className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Project Location <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MapPinIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="location"
                  id="location"
                  value={projectData.location}
                  onChange={handleInputChange}
                  placeholder="e.g. New York, NY"
                  className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Project Number and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="projectNumber" className="block text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Project #
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-400 font-medium">#</span>
                </div>
                <input
                  type="text"
                  name="projectNumber"
                  id="projectNumber"
                  value={projectData.projectNumber}
                  onChange={handleInputChange}
                  placeholder="Auto-generated if empty"
                  className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="dueDate" className="block text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Due Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  name="dueDate"
                  id="dueDate"
                  value={projectData.dueDate}
                  onChange={handleInputChange}
                  className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Assign To */}
          {teamMembers.length > 0 && (
            <div>
              <label htmlFor="assignedTo" className="block text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Assign To <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  name="assignedTo"
                  id="assignedTo"
                  value={projectData.assignedTo}
                  onChange={handleInputChange}
                  className="block w-full pl-12 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base disabled:bg-gray-50 disabled:text-gray-500 transition-colors appearance-none cursor-pointer"
                  disabled={isLoading}
                >
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.role})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Status Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2 bg-gray-100 p-2 rounded-xl">
              {statusOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleStatusChange(option.id)}
                  disabled={isLoading}
                  className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${projectData.status === option.id
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex justify-between gap-4 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-base font-semibold disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="flex-1 max-w-xs flex items-center justify-center gap-2 px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                Create Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewProjectModal;
