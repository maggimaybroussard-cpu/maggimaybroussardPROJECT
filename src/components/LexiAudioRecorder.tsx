'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audioStore, AudioRecording } from '@/lib/localPersistence';
import { saveAudioBlob, getAudioBlob, deleteAudioBlob } from '@/lib/audioDB';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateId(): string {
  return `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LexiAudioRecorder() {
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [form, setForm] = useState({ name: '', clientName: '', caseRef: '' });
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'record' | 'library'>('record');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setRecordings(audioStore.getMeta());
  }, []);

  const startTimer = () => {
    intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleStartRecording = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error('Please enter a recording name');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const id = generateId();
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const rec: AudioRecording = {
            id,
            name: form.name || `Recording ${new Date().toLocaleTimeString()}`,
            duration: elapsed,
            createdAt: new Date().toISOString(),
            clientName: form.clientName || undefined,
            caseRef: form.caseRef || undefined,
            size: blob.size,
          };
          audioStore.addMeta(rec);
          await saveAudioBlob(id, base64);
          setRecordings(audioStore.getMeta());
          toast.success(`Saved: ${rec.name}`);
          setForm({ name: '', clientName: '', caseRef: '' });
          setElapsed(0);
        };
        reader.readAsDataURL(blob);
        // Stop all tracks
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      mr.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      startTimer();
    } catch {
      toast.error('Microphone access denied. Please allow microphone access.');
    }
  }, [form, elapsed]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();
    }
  }, [isRecording]);

  const handlePauseResume = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer();
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopTimer();
    }
  }, [isPaused]);

  const handlePlay = useCallback(async (rec: AudioRecording) => {
    if (playingId === rec.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    const base64 = await getAudioBlob(rec.id);
    if (!base64) {
      toast.error('Audio data not found');
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(base64);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => toast.error('Playback failed'));
    setPlayingId(rec.id);
  }, [playingId]);

  const handleDelete = (id: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    audioStore.removeMeta(id);
    void deleteAudioBlob(id);
    setRecordings(audioStore.getMeta());
    toast.success('Recording deleted');
  };

  const handleDownload = async (rec: AudioRecording) => {
    const base64 = await getAudioBlob(rec.id);
    if (!base64) { toast.error('Audio data not found'); return; }
    const a = document.createElement('a');
    a.href = base64;
    a.download = `${rec.name.replace(/[^a-z0-9]/gi, '_')}.webm`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🎙️</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Audio Recorder</p>
              <p className="text-[10px] text-muted-foreground">Record notes, dictations & client calls</p>
            </div>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['record', 'library'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors ${activeView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {v === 'library' ? `Library (${recordings.length})` : v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeView === 'record' && (
          <div className="p-4 flex flex-col gap-4">
            {/* Recording display */}
            <div className={`rounded-2xl p-5 text-center border-2 transition-all ${isRecording && !isPaused ? 'border-red-400 bg-red-50' : isPaused ? 'border-amber-400 bg-amber-50' : 'border-border bg-secondary/30'}`}>
              {/* Waveform visualization */}
              <div className="flex items-center justify-center gap-0.5 h-8 mb-3">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all ${isRecording && !isPaused ? 'bg-red-500' : isPaused ? 'bg-amber-500' : 'bg-border'}`}
                    style={{
                      height: isRecording && !isPaused
                        ? `${Math.random() * 24 + 8}px`
                        : '8px',
                      animation: isRecording && !isPaused ? `pulse ${0.3 + Math.random() * 0.5}s ease-in-out infinite alternate` : 'none',
                    }}
                  />
                ))}
              </div>

              <div className={`text-3xl font-mono font-bold tracking-wider mb-1 ${isRecording && !isPaused ? 'text-red-700' : isPaused ? 'text-amber-700' : 'text-foreground'}`}>
                {formatDuration(elapsed)}
              </div>

              {isRecording && (
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} />
                  <p className={`text-xs font-semibold ${isPaused ? 'text-amber-700' : 'text-red-700'}`}>
                    {isPaused ? 'Paused' : 'Recording…'}
                  </p>
                </div>
              )}
            </div>

            {/* Form — only show when not recording */}
            {!isRecording && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Recording Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Client call notes, Deposition summary"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Client</label>
                    <input
                      type="text"
                      value={form.clientName}
                      onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                      placeholder="Client name"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Matter</label>
                    <input
                      type="text"
                      value={form.caseRef}
                      onChange={e => setForm(p => ({ ...p, caseRef: e.target.value }))}
                      placeholder="Case ref"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  <div className="w-3 h-3 rounded-full bg-white" />
                  Start Recording
                </button>
              ) : (
                <>
                  <button
                    onClick={handlePauseResume}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {isPaused ? (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>Resume</>
                    ) : (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
                    )}
                  </button>
                  <button
                    onClick={handleStopRecording}
                    className="flex-1 py-3 bg-foreground text-background rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 hover:opacity-80"
                  >
                    <div className="w-3 h-3 bg-background rounded-sm" />
                    Stop & Save
                  </button>
                </>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Recordings are saved locally in your browser. Download to keep permanently.
            </p>
          </div>
        )}

        {activeView === 'library' && (
          <div className="p-4 flex flex-col gap-2">
            {recordings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <p className="text-2xl mb-2">🎙️</p>
                <p>No recordings yet.</p>
                <p className="mt-1">Switch to Record tab to start.</p>
              </div>
            ) : (
              recordings.map(rec => (
                <AudioRecordingCard
                  key={rec.id}
                  rec={rec}
                  isPlaying={playingId === rec.id}
                  onPlay={() => handlePlay(rec)}
                  onDelete={() => handleDelete(rec.id)}
                  onDownload={() => handleDownload(rec)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AudioRecordingCard({
  rec,
  isPlaying,
  onPlay,
  onDelete,
  onDownload,
}: {
  rec: AudioRecording;
  isPlaying: boolean;
  onPlay: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  return (
    <div className={`p-3 rounded-xl border transition-all ${isPlaying ? 'border-primary/50 bg-primary/5' : 'border-border bg-background hover:border-primary/30'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onPlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${isPlaying ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-primary/10 text-foreground'}`}
        >
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{rec.name}</p>
          {(rec.clientName || rec.caseRef) && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {rec.clientName}{rec.caseRef ? ` · ${rec.caseRef}` : ''}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-mono text-foreground">{formatDuration(rec.duration)}</span>
            <span className="text-[10px] text-muted-foreground">{formatFileSize(rec.size)}</span>
            <span className="text-[10px] text-muted-foreground">{new Date(rec.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onDownload} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Download">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
