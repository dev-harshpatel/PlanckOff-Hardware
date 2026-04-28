'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { X, Bold, Italic, List, ListOrdered, Heading2, Undo, Redo, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import type { NoteTab, ProjectNotes } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectNotesPanelProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

type DraftState = Record<NoteTab, Record<string, unknown> | null>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAB_LABELS: Record<NoteTab, string> = {
  hardware: 'Hardware',
  door: 'Door',
  frame: 'Frame',
};

const TABS: NoteTab[] = ['hardware', 'door', 'frame'];

const PLACEHOLDER: Record<NoteTab, string> = {
  hardware: 'Add hardware notes — specifications, substitutions, special instructions…',
  door: 'Add door notes — special requirements, site conditions, sequencing…',
  frame: 'Add frame notes — rough opening details, anchor requirements, special conditions…',
};

const EMPTY_DRAFT: DraftState = { hardware: null, door: null, frame: null };

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-tab editor
// NoteEditor captures initialContent at mount time only.
// This breaks the parent↔editor feedback loop: parent passes draft content
// when the editor (re)mounts (e.g. after tab switch), and the editor then
// manages its own state independently, reporting changes via onUpdate.
// ---------------------------------------------------------------------------

interface NoteEditorProps {
  tab: NoteTab;
  initialContent: Record<string, unknown> | null;
  onUpdate: (tab: NoteTab, content: Record<string, unknown>) => void;
}

function NoteEditor({ tab, initialContent, onUpdate }: NoteEditorProps) {
  // Snapshot content at mount time — prevents the editor from resetting on
  // every parent re-render while the user is typing.
  const mountContent = useRef(initialContent);

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

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-[var(--border)] rounded-md overflow-hidden bg-[var(--bg)]">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function ProjectNotesPanel({ projectId, isOpen, onClose }: ProjectNotesPanelProps) {
  const [savedNotes, setSavedNotes] = useState<DraftState>(EMPTY_DRAFT);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<NoteTab>('hardware');
  // editorKey increments to force NoteEditor re-mount when notes load or on cancel,
  // ensuring each editor picks up the correct initialContent at mount time.
  const [editorKey, setEditorKey] = useState(0);
  const didFetch = useRef<string | null>(null);

  // Prefetch notes as soon as the panel component mounts for this project —
  // not on panel open, so data is ready before the user ever clicks Notes.
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

  // Reset everything when projectId changes
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
    // Reset draft to last saved state and remount editors
    setDraft(savedNotes);
    setEditorKey((k) => k + 1);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={handleCancel}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-[460px] max-w-[95vw] bg-[var(--bg)] border-l border-[var(--border)] flex flex-col shadow-xl transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--border)] flex-shrink-0">
          <span className="text-sm font-semibold text-[var(--text)]">Project Notes</span>
          <button
            onClick={handleCancel}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--text-faint)]" />
            </div>
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

        {/* Footer — Save / Cancel */}
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
          <Button size="sm" onClick={handleSave} disabled={saving || loading} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save Notes'}
          </Button>
        </div>
      </div>
    </>
  );
}
