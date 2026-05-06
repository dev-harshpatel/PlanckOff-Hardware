'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { X, Bold, Italic, List, ListOrdered, Heading2, Undo, Redo, Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { NoteTab, ProjectNotes } from '@/types';
import { generateAIContent } from '@/services/aiProviderService';

interface ProjectNotesPanelProps {
  projectId: string;
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
      editor.commands.setContent(plainTextToEditorHtml(improved), false);
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

export function ProjectNotesPanel({ projectId, isOpen, onClose }: ProjectNotesPanelProps) {
  const [savedNotes, setSavedNotes] = useState<DraftState>(EMPTY_DRAFT);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<NoteTab>('hardware');
  const [editorKey, setEditorKey] = useState(0);
  const didFetch = useRef<string | null>(null);

  useEffect(() => {
    if (didFetch.current === projectId) return;
    didFetch.current = projectId;
    setLoading(true);
    fetch(`/api/projects/${projectId}/notes`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json: { data: ProjectNotes }) => {
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
          <button
            onClick={handleCancel}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
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
