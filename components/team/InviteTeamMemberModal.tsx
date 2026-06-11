"use client";

import { useState, useEffect, useMemo } from "react";
import { useRBAC } from "@/hooks/useRBAC";
import { getInvitableRoles } from "@/constants/roles";
import type { RoleName } from "@/types/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ERRORS } from "@/constants/errors";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { Search, Send } from "lucide-react";

interface ProjectOption {
  id: string;
  name: string;
  location?: string;
}

interface InviteTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: RoleName;
  onSuccess: () => void;
}

export function InviteTeamMemberModal({
  isOpen,
  onClose,
  defaultRole,
  onSuccess,
}: InviteTeamMemberModalProps) {
  const { userRole } = useRBAC();

  const invitableRoles: RoleName[] = userRole
    ? getInvitableRoles(userRole)
    : [];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleName>(
    defaultRole ?? invitableRoles[0] ?? "Estimator",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Project picker state (Client and Estimator roles)
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectSearch, setProjectSearch] = useState("");

  // Reset all fields when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setEmail("");
      setRole(defaultRole ?? invitableRoles[0] ?? "Estimator");
      setError(null);
      setSuccessMsg(null);
      setSelectedProjectIds([]);
      setProjectSearch("");
    }
  }, [isOpen, defaultRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear project selections when role changes away from Client or Estimator
  useEffect(() => {
    if (role !== "Client" && role !== "Estimator") {
      setSelectedProjectIds([]);
      setProjectSearch("");
      setProjects([]);
    }
  }, [role]);

  // Fetch available projects when Client or Estimator role is selected
  useEffect(() => {
    if ((role !== "Client" && role !== "Estimator") || !isOpen) return;

    setIsLoadingProjects(true);
    fetch("/api/projects", { credentials: "include" })
      .then((r) => r.json())
      .then(
        (json: {
          data?: { id: string; name: string; location?: string }[];
        }) => {
          setProjects(
            (json.data ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              location: p.location,
            })),
          );
        },
      )
      .catch(() => setProjects([]))
      .finally(() => setIsLoadingProjects(false));
  }, [role, isOpen]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.location && p.location.toLowerCase().includes(q)),
    );
  }, [projects, projectSearch]);

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if ((role === "Client" || role === "Estimator") && selectedProjectIds.length === 0) {
      setError(`Please assign at least one project to this ${role}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
      };
      if (role === "Client" || role === "Estimator") {
        body.projectIds = selectedProjectIds;
      }

      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        emailSent?: boolean;
        inviteLink?: string;
      };

      if (!res.ok) {
        setError(json.error ?? ERRORS.GENERAL.UNEXPECTED.message);
        return;
      }

      if (json.emailSent === false && json.inviteLink) {
        setSuccessMsg(
          `Email service not configured. Share this invite link:\n${json.inviteLink}`,
        );
      } else {
        setSuccessMsg(`Invitation sent to ${email}.`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch {
      setError(ERRORS.AUTH.NETWORK_ERROR.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b border-[var(--border-subtle)] px-6 py-5">
            <DialogTitle className="text-xl">Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation email with a link to set their password.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Full Name */}
            <div>
              <Label
                htmlFor="invite-name"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]"
              >
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                id="invite-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. James Walker"
                className="h-11 rounded-lg"
                disabled={isSubmitting}
              />
            </div>

            {/* Email */}
            <div>
              <Label
                htmlFor="invite-email"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]"
              >
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                id="invite-email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="james.walker@company.com"
                className="h-11 rounded-lg"
                disabled={isSubmitting}
              />
            </div>

            {/* Role */}
            <div>
              <Label
                htmlFor="invite-role"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]"
              >
                Role
              </Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as RoleName)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="invite-role" className="h-11 w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {invitableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project assignment — shown for Client and Estimator roles */}
            {(role === "Client" || role === "Estimator") && (
              <div>
                <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Assign Projects <span className="text-red-500">*</span>
                </Label>

                {/* Search */}
                <div className="relative mb-2">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-4 w-4 text-[var(--text-faint)]" />
                  </div>
                  <Input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search projects…"
                    className="rounded-lg pl-9"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Project list */}
                <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                  {isLoadingProjects ? (
                    <div className="px-4 py-6 text-center text-sm text-[var(--text-faint)]">
                      Loading projects…
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-[var(--text-faint)]">
                      {projects.length === 0
                        ? "No projects found."
                        : "No matches for your search."}
                    </div>
                  ) : (
                    <ul className="max-h-48 divide-y divide-[var(--border-subtle)] overflow-y-auto">
                      {filteredProjects.map((project) => {
                        const checked = selectedProjectIds.includes(project.id);
                        return (
                          <li key={project.id}>
                            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-subtle)]">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProject(project.id)}
                                className="h-4 w-4 flex-shrink-0 cursor-pointer rounded border-[var(--border-strong)] accent-[var(--primary-action)] focus:ring-[var(--primary-ring)] focus:ring-offset-0"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-[var(--text)]">
                                  {project.name}
                                </span>
                                {project.location && (
                                  <span className="block truncate text-xs text-[var(--text-faint)]">
                                    {project.location}
                                  </span>
                                )}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Selection count */}
                {selectedProjectIds.length > 0 && (
                  <p className="mt-1.5 text-xs font-medium text-[var(--primary-text)]">
                    {selectedProjectIds.length} project
                    {selectedProjectIds.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            )}

            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              If this email already has a pending invitation, sending again
              will resend it and refresh the expiry.
            </p>

            {error && <ErrorDisplay error={error} />}

            {successMsg && (
              <div className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3">
                <p className="whitespace-pre-line text-sm text-[var(--success-text)]">
                  {successMsg}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-6 py-4 sm:justify-between">
            <Button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              variant="outline"
              className="min-w-[112px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              loading={isSubmitting}
              loadingText="Sending Invitation..."
              className="min-w-[160px]"
            >
              <Send className="h-4 w-4" />
              Send / Resend Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
