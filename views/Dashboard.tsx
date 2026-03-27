
import React, { useState, useMemo, useEffect } from 'react';
import { Project, ProjectStatus, NewProjectData, Toast, Role } from '../types';
import NewProjectModal from '../components/NewProjectModal';
import {
    BuildingOffice2Icon,
    CalendarDaysIcon,
    PencilSquareIcon,
    ArrowTopRightOnSquareIcon,
    MagnifyingGlassIcon,
    TrashIcon,
    UserPlusIcon,
    FunnelIcon,
    ListBulletIcon,
    Squares2X2Icon,
    PlusIcon,
    ChevronDownIcon
} from '../components/icons';
import { TeamMember } from '../types';

interface DashboardProps {
    projects: Project[];
    onSelectProject: (projectId: string) => void;
    onAddNewProject: (projectData: NewProjectData, doorScheduleFile?: File, hardwareSetFile?: File) => Promise<void>;
    onProjectUpdate: (updatedProject: Project) => void;
    onDeleteProject: (projectId: string) => void;
    userRole: Role;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    teamMembers: TeamMember[];
}

const formatDate = (isoDate?: string): string => {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate + 'T00:00:00');
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Kanban Code
const KANBAN_COLUMNS: { id: ProjectStatus; label: string; countColor: string; icon?: React.ReactNode }[] = [
    { id: 'Active', label: 'Working Project Progress', countColor: 'text-green-600' },
    { id: 'Under Review', label: 'Under Review', countColor: 'text-amber-600' },
    { id: 'Submitted', label: 'Submitted', countColor: 'text-blue-600' },
    { id: 'On Hold', label: 'Hold', countColor: 'text-gray-600' },
    { id: 'Archived', label: 'Archive', countColor: 'text-purple-600' }
];

const statusOptions: ProjectStatus[] = ['Active', 'Under Review', 'Submitted', 'On Hold', 'Complete', 'Archived'];
const statusColors: { [key in ProjectStatus]: { bg: string, text: string, border?: string } } = {
    Active: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    'Under Review': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
    Submitted: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    'On Hold': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    Complete: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    Archived: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
};

const ProjectCard: React.FC<{
    project: Project;
    onSelect: () => void;
    onSave: (p: Project) => void;
    onDelete: (id: string) => void;
    userRole: Role;
    teamMembers: TeamMember[];
}> = ({ project, onSelect, onSave, onDelete, userRole, teamMembers }) => {
    const [showAssignMenu, setShowAssignMenu] = useState(false);

    // Check permissions
    const canDelete = (userRole === Role.Administrator || userRole === Role.SeniorEstimator);
    const canAssign = (userRole === Role.Administrator || userRole === Role.SeniorEstimator);

    const assignedMember = teamMembers.find(m => m.id === project.assignedTo);

    const handleAssign = (memberId: string) => {
        onSave({ ...project, assignedTo: memberId });
        setShowAssignMenu(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
            onDelete(project.id);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-4 mb-3 group relative">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h4 onClick={onSelect} className="font-bold text-gray-900 leading-tight cursor-pointer hover:text-primary-600 text-base">{project.name}</h4>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{project.client}</p>
                </div>
                <div className="flex items-center gap-1">
                    {/* Open Project Link - Icon only to save space */}
                    <button onClick={onSelect} className="text-primary-600 hover:text-primary-800 p-1" title="Open Project">
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-xs text-gray-600 mt-3">
                <div className="flex items-center gap-1.5">
                    <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span>{formatDate(project.dueDate)}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-gray-400">#</span>
                    <span>{project.projectNumber || 'N/A'}</span>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 mt-1">
                    {assignedMember ? (
                        <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 max-w-full">
                            <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                                {assignedMember.name.charAt(0)}
                            </div>
                            <span className="truncate">{assignedMember.name}</span>
                        </div>
                    ) : (
                        <span className="text-gray-400 italic">Unassigned</span>
                    )}
                </div>
            </div>

            {/* Hover Actions */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded pl-2">
                {canAssign && (
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowAssignMenu(!showAssignMenu); }}
                            className={`p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 ${project.assignedTo ? 'text-blue-500' : ''}`}
                            title="Assign"
                        >
                            <UserPlusIcon className="w-4 h-4" />
                        </button>
                        {showAssignMenu && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200 py-1" onClick={(e) => e.stopPropagation()}>
                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Assign To</div>
                                {teamMembers.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => handleAssign(m.id)}
                                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${project.assignedTo === m.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                                    >
                                        {m.name}
                                    </button>
                                ))}
                                <button onClick={() => handleAssign('')} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100">Unassign</button>
                            </div>
                        )}
                    </div>
                )}
                {canDelete && (
                    <button onClick={handleDelete} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center">
                <button onClick={onSelect} className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1">
                    Open Project <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </button>
                {/* Status Badge - Optional if strictly column based, but good for clarity */}
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${project.status === 'Active' ? 'bg-green-50 text-green-700' :
                    project.status === 'Under Review' ? 'bg-amber-50 text-amber-700' :
                        project.status === 'Submitted' ? 'bg-blue-50 text-blue-700' :
                            project.status === 'On Hold' ? 'bg-gray-100 text-gray-600' : 'bg-purple-50 text-purple-700'
                    }`}>
                    {project.status || 'Active'}
                </span>
            </div>
        </div>
    );
};


const Dashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, onAddNewProject, onProjectUpdate, onDeleteProject, userRole, addToast, teamMembers }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('All Members');

    // Stats
    const stats = useMemo(() => {
        const counts: Record<string, number> = {};
        KANBAN_COLUMNS.forEach(col => counts[col.id] = 0);
        projects.forEach(p => {
            const status = p.status || 'Active'; // Default to Active
            // Need to map legacy status or handle discrepancies if any
            // For now assume perfect match or fallback
            if (counts[status] !== undefined) {
                counts[status]++;
            } else {
                // Map unknowns if necessary, or count as Active?
                // Let's count 'Active' as 'Active'
                counts['Active']++;
            }
        });
        return counts;
    }, [projects]);


    const filteredProjects = useMemo(() => {
        return projects.filter(project => {
            const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (project.client && project.client.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesMember = selectedMemberFilter === 'All Members' || project.assignedTo === selectedMemberFilter;
            return matchesSearch && matchesMember;
        });
    }, [projects, searchQuery, selectedMemberFilter]);

    const handleSaveNewProject = async (projectData: NewProjectData, doorScheduleFile?: File, hardwareSetFile?: File) => {
        setIsCreatingProject(true);
        try {
            await onAddNewProject(projectData, doorScheduleFile, hardwareSetFile);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Project Creation Error:", error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            addToast({ type: 'error', message: 'Project creation failed', details: message });
        } finally {
            setIsCreatingProject(false);
        }
    };

    // Check create permission (Lead Estimator only - assumed SeniorEstimator)
    const canCreate = (userRole === Role.Administrator || userRole === Role.SeniorEstimator);

    return (
        <>
            <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100">
                {/* Top Stats Bar */}
                <div className="bg-white border-b border-gray-200 px-6 py-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Projects Dashboard</h1>
                            <p className="text-sm text-gray-500 mt-1">Manage your estimates and proposals</p>
                        </div>
                        {canCreate && (
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-md hover:shadow-lg font-semibold"
                            >
                                <PlusIcon className="w-5 h-5" />
                                New Project
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-5 gap-4">
                        {KANBAN_COLUMNS.map(col => {
                            const count = stats[col.id] || 0;
                            return (
                                <div key={col.id} className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{col.label}</p>
                                            <p className={`text-3xl font-bold mt-1 ${col.countColor}`}>{count}</p>
                                        </div>
                                        <div className={`w-12 h-12 rounded-full ${col.countColor.replace('text-', 'bg-').replace('-600', '-100')} flex items-center justify-center`}>
                                            <span className={`text-xl font-bold ${col.countColor}`}>{count}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                            />
                        </div>
                        <div className="relative">
                            <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <select
                                value={selectedMemberFilter}
                                onChange={(e) => setSelectedMemberFilter(e.target.value)}
                                className="pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-medium appearance-none bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                                <option value="All Members">All Members</option>
                                {teamMembers.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        <button className="p-2 rounded-lg bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors">
                            <Squares2X2Icon className="w-5 h-5" />
                        </button>
                        <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                            <ListBulletIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Kanban Board Area */}
                <div className="flex-grow overflow-x-auto overflow-y-hidden px-6 py-6">
                    <div className="flex gap-5 h-full min-w-[1400px]">
                        {KANBAN_COLUMNS.map(col => {
                            const colProjects = filteredProjects.filter(p => (p.status || 'Active') === col.id);
                            return (
                                <div key={col.id} className="flex-1 min-w-[280px] flex flex-col h-full">
                                    {/* Column Header */}
                                    <div className="px-4 py-3 flex items-center justify-between bg-white rounded-t-xl border-b-2 border-gray-200 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${col.countColor.replace('text-', 'bg-')}`}></div>
                                            <h3 className="font-bold text-gray-900 text-sm">{col.label}</h3>
                                        </div>
                                        <span className={`${col.countColor} font-bold text-sm px-2.5 py-1 rounded-full ${col.countColor.replace('text-', 'bg-').replace('-600', '-100')}`}>
                                            {colProjects.length}
                                        </span>
                                    </div>

                                    {/* Column Content (Scrollable) */}
                                    <div className="flex-grow overflow-y-auto bg-gray-50 rounded-b-xl border-l border-r border-b border-gray-200 shadow-sm">
                                        <div className="p-3 space-y-3">
                                            {colProjects.length > 0 ? (
                                                colProjects.map(project => (
                                                    <ProjectCard
                                                        key={project.id}
                                                        project={project}
                                                        onSelect={() => onSelectProject(project.id)}
                                                        onSave={onProjectUpdate}
                                                        onDelete={onDeleteProject}
                                                        userRole={userRole}
                                                        teamMembers={teamMembers}
                                                    />
                                                ))
                                            ) : (
                                                <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-white/50 hover:bg-white transition-colors">
                                                    <div className={`w-10 h-10 rounded-full ${col.countColor.replace('text-', 'bg-').replace('-600', '-100')} flex items-center justify-center mb-2`}>
                                                        <span className={`text-xl ${col.countColor}`}>0</span>
                                                    </div>
                                                    <span className="text-gray-400 text-xs text-center font-medium">No projects<br />in {col.label}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <NewProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveNewProject}
                isLoading={isCreatingProject}
                addToast={addToast}
                teamMembers={teamMembers}
            />
        </>
    );
};

export default Dashboard;
