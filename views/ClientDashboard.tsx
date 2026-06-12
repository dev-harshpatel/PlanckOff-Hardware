'use client';

import React, { useMemo, useState } from 'react';
import { Project } from '../types';
import { useAuth } from '@/contexts/AuthContext';
import {
    MapPin, Calendar, Search, FolderOpen, Clock,
    CheckCircle2, PauseCircle, ArchiveIcon, ArrowUpRight,
    Layers, FileText,
} from 'lucide-react';

interface ClientDashboardProps {
    projects: Project[];
    onSelectProject: (projectId: string) => void;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; ring: string; dot: string; Icon: React.ElementType }> = {
    'Active':       { label: 'Active',       color: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-200', dot: 'bg-emerald-500', Icon: CheckCircle2 },
    'Under Review': { label: 'Under Review', color: 'text-amber-700',   bg: 'bg-amber-50',    ring: 'ring-amber-200',   dot: 'bg-amber-500',   Icon: Clock },
    'Submitted':    { label: 'Submitted',    color: 'text-blue-700',    bg: 'bg-blue-50',     ring: 'ring-blue-200',    dot: 'bg-blue-500',    Icon: FileText },
    'On Hold':      { label: 'On Hold',      color: 'text-slate-600',   bg: 'bg-slate-100',   ring: 'ring-slate-200',   dot: 'bg-slate-400',   Icon: PauseCircle },
    'Complete':     { label: 'Complete',     color: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-200', dot: 'bg-emerald-500', Icon: CheckCircle2 },
    'Archived':     { label: 'Archived',     color: 'text-purple-700',  bg: 'bg-purple-50',   ring: 'ring-purple-200',  dot: 'bg-purple-500',  Icon: ArchiveIcon },
    'Client':       { label: 'In Review',    color: 'text-teal-700',    bg: 'bg-teal-50',     ring: 'ring-teal-200',    dot: 'bg-teal-500',    Icon: Clock },
};

const DEFAULT_STATUS = STATUS_META['Active'];

function getStatusMeta(status?: string) {
    return STATUS_META[status ?? 'Active'] ?? DEFAULT_STATUS;
}

function formatDate(iso?: string) {
    if (!iso) return null;
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}


interface ProjectCardProps {
    project: Project;
    onClick: () => void;
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
    const meta = getStatusMeta(project.status);
    const { Icon } = meta;
    const due = formatDate(project.dueDate);

    return (
        <button
            onClick={onClick}
            className="group w-full text-left bg-white dark:bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ring)]"
        >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg} ring-1 ${meta.ring}`}>
                        <FolderOpen className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)] truncate leading-tight">{project.name}</p>
                        {project.projectNumber && (
                            <p className="text-[11px] text-[var(--text-faint)] font-mono mt-0.5">#{project.projectNumber}</p>
                        )}
                    </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
            </div>

            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${meta.bg} ${meta.color} ring-1 ${meta.ring}`}>
                <Icon className="w-3 h-3" />
                {meta.label}
            </span>

            {/* Divider */}
            <div className="border-t border-[var(--border-subtle)] my-4" />

            {/* Meta info */}
            <div className="space-y-2">
                {project.client && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <Layers className="w-3.5 h-3.5 text-[var(--text-faint)] flex-shrink-0" />
                        <span className="truncate">{project.client}</span>
                    </div>
                )}
                {project.location && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <MapPin className="w-3.5 h-3.5 text-[var(--text-faint)] flex-shrink-0" />
                        <span className="truncate">{project.location}</span>
                    </div>
                )}
                {due && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <Calendar className="w-3.5 h-3.5 text-[var(--text-faint)] flex-shrink-0" />
                        <span>{due}</span>
                    </div>
                )}
            </div>
        </button>
    );
}

export default function ClientDashboard({ projects, onSelectProject }: ClientDashboardProps) {
    const { user } = useAuth();
    const [search, setSearch] = useState('');

    const firstName = useMemo(() => {
        if (!user?.name) return 'there';
        return user.name.split(' ')[0];
    }, [user?.name]);

    const totalProjects = projects.length;

    const filtered = useMemo(() => {
        if (!search.trim()) return projects;
        const q = search.toLowerCase();
        return projects.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.client ?? '').toLowerCase().includes(q) ||
            (p.location ?? '').toLowerCase().includes(q) ||
            (p.projectNumber ?? '').toLowerCase().includes(q),
        );
    }, [projects, search]);

    return (
        <div className="flex flex-col min-h-full bg-[var(--bg-subtle)]">

            {/* ── Hero banner ── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-6 py-7 flex-shrink-0">
                {/* Decorative blobs */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
                    <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-indigo-500/10 blur-2xl" />
                </div>

                <div className="relative max-w-5xl mx-auto flex items-center justify-between gap-6">
                    <div>
                        <p className="text-blue-300 text-sm font-medium mb-0.5 tracking-wide">{getGreeting()},</p>
                        <h1 className="text-2xl font-bold text-white">{firstName}</h1>
                    </div>

                    {/* Inline total badge */}
                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-3 flex-shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <FolderOpen className="w-4 h-4 text-blue-300" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-white leading-none">{totalProjects}</p>
                            <p className="text-xs text-blue-200 mt-0.5">Total Projects</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Project list ── */}
            <div className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">

                {projects.length > 0 && (
                    <>
                        {/* Section header + search */}
                        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                            <div>
                                <h2 className="text-base font-semibold text-[var(--text)]">Your Projects</h2>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">Click any project to view details and documents</p>
                            </div>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)]" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search projects…"
                                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] transition-shadow"
                                />
                            </div>
                        </div>

                        {/* Grid */}
                        {filtered.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filtered.map(project => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        onClick={() => onSelectProject(project.id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg)] text-center">
                                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mb-3">
                                    <Search className="w-5 h-5 text-[var(--text-faint)]" />
                                </div>
                                <p className="text-sm font-semibold text-[var(--text)]">No results for "{search}"</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Try a different name, location, or project number.</p>
                            </div>
                        )}
                    </>
                )}

                {/* Empty state — no projects assigned at all */}
                {projects.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg)] text-center">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mb-4">
                            <FolderOpen className="w-7 h-7 text-[var(--text-faint)]" />
                        </div>
                        <h3 className="text-base font-semibold text-[var(--text)]">No projects yet</h3>
                        <p className="text-sm text-[var(--text-muted)] mt-1 max-w-xs">
                            Your project manager will share projects with you here once they're ready.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
