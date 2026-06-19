'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { X, Bold, Italic, List, ListOrdered, Heading2, Undo, Redo, Sparkles, FileSpreadsheet, FileDown, Check } from 'lucide-react';
import { buildExportFilename } from '@/utils/exportFilename';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { NoteTab, ProjectNotes } from '@/types';
import { generateAIContent } from '@/services/aiProviderService';

interface ProjectNotesPanelProps {
  projectId: string;
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
}

type DraftState = Record<NoteTab, Record<string, unknown> | null>;

const TAB_LABELS: Record<NoteTab, string> = {
  hardware: 'Hardware',
  door: 'Door',
  frame: 'Frame',
};

const TABS: NoteTab[] = ['hardware', 'door', 'frame'];

const PLACEHOLDER: Record<NoteTab, string> = {
  hardware: 'Add hardware notes — specifications, substitutions, special instructions...',
  door: 'Add door notes — special requirements, site conditions, sequencing...',
  frame: 'Add frame notes — rough opening details, anchor requirements, special conditions...',
};

const EMPTY_DRAFT: DraftState = { hardware: null, door: null, frame: null };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToEditorHtml(text: string): string {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim());

  const parts: string[] = [];
  let currentList: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (currentList) {
      parts.push(`</${currentList}>`);
      currentList = null;
    }
  };

  for (const line of lines) {
    if (!line) {
      closeList();
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);

    if (bulletMatch) {
      if (currentList !== 'ul') {
        closeList();
        currentList = 'ul';
        parts.push('<ul>');
      }
      parts.push(`<li>${escapeHtml(bulletMatch[1])}</li>`);
      continue;
    }

    if (orderedMatch) {
      if (currentList !== 'ol') {
        closeList();
        currentList = 'ol';
        parts.push('<ol>');
      }
      parts.push(`<li>${escapeHtml(orderedMatch[1])}</li>`);
      continue;
    }

    closeList();
    parts.push(`<p>${escapeHtml(line)}</p>`);
  }

  closeList();
  return parts.join('') || '<p></p>';
}

function tiptapToText(node: Record<string, unknown> | null): string {
  if (!node) return '';
  const type = node.type as string;
  const children = (node.content as Record<string, unknown>[] | undefined) ?? [];
  if (type === 'text') return (node.text as string) ?? '';
  if (type === 'hardBreak') return '\n';
  if (type === 'paragraph' || type === 'heading')
    return children.map(c => tiptapToText(c as Record<string, unknown>)).join('') + '\n';
  if (type === 'listItem')
    return '• ' + children.map(c => tiptapToText(c as Record<string, unknown>)).join('').trim() + '\n';
  return children.map(c => tiptapToText(c as Record<string, unknown>)).join('');
}

const IMPROVE_NOTES_MODEL = 'google/gemini-2.0-flash-001';

async function improveNotesText(rawText: string): Promise<string> {
  const prompt = [
    'Rewrite the following project note so it reads professionally and clearly for a construction/reporting context.',
    'Keep every factual detail that is already present.',
    'Fix grammar, punctuation, and phrasing.',
    'Do not add new facts, headings, commentary, or markdown fences.',
    'If the note reads like a list, return short clean bullets.',
    'Return only the improved note text.',
    '',
    rawText.trim(),
  ].join('\n');

  const response = await generateAIContent(prompt, undefined, {
    temperature: 0.15,
    settings: { provider: 'openrouter', model: IMPROVE_NOTES_MODEL },
  });

  return response.text.trim();
}

function EditorToolbar({
  editor,
  onImprove,
  improving,
  canImprove,
}: {
  editor: ReturnType<typeof useEditor>;
  onImprove?: () => void;
  improving?: boolean;
  canImprove?: boolean;
}) {
  if (!editor) return null;

  const btn = (active: boolean) =>
    `p-1.5 rounded transition-colors ${
      active
        ? 'bg-[var(--primary-bg)] text-[var(--primary-text)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)]'
    }`;

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b border-[var(--border)] px-2 py-1.5 flex-shrink-0">
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} className={btn(editor.isActive('bold'))} title="Bold">
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} className={btn(editor.isActive('italic'))} title="Italic">
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }} className={btn(editor.isActive('heading', { level: 2 }))} title="Heading">
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-4 bg-[var(--border)] mx-0.5" />
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }} className={btn(editor.isActive('bulletList'))} title="Bullet list">
        <List className="h-3.5 w-3.5" />
      </button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }} className={btn(editor.isActive('orderedList'))} title="Numbered list">
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-4 bg-[var(--border)] mx-0.5" />
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().undo().run(); }} disabled={!editor.can().undo()} className={`${btn(false)} disabled:opacity-30`} title="Undo">
        <Undo className="h-3.5 w-3.5" />
      </button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().redo().run(); }} disabled={!editor.can().redo()} className={`${btn(false)} disabled:opacity-30`} title="Redo">
        <Redo className="h-3.5 w-3.5" />
      </button>
      <div className="ml-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onImprove}
          disabled={!canImprove || improving}
          loading={improving}
          loadingText="Improving..."
          className="h-8 gap-1.5 px-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Improve with AI
        </Button>
      </div>
    </div>
  );
}

function NotesPanelSkeleton() {
  return (
    <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)]">
        <div className="flex gap-2 border-b border-[var(--border)] px-3 py-2">
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
        </div>
        <div className="flex-1 space-y-3 px-3 py-3">
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
        </div>
      </div>
    </div>
  );
}

interface NoteEditorProps {
  tab: NoteTab;
  initialContent: Record<string, unknown> | null;
  onUpdate: (tab: NoteTab, content: Record<string, unknown>) => void;
}

function NoteEditor({ tab, initialContent, onUpdate }: NoteEditorProps) {
  const mountContent = useRef(initialContent);
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: PLACEHOLDER[tab] }),
    ],
    content: mountContent.current ?? undefined,
    editorProps: {
      attributes: { class: 'notes-editor' },
    },
    onUpdate({ editor: e }) {
      onUpdate(tab, e.getJSON() as Record<string, unknown>);
    },
  });

  const handleImprove = useCallback(async () => {
    if (!editor) return;
    const rawText = editor.getText({ blockSeparator: '\n\n' }).trim();
    if (!rawText) return;

    setImproving(true);
    setImproveError(null);
    try {
      const improved = await improveNotesText(rawText);
      if (!improved) return;
      editor.commands.setContent(plainTextToEditorHtml(improved));
      onUpdate(tab, editor.getJSON() as Record<string, unknown>);
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : 'Failed to improve notes.');
    } finally {
      setImproving(false);
    }
  }, [editor, onUpdate, tab]);

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-[var(--border)] rounded-md overflow-hidden bg-[var(--bg)]">
      <EditorToolbar
        editor={editor}
        onImprove={handleImprove}
        improving={improving}
        canImprove={!!editor?.getText().trim()}
      />
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <EditorContent editor={editor} />
      </div>
      {improveError && (
        <div className="border-t border-[var(--border)] px-3 py-2 text-xs text-red-500">
          {improveError}
        </div>
      )}
    </div>
  );
}

export function ProjectNotesPanel({ projectId, projectName, isOpen, onClose }: ProjectNotesPanelProps) {
  const [savedNotes, setSavedNotes] = useState<DraftState>(EMPTY_DRAFT);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<NoteTab>('hardware');
  const [editorKey, setEditorKey] = useState(0);
  const didFetch = useRef<string | null>(null);

  const [exportDialog, setExportDialog] = useState<null | 'excel' | 'pdf'>(null);
  const [exportSections, setExportSections] = useState({ hardware: true, door: true, frame: true });
  const exportDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (didFetch.current === projectId) return;
    didFetch.current = projectId;
    setLoading(true);
    fetch(`/api/projects/${projectId}/notes`, { credentials: 'include' })
      .then(async (r) => {
        const json = (await r.json()) as { data?: ProjectNotes };
        if (!r.ok || !json.data) return;
        const loaded: DraftState = {
          hardware: json.data.hardware,
          door: json.data.door,
          frame: json.data.frame,
        };
        setSavedNotes(loaded);
        setDraft(loaded);
        setEditorKey((k) => k + 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    didFetch.current = null;
    setSavedNotes(EMPTY_DRAFT);
    setDraft(EMPTY_DRAFT);
    setEditorKey((k) => k + 1);
  }, [projectId]);

  useEffect(() => {
    if (!exportDialog) return;
    const handler = (e: MouseEvent) => {
      if (exportDialogRef.current && !exportDialogRef.current.contains(e.target as Node)) {
        setExportDialog(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportDialog]);

  const handleDownloadExcel = useCallback(async () => {
    try {
      const { utils, writeFile } = await import('xlsx-js-style');
      const wb = utils.book_new();
      const sections = [['hardware', 'Hardware'], ['door', 'Door'], ['frame', 'Frame']] as const;
      for (const [key, label] of sections) {
        if (!exportSections[key]) continue;
        const text = tiptapToText(draft[key]);
        const lines = text.split('\n').filter(l => l.trim() !== '');
        utils.book_append_sheet(wb, utils.aoa_to_sheet(lines.length > 0 ? lines.map(l => [l]) : [['(No notes)']]), label);
      }
      if (wb.SheetNames.length === 0) return;
      writeFile(wb, buildExportFilename(projectName ?? 'project', 'notes', 'xlsx'));
    } catch (err) {
      console.error('[NotesPanel] Excel export failed:', err);
    }
  }, [draft, exportSections, projectName]);

  const handleDownloadPdf = useCallback(async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.width;
      const margin = 14;
      let y = 14;
      const sections = [['hardware', 'Hardware'], ['door', 'Door'], ['frame', 'Frame']] as const;
      let first = true;
      for (const [key, label] of sections) {
        if (!exportSections[key]) continue;
        if (!first) y += 8;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${label} Notes`, margin, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const text = tiptapToText(draft[key]).trim();
        const splitLines = doc.splitTextToSize(text || '(No notes)', pageW - margin * 2) as string[];
        doc.text(splitLines, margin, y);
        y += splitLines.length * 5 + 4;
        first = false;
      }
      if (first) return;
      doc.save(buildExportFilename(projectName ?? 'project', 'notes', 'pdf'));
    } catch (err) {
      console.error('[NotesPanel] PDF export failed:', err);
    }
  }, [draft, exportSections, projectName]);

  const handleExportConfirm = useCallback(() => {
    if (!exportDialog) return;
    if (exportDialog === 'excel') void handleDownloadExcel();
    else void handleDownloadPdf();
    setExportDialog(null);
  }, [exportDialog, handleDownloadExcel, handleDownloadPdf]);

  const handleUpdate = useCallback((tab: NoteTab, content: Record<string, unknown>) => {
    setDraft((prev) => ({ ...prev, [tab]: content }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        TABS.map((tab) =>
          fetch(`/api/projects/${projectId}/notes`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tab, content: draft[tab] }),
          }),
        ),
      );
      setSavedNotes(draft);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(savedNotes);
    setEditorKey((k) => k + 1);
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={handleCancel}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full z-50 w-[460px] max-w-[95vw] bg-[var(--bg)] border-l border-[var(--border)] flex flex-col shadow-xl transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--border)] flex-shrink-0">
          <span className="text-sm font-semibold text-[var(--text)]">Project Notes</span>
          <div className="flex items-center gap-2">
            <div ref={exportDialogRef} className="relative flex items-center gap-1.5">
              <button
                onClick={() => setExportDialog(prev => prev === 'excel' ? null : 'excel')}
                title="Download Notes Excel"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-[var(--primary-action)]/10 hover:bg-[var(--primary-action)]/20 text-[var(--primary-text)] transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={() => setExportDialog(prev => prev === 'pdf' ? null : 'pdf')}
                title="Download Notes PDF"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-[var(--primary-action)]/10 hover:bg-[var(--primary-action)]/20 text-[var(--primary-text)] transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </button>

              {exportDialog && (
                <div className="absolute right-0 top-full mt-2 z-[60] w-52 rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
                    <span className="text-[11px] font-semibold text-[var(--text)]">
                      Include in {exportDialog === 'excel' ? 'Excel' : 'PDF'}
                    </span>
                    <button onClick={() => setExportDialog(null)} className="text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="px-3 py-2 space-y-2">
                    {([['hardware', 'Hardware'], ['door', 'Door'], ['frame', 'Frame']] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                        <span
                          className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                            exportSections[key]
                              ? 'bg-[var(--primary-action)] border-[var(--primary-action)]'
                              : 'border-[var(--border)] bg-[var(--bg)] group-hover:border-[var(--primary-ring)]'
                          }`}
                          onClick={() => setExportSections(prev => ({ ...prev, [key]: !prev[key] }))}
                        >
                          {exportSections[key] && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </span>
                        <span
                          className="text-xs text-[var(--text)] select-none"
                          onClick={() => setExportSections(prev => ({ ...prev, [key]: !prev[key] }))}
                        >
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="px-3 pb-3">
                    <button
                      onClick={handleExportConfirm}
                      disabled={!exportSections.hardware && !exportSections.door && !exportSections.frame}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[var(--primary-action)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {exportDialog === 'excel' ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <FileDown className="w-3.5 h-3.5" />}
                      Download {exportDialog === 'excel' ? 'Excel' : 'PDF'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleCancel}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {loading ? (
            <NotesPanelSkeleton />
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as NoteTab)}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="px-4 pt-3 flex-shrink-0">
                <TabsList className="w-full">
                  {TABS.map((tab) => (
                    <TabsTrigger key={tab} value={tab} className="flex-1 text-xs">
                      {TAB_LABELS[tab]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {TABS.map((tab) => (
                  <TabsContent
                    key={tab}
                    value={tab}
                    className="h-full m-0 data-[state=active]:flex flex-col px-4 pt-2 pb-0"
                  >
                    <NoteEditor
                      key={`${tab}-${editorKey}`}
                      tab={tab}
                      initialContent={draft[tab]}
                      onUpdate={handleUpdate}
                    />
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-3 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={saving}
            className="text-[var(--text-muted)]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            loading={saving}
            loadingText="Saving..."
            className="gap-1.5"
          >
            Save Notes
          </Button>
        </div>
      </div>
    </>
  );
}
