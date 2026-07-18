'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntakeRecord {
  clientName: string;
  contactInfo: string;
  caseType: string;
  incidentDate: string;
  location: string;
  parties: string;
  summary: string;
  keyFacts: string[];
  urgencyLevel: string;
  nextSteps: string[];
  rawTranscript: string;
  createdAt: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LexiVoiceIntake() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [intakeRecord, setIntakeRecord] = useState<IntakeRecord | null>(null);
  const [step, setStep] = useState<'idle' | 'recording' | 'recorded' | 'transcribing' | 'summarizing' | 'done'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { response, isLoading: summarizing, error: summaryError, sendMessage } = useChat(
    'ANTHROPIC',
    'claude-sonnet-4-6',
    false
  );

  useEffect(() => {
    if (summaryError) toast.error('Summary failed: ' + summaryError.message);
  }, [summaryError]);

  // Parse Claude's structured response into IntakeRecord
  useEffect(() => {
    if (response && !summarizing && transcript) {
      try {
        // Try to parse JSON from response
        const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          setIntakeRecord({ ...parsed, rawTranscript: transcript, createdAt: new Date().toISOString() });
        } else {
          // Fallback: create basic record from response
          setIntakeRecord({
            clientName: extractField(response, 'Client Name', 'Unknown'),
            contactInfo: extractField(response, 'Contact', ''),
            caseType: extractField(response, 'Case Type', 'General Inquiry'),
            incidentDate: extractField(response, 'Incident Date', ''),
            location: extractField(response, 'Location', ''),
            parties: extractField(response, 'Parties', ''),
            summary: response.substring(0, 500),
            keyFacts: [],
            urgencyLevel: extractField(response, 'Urgency', 'Medium'),
            nextSteps: [],
            rawTranscript: transcript,
            createdAt: new Date().toISOString(),
          });
        }
        setStep('done');
      } catch {
        setIntakeRecord({
          clientName: 'Unknown',
          contactInfo: '',
          caseType: 'General Inquiry',
          incidentDate: '',
          location: '',
          parties: '',
          summary: response,
          keyFacts: [],
          urgencyLevel: 'Medium',
          nextSteps: ['Review transcript', 'Follow up with client'],
          rawTranscript: transcript,
          createdAt: new Date().toISOString(),
        });
        setStep('done');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, summarizing]);

  function extractField(text: string, field: string, fallback: string): string {
    const regex = new RegExp(`${field}[:\\s]+([^\\n]+)`, 'i');
    const match = text.match(regex);
    return match?.[1]?.trim() ?? fallback;
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setStep('recorded');
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setStep('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      toast.error('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    setTranscribing(true);
    setStep('transcribing');

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'intake.webm');
      formData.append('model', 'whisper-1');

      const res = await fetch('/api/ai/speech-to-text', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Transcription failed');
      }

      const data = await res.json();
      const text = data.text ?? data.transcript ?? '';
      setTranscript(text);
      setStep('summarizing');
      summarizeTranscript(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transcription failed');
      setStep('recorded');
    } finally {
      setTranscribing(false);
    }
  };

  const summarizeTranscript = (text: string) => {
    sendMessage([
      {
        role: 'system',
        content: `You are Lexi, an AI legal intake assistant at Broussard Legal Services. 
Extract structured intake information from the client's spoken case description.
Return a JSON object wrapped in \`\`\`json\`\`\` code blocks with this exact structure:
{
  "clientName": "string",
  "contactInfo": "string (phone/email if mentioned)",
  "caseType": "string (e.g. Personal Injury, Contract Dispute, Employment)",
  "incidentDate": "string",
  "location": "string",
  "parties": "string (other parties involved)",
  "summary": "string (2-3 sentence case summary)",
  "keyFacts": ["array", "of", "key", "facts"],
  "urgencyLevel": "Low | Medium | High | Urgent",
  "nextSteps": ["array", "of", "recommended", "next steps"]
}`,
      },
      {
        role: 'user',
        content: `Please extract structured intake information from this client voice recording transcript:\n\n${text}`,
      },
    ], { max_tokens: 1500 });
  };

  const resetIntake = () => {
    setStep('idle');
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscript('');
    setIntakeRecord(null);
    setRecordingTime(0);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const copyIntake = () => {
    if (!intakeRecord) return;
    const text = `INTAKE RECORD — ${new Date(intakeRecord.createdAt).toLocaleString()}

CLIENT: ${intakeRecord.clientName}
CONTACT: ${intakeRecord.contactInfo}
CASE TYPE: ${intakeRecord.caseType}
INCIDENT DATE: ${intakeRecord.incidentDate}
LOCATION: ${intakeRecord.location}
PARTIES: ${intakeRecord.parties}
URGENCY: ${intakeRecord.urgencyLevel}

SUMMARY:
${intakeRecord.summary}

KEY FACTS:
${intakeRecord.keyFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}

NEXT STEPS:
${intakeRecord.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

RAW TRANSCRIPT:
${intakeRecord.rawTranscript}`;
    navigator.clipboard.writeText(text).then(() => toast.success('Intake record copied!'));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🎙️</span>
        <div>
          <p className="text-xs font-semibold text-foreground">Voice Intake</p>
          <p className="text-[10px] text-muted-foreground">Record client case details → ElevenLabs transcribes → Lexi summarizes into structured intake</p>
        </div>
      </div>

      {/* Step: Idle */}
      {step === 'idle' && (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎙️</span>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Ready to Record</p>
          <p className="text-xs text-muted-foreground mb-4">Click to start recording the client's case description</p>
          <button
            onClick={startRecording}
            className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all"
          >
            Start Recording
          </button>
        </div>
      )}

      {/* Step: Recording */}
      {step === 'recording' && (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-red-100 border-2 border-red-400 flex items-center justify-center mx-auto mb-4 relative">
            <span className="text-3xl">🎙️</span>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-red-600 mb-1">Recording…</p>
          <p className="text-2xl font-mono text-foreground mb-4">{formatTime(recordingTime)}</p>
          <p className="text-xs text-muted-foreground mb-4">Speak clearly about the case details, incident, parties involved, and any relevant facts</p>
          <button
            onClick={stopRecording}
            className="px-6 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all"
          >
            Stop Recording
          </button>
        </div>
      )}

      {/* Step: Recorded */}
      {step === 'recorded' && audioUrl && (
        <div className="space-y-4">
          <div className="bg-secondary/20 border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">🎵</span>
              <div>
                <p className="text-sm font-medium text-foreground">Recording Complete</p>
                <p className="text-xs text-muted-foreground">Duration: {formatTime(recordingTime)}</p>
              </div>
            </div>
            <audio src={audioUrl} controls className="w-full h-8" />
          </div>

          <div className="flex gap-2">
            <button
              onClick={resetIntake}
              className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary/30 transition-all"
            >
              Re-record
            </button>
            <button
              onClick={transcribeAudio}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <span>✨</span>
              Transcribe & Summarize
            </button>
          </div>
        </div>
      )}

      {/* Step: Transcribing */}
      {step === 'transcribing' && (
        <div className="text-center py-6">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-foreground">Transcribing audio…</p>
          <p className="text-xs text-muted-foreground mt-1">Converting speech to text</p>
        </div>
      )}

      {/* Step: Summarizing */}
      {(step === 'summarizing' || summarizing) && (
        <div className="space-y-3">
          {transcript && (
            <div className="bg-secondary/20 border border-border rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Transcript</p>
              <p className="text-xs text-foreground leading-relaxed line-clamp-4">{transcript}</p>
            </div>
          )}
          <div className="text-center py-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Lexi is analyzing…</p>
            <p className="text-xs text-muted-foreground mt-1">Extracting structured intake information</p>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && intakeRecord && (
        <div className="space-y-3">
          {/* Intake Record */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">Intake Record</p>
              <div className="flex gap-2">
                <button
                  onClick={copyIntake}
                  className="px-2.5 py-1 border border-border rounded-lg text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                >
                  Copy
                </button>
                <button
                  onClick={resetIntake}
                  className="px-2.5 py-1 border border-border rounded-lg text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                >
                  New Intake
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: 'Client', value: intakeRecord.clientName },
                { label: 'Case Type', value: intakeRecord.caseType },
                { label: 'Incident Date', value: intakeRecord.incidentDate },
                { label: 'Location', value: intakeRecord.location },
                { label: 'Contact', value: intakeRecord.contactInfo },
                { label: 'Urgency', value: intakeRecord.urgencyLevel },
              ].filter(f => f.value).map(field => (
                <div key={field.label}>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{field.label}</p>
                  <p className="text-xs text-foreground font-medium">{field.value}</p>
                </div>
              ))}
            </div>

            {intakeRecord.parties && (
              <div className="mb-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">Parties Involved</p>
                <p className="text-xs text-foreground">{intakeRecord.parties}</p>
              </div>
            )}

            <div className="mb-3">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">Summary</p>
              <p className="text-xs text-foreground leading-relaxed">{intakeRecord.summary}</p>
            </div>

            {intakeRecord.keyFacts.length > 0 && (
              <div className="mb-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Key Facts</p>
                <ul className="space-y-0.5">
                  {intakeRecord.keyFacts.map((fact, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-1.5">
                      <span className="text-primary shrink-0">•</span>
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {intakeRecord.nextSteps.length > 0 && (
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Next Steps</p>
                <ul className="space-y-0.5">
                  {intakeRecord.nextSteps.map((step, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-1.5">
                      <span className="text-primary shrink-0">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Raw Transcript */}
          <details className="bg-secondary/10 border border-border rounded-xl overflow-hidden">
            <summary className="px-3 py-2 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground">
              View Raw Transcript
            </summary>
            <div className="px-3 pb-3">
              <p className="text-xs text-foreground leading-relaxed">{intakeRecord.rawTranscript}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
