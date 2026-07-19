// ── Local Persistence Utility ─────────────────────────────────────────────────
// Prevents data loss by persisting key app state to localStorage

const PREFIX = 'bls_lexi_';

export function lsSet<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota exceeded or private mode — silently fail
  }
}

export function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function lsRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // silently fail
  }
}

export function lsClear(prefix?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const fullPrefix = PREFIX + (prefix ?? '');
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => window.localStorage.removeItem(k));
  } catch {
    // silently fail
  }
}

// ── Typed helpers for specific features ──────────────────────────────────────

export interface PinnedFile {
  id: string;
  name: string;
  type: string;
  pinnedAt: string;
  caseRef?: string;
  clientName?: string;
}

export interface CaseFolder {
  id: string;
  name: string;
  clientName: string;
  caseRef: string;
  color: string;
  createdAt: string;
  fileCount: number;
  isPinned: boolean;
}

export interface BillingEntry {
  id: string;
  startTime: string;
  endTime?: string;
  duration: number; // seconds
  description: string;
  clientName: string;
  caseRef: string;
  rate: number; // $/hr
  isRunning: boolean;
}

export interface AudioRecording {
  id: string;
  name: string;
  blob?: string; // base64
  duration: number; // seconds
  createdAt: string;
  clientName?: string;
  caseRef?: string;
  size: number; // bytes
}

// Pinned files
export const pinnedFilesStore = {
  get: (): PinnedFile[] => lsGet<PinnedFile[]>('pinned_files', []),
  set: (files: PinnedFile[]) => lsSet('pinned_files', files),
  add: (file: PinnedFile) => {
    const current = pinnedFilesStore.get();
    if (!current.find(f => f.id === file.id)) {
      pinnedFilesStore.set([file, ...current]);
    }
  },
  remove: (id: string) => {
    pinnedFilesStore.set(pinnedFilesStore.get().filter(f => f.id !== id));
  },
  isPinned: (id: string): boolean => pinnedFilesStore.get().some(f => f.id === id),
};

// Case folders
export const caseFoldersStore = {
  get: (): CaseFolder[] => lsGet<CaseFolder[]>('case_folders', []),
  set: (folders: CaseFolder[]) => lsSet('case_folders', folders),
  add: (folder: CaseFolder) => {
    const current = caseFoldersStore.get();
    caseFoldersStore.set([folder, ...current]);
  },
  update: (id: string, updates: Partial<CaseFolder>) => {
    caseFoldersStore.set(caseFoldersStore.get().map(f => f.id === id ? { ...f, ...updates } : f));
  },
  remove: (id: string) => {
    caseFoldersStore.set(caseFoldersStore.get().filter(f => f.id !== id));
  },
};

// Billing clock entries
export const billingStore = {
  get: (): BillingEntry[] => lsGet<BillingEntry[]>('billing_entries', []),
  set: (entries: BillingEntry[]) => lsSet('billing_entries', entries),
  add: (entry: BillingEntry) => {
    billingStore.set([entry, ...billingStore.get()]);
  },
  update: (id: string, updates: Partial<BillingEntry>) => {
    billingStore.set(billingStore.get().map(e => e.id === id ? { ...e, ...updates } : e));
  },
  remove: (id: string) => {
    billingStore.set(billingStore.get().filter(e => e.id !== id));
  },
  getRunning: (): BillingEntry | undefined => billingStore.get().find(e => e.isRunning),
};

// Audio recordings metadata (blobs stored separately due to size)
export const audioStore = {
  getMeta: (): AudioRecording[] => lsGet<AudioRecording[]>('audio_recordings', []),
  setMeta: (recs: AudioRecording[]) => lsSet('audio_recordings', recs),
  addMeta: (rec: AudioRecording) => {
    audioStore.setMeta([rec, ...audioStore.getMeta()]);
  },
  updateMeta: (id: string, updates: Partial<AudioRecording>) => {
    audioStore.setMeta(audioStore.getMeta().map(r => r.id === id ? { ...r, ...updates } : r));
  },
  removeMeta: (id: string) => {
    audioStore.setMeta(audioStore.getMeta().filter(r => r.id !== id));
    lsRemove(`audio_blob_${id}`);
  },
  saveBlob: (id: string, base64: string) => lsSet(`audio_blob_${id}`, base64),
  getBlob: (id: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(PREFIX + `audio_blob_${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};

// Search history
export const searchHistoryStore = {
  get: (): string[] => lsGet<string[]>('search_history', []),
  add: (query: string) => {
    const current = searchHistoryStore.get().filter(q => q !== query);
    searchHistoryStore.set([query, ...current].slice(0, 10));
  },
  set: (history: string[]) => lsSet('search_history', history),
  clear: () => lsSet('search_history', []),
};
