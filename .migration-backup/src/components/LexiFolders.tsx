'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { caseFoldersStore, pinnedFilesStore, CaseFolder, PinnedFile } from '@/lib/localPersistence';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LexiFoldersProps {
  prefillClientName?: string;
  prefillCaseRef?: string;
}

const FOLDER_COLORS = [
  { id: 'green', label: 'Green', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-500' },
  { id: 'blue', label: 'Blue', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' },
  { id: 'red', label: 'Red', bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500' },
  { id: 'purple', label: 'Purple', bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700', dot: 'bg-purple-500' },
  { id: 'slate', label: 'Slate', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700', dot: 'bg-slate-500' },
];

function getColorConfig(colorId: string) {
  return FOLDER_COLORS.find(c => c.id === colorId) ?? FOLDER_COLORS[0];
}

function generateId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LexiFolders({ prefillClientName, prefillCaseRef }: LexiFoldersProps) {
  const [folders, setFolders] = useState<CaseFolder[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<PinnedFile[]>([]);
  const [activeView, setActiveView] = useState<'folders' | 'pinned'>('folders');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<CaseFolder | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<CaseFolder | null>(null);
  const [form, setForm] = useState({
    name: '',
    clientName: prefillClientName ?? '',
    caseRef: prefillCaseRef ?? '',
    color: 'green',
  });

  useEffect(() => {
    setFolders(caseFoldersStore.get());
    setPinnedFiles(pinnedFilesStore.get());
  }, []);

  const handleCreateFolder = useCallback(() => {
    if (!form.name.trim()) { toast.error('Folder name required'); return; }
    if (!form.clientName.trim()) { toast.error('Client name required'); return; }
    const folder: CaseFolder = {
      id: generateId(),
      name: form.name,
      clientName: form.clientName,
      caseRef: form.caseRef,
      color: form.color,
      createdAt: new Date().toISOString(),
      fileCount: 0,
      isPinned: false,
    };
    caseFoldersStore.add(folder);
    setFolders(caseFoldersStore.get());
    setForm({ name: '', clientName: prefillClientName ?? '', caseRef: prefillCaseRef ?? '', color: 'green' });
    setShowNewFolder(false);
    toast.success(`Folder "${folder.name}" created`);
  }, [form, prefillClientName, prefillCaseRef]);

  const handleRenameFolder = useCallback((folder: CaseFolder, newName: string) => {
    if (!newName.trim()) return;
    caseFoldersStore.update(folder.id, { name: newName });
    setFolders(caseFoldersStore.get());
    setEditingFolder(null);
    toast.success('Folder renamed');
  }, []);

  const handlePinFolder = useCallback((folder: CaseFolder) => {
    caseFoldersStore.update(folder.id, { isPinned: !folder.isPinned });
    setFolders(caseFoldersStore.get());
    toast.success(folder.isPinned ? 'Unpinned' : 'Pinned to top');
  }, []);

  const handleDeleteFolder = useCallback((id: string) => {
    caseFoldersStore.remove(id);
    setFolders(caseFoldersStore.get());
    if (selectedFolder?.id === id) setSelectedFolder(null);
    toast.success('Folder deleted');
  }, [selectedFolder]);

  const handleUnpinFile = useCallback((id: string) => {
    pinnedFilesStore.remove(id);
    setPinnedFiles(pinnedFilesStore.get());
    toast.success('File unpinned');
  }, []);

  const sortedFolders = [...folders].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📁</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Client & Case Folders</p>
              <p className="text-[10px] text-muted-foreground">Organize files by client and matter</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['folders', 'pinned'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setActiveView(v)}
                  className={`px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors ${activeView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {v === 'pinned' ? `📌 Pinned (${pinnedFiles.length})` : `Folders (${folders.length})`}
                </button>
              ))}
            </div>
            {activeView === 'folders' && (
              <button
                onClick={() => setShowNewFolder(true)}
                className="px-2.5 py-1 bg-primary text-primary-foreground rounded-lg text-[10px] font-semibold hover:opacity-90 transition-all"
              >
                + New
              </button>
            )}
          </div>
        </div>
      </div>

      {/* New folder form */}
      {showNewFolder && (
        <div className="px-4 py-3 border-b border-border bg-primary/5 shrink-0">
          <p className="text-xs font-semibold text-foreground mb-3">New Folder</p>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Folder name (e.g. Smith Employment Matter)"
              autoFocus
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={form.clientName}
                onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                placeholder="Client name *"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="text"
                value={form.caseRef}
                onChange={e => setForm(p => ({ ...p, caseRef: e.target.value }))}
                placeholder="Case ref (optional)"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {/* Color picker */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Color:</span>
              {FOLDER_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setForm(p => ({ ...p, color: c.id }))}
                  className={`w-5 h-5 rounded-full ${c.dot} transition-all ${form.color === c.id ? 'ring-2 ring-offset-1 ring-foreground scale-110' : 'opacity-60 hover:opacity-100'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewFolder(false)} className="flex-1 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={handleCreateFolder} className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all">Create Folder</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {activeView === 'folders' && (
          <>
            {sortedFolders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <p className="text-2xl mb-2">📁</p>
                <p>No folders yet.</p>
                <p className="mt-1">Create a folder to organize your client files.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedFolders.map(folder => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    isEditing={editingFolder?.id === folder.id}
                    isSelected={selectedFolder?.id === folder.id}
                    onSelect={() => setSelectedFolder(selectedFolder?.id === folder.id ? null : folder)}
                    onRename={(name) => handleRenameFolder(folder, name)}
                    onStartEdit={() => setEditingFolder(folder)}
                    onCancelEdit={() => setEditingFolder(null)}
                    onPin={() => handlePinFolder(folder)}
                    onDelete={() => handleDeleteFolder(folder.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeView === 'pinned' && (
          <>
            {pinnedFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <p className="text-2xl mb-2">📌</p>
                <p>No pinned files yet.</p>
                <p className="mt-1">Pin important files from the document manager for quick access.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pinnedFiles.map(file => (
                  <PinnedFileCard key={file.id} file={file} onUnpin={() => handleUnpinFile(file.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FolderCard({
  folder,
  isEditing,
  isSelected,
  onSelect,
  onRename,
  onStartEdit,
  onCancelEdit,
  onPin,
  onDelete,
}: {
  folder: CaseFolder;
  isEditing: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const [editName, setEditName] = useState(folder.name);
  const color = getColorConfig(folder.color);

  return (
    <div className={`rounded-xl border transition-all ${isSelected ? `${color.border} ${color.bg}` : 'border-border bg-background hover:border-primary/30'}`}>
      <div className="p-3 flex items-start gap-3">
        <button onClick={onSelect} className="shrink-0 mt-0.5">
          <div className={`w-8 h-8 rounded-lg ${color.bg} ${color.border} border flex items-center justify-center`}>
            <span className="text-sm">📁</span>
          </div>
        </button>
        <div className="flex-1 min-w-0" onClick={onSelect}>
          {isEditing ? (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onRename(editName); if (e.key === 'Escape') onCancelEdit(); }}
                autoFocus
                className="flex-1 px-2 py-1 bg-background border border-primary/50 rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button onClick={() => onRename(editName)} className="px-2 py-1 bg-primary text-primary-foreground rounded-lg text-[10px] font-semibold">Save</button>
              <button onClick={onCancelEdit} className="px-2 py-1 border border-border rounded-lg text-[10px] text-muted-foreground">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-foreground truncate">{folder.name}</p>
              {folder.isPinned && <span className="text-[10px]">📌</span>}
            </div>
          )}
          {!isEditing && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {folder.clientName}{folder.caseRef ? ` · ${folder.caseRef}` : ''}
            </p>
          )}
          {!isEditing && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Created {new Date(folder.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onPin} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title={folder.isPinned ? 'Unpin' : 'Pin'}>
              <span className="text-[10px]">{folder.isPinned ? '📌' : '📍'}</span>
            </button>
            <button onClick={onStartEdit} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Rename">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600" title="Delete">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PinnedFileCard({ file, onUnpin }: { file: PinnedFile; onUnpin: () => void }) {
  return (
    <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 hover:border-amber-300 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
          <span className="text-sm">📌</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{file.name}</p>
          {(file.clientName || file.caseRef) && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {file.clientName}{file.caseRef ? ` · ${file.caseRef}` : ''}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Pinned {new Date(file.pinnedAt).toLocaleDateString()} · {file.type}
          </p>
        </div>
        <button
          onClick={onUnpin}
          className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors text-amber-600 hover:text-amber-800 shrink-0"
          title="Unpin"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>
  );
}
