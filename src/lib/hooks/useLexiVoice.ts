'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ElevenLabs voices suitable for a professional legal secretary
export const LEXI_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm, professional female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong, confident female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Soft, pleasant female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Well-rounded male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Crisp, authoritative male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, professional male' },
];

export interface UseLexiVoiceReturn {
  isSpeaking: boolean;
  isLoadingTTS: boolean;
  ttError: string | null;
  selectedVoiceId: string;
  setSelectedVoiceId: (id: string) => void;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  // Voice dictation
  isRecording: boolean;
  isTranscribing: boolean;
  sttError: string | null;
  startDictation: () => Promise<void>;
  stopDictation: () => Promise<string | null>;
}

export function useLexiVoice(): UseLexiVoiceReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingTTS, setIsLoadingTTS] = useState(false);
  const [ttError, setTtError] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState(LEXI_VOICES[0].id);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount: stop audio, revoke blob URL, stop media stream
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current) {
        try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
        mediaRecorderRef.current = null;
      }
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;
    stopSpeaking();
    setIsLoadingTTS(true);
    setTtError(null);

    try {
      const response = await fetch('/api/lexi/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_id: selectedVoiceId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'TTS request failed' }));
        throw new Error(err.error || 'TTS request failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioUrlRef.current = null;
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setTtError('Audio playback failed');
      };

      setIsLoadingTTS(false);
      setIsSpeaking(true);
      await audio.play();
    } catch (err) {
      setIsLoadingTTS(false);
      setIsSpeaking(false);
      setTtError(err instanceof Error ? err.message : 'TTS failed');
    }
  }, [selectedVoiceId, stopSpeaking]);

  const startDictation = useCallback(async () => {
    if (isRecording) return;
    setSttError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.start(100);
      setIsRecording(true);
    } catch {
      setSttError('Microphone access denied. Please allow microphone access.');
    }
  }, [isRecording]);

  const stopDictation = useCallback(async (): Promise<string | null> => {
    if (!mediaRecorderRef.current || !isRecording) return null;

    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current!;

      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];

        if (blob.size < 1000) {
          setSttError('Recording too short. Please speak for at least 1 second.');
          setIsTranscribing(false);
          resolve(null);
          return;
        }

        setIsTranscribing(true);
        setSttError(null);

        try {
          const file = new File([blob], 'dictation.webm', { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('provider', 'OPEN_AI');
          formData.append('model', 'gpt-4o-transcribe');
          formData.append('file', file);
          formData.append('parameters', JSON.stringify({ language: 'en' }));

          const response = await fetch('/api/ai/speech-to-text', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Transcription failed');
          }

          const data = await response.json();
          const transcribedText = data?.text ?? null;
          setIsTranscribing(false);
          resolve(transcribedText);
        } catch (err) {
          setSttError(err instanceof Error ? err.message : 'Transcription failed');
          setIsTranscribing(false);
          resolve(null);
        }
      };

      mr.stop();
      setIsRecording(false);
    });
  }, [isRecording]);

  return {
    isSpeaking,
    isLoadingTTS,
    ttError,
    selectedVoiceId,
    setSelectedVoiceId,
    speak,
    stopSpeaking,
    isRecording,
    isTranscribing,
    sttError,
    startDictation,
    stopDictation,
  };
}
