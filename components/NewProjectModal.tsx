import React, { useState, useEffect } from 'react';
import { ProjectStatus, NewProjectData, Toast, TeamMember } from '../types';
import {
  BuildingOffice2Icon,
  CalendarDaysIcon,
  MapPinIcon,
  UserIcon,
  CheckIcon
} from './icons';
import { PROJECT_LOCATION_OPTIONS, buildProjectLocationLabel, type CountryOption } from '@/lib/project-locations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  <svg className="h-4 w-4 animate-spin text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
    country: '',
    province: '',
    dueDate: '',
    status: 'Active',
    projectNumber: '',
    assignedTo: ''
  });
  const [locationOptions, setLocationOptions] = useState<CountryOption[]>(PROJECT_LOCATION_OPTIONS);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setProjectData({
        name: '',
        description: '',
        client: '',
        location: '',
        country: '',
        province: '',
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

  const handleCountryChange = (country: string) => {
    setProjectData(prev => ({
      ...prev,
      country,
      province: '',
      location: buildProjectLocationLabel(country, ''),
    }));
  };

  const handleProvinceChange = (province: string) => {
    setProjectData(prev => ({
      ...prev,
      province,
      location: buildProjectLocationLabel(prev.country, province),
    }));
  };

  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/project-locations', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { data: PROJECT_LOCATION_OPTIONS }))
      .then((json: { data?: CountryOption[] }) => {
        setLocationOptions(json.data?.length ? json.data : PROJECT_LOCATION_OPTIONS);
      })
      .catch(() => {
        setLocationOptions(PROJECT_LOCATION_OPTIONS);
      });
  }, [isOpen]);

  const countryOptions = locationOptions.map((country) => ({
    value: country.name,
    label: country.name,
  }));

  const provinceOptions = (locationOptions.find((country) => country.name === projectData.country)?.provinces ?? []).map((province) => ({
    value: province.name,
    label: province.name,
  }));

  const handleSave = () => {
    if (!projectData.name.trim()) {
      addToast({ type: 'error', message: 'Project Name is required.' });
      return;
    }

    if (!projectData.country?.trim()) {
      addToast({ type: 'error', message: 'Project country is required.' });
      return;
    }

    if (!projectData.province?.trim()) {
      addToast({ type: 'error', message: 'Project province is required.' });
      return;
    }

    onSave({
      ...projectData,
      location: buildProjectLocationLabel(projectData.country, projectData.province),
    }, undefined, undefined);
  };

  const isSaveDisabled = projectData.name.trim() === '' || !projectData.country || !projectData.province || isLoading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isLoading) onClose(); }}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-gray-100 px-6 py-5">
          <DialogTitle className="text-xl">New Project</DialogTitle>
          <DialogDescription>
            Capture the core project details before moving into estimating.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* Project Name */}
          <div>
            <Label htmlFor="name" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              Project Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <BuildingOffice2Icon className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                type="text"
                name="name"
                id="name"
                value={projectData.name}
                onChange={handleInputChange}
                placeholder="e.g. Skyline Apartments Phase 2"
                className="h-11 rounded-lg pl-9"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="client" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              Client / Company <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <BuildingOffice2Icon className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                type="text"
                name="client"
                id="client"
                value={projectData.client}
                onChange={handleInputChange}
                placeholder="e.g. Apex Construction"
                className="h-11 rounded-lg pl-9"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="country" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Project Location <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
                  <MapPinIcon className="h-4 w-4 text-gray-400" />
                </div>
                <Select value={projectData.country ?? ''} onValueChange={handleCountryChange} disabled={isLoading}>
                  <SelectTrigger id="country" className="h-11 rounded-lg pl-9">
                    <SelectValue placeholder="Select country..." />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="province" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Project Province <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
                  <MapPinIcon className="h-4 w-4 text-gray-400" />
                </div>
                <Select value={projectData.province ?? ''} onValueChange={handleProvinceChange} disabled={isLoading || !projectData.country}>
                  <SelectTrigger id="province" className="h-11 rounded-lg pl-9">
                    <SelectValue placeholder={projectData.country ? 'Select province...' : 'Select country first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {provinceOptions.map((province) => (
                      <SelectItem key={province.value} value={province.value}>
                        {province.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Project Number and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="projectNumber" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Project #
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-sm font-medium text-gray-400">#</span>
                </div>
                <Input
                  type="text"
                  name="projectNumber"
                  id="projectNumber"
                  value={projectData.projectNumber}
                  onChange={handleInputChange}
                  placeholder="Auto-generated if empty"
                  className="h-11 rounded-lg pl-9"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="dueDate" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Due Date <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  type="date"
                  name="dueDate"
                  id="dueDate"
                  value={projectData.dueDate}
                  onChange={handleInputChange}
                  className="h-11 rounded-lg pl-9"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Assign To */}
          {teamMembers.length > 0 && (
            <div>
              <Label htmlFor="assignedTo" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Assign To <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                </div>
                <Select value={projectData.assignedTo} onValueChange={(value) => setProjectData(prev => ({ ...prev, assignedTo: value }))} disabled={isLoading}>
                  <SelectTrigger id="assignedTo" className="h-11 rounded-lg pl-9">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Status Selector */}
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              Status <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-5 gap-2 rounded-lg bg-gray-100 p-1.5">
              {statusOptions.map(option => (
                <Button
                  key={option.id}
                  type="button"
                  onClick={() => handleStatusChange(option.id)}
                  disabled={isLoading}
                  variant={projectData.status === option.id ? 'outline' : 'ghost'}
                  size="sm"
                  className={projectData.status === option.id ? 'border-gray-200 bg-white text-primary-700 shadow-sm' : 'text-gray-600'}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-gray-100 bg-gray-50 px-6 py-4 sm:justify-between">
          <Button
            onClick={onClose}
            disabled={isLoading}
            variant="outline"
            className="min-w-[112px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="min-w-[160px]"
          >
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Create Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectModal;
