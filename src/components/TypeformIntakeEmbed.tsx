'use client';

import React, { useState } from 'react';
import { Widget } from '@typeform/embed-react';

// Typeform form IDs
// uJ5Oyo7R = "Broussard Legal Services - Client Intake"
// xQJyr6hy = "Consultation Intake Form – Maggi May Broussard"
const INTAKE_FORM_ID = 'uJ5Oyo7R';

interface TypeformIntakeEmbedProps {
  clientName?: string;
  clientEmail?: string;
  onSubmit?: () => void;
}

export default function TypeformIntakeEmbed({ clientName, clientEmail, onSubmit }: TypeformIntakeEmbedProps) {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit?.();
  };

  if (submitted) {
    return (
      <div
        className="rounded-2xl p-8 flex flex-col items-center text-center gap-4"
        style={{ background: 'rgba(53,94,59,0.07)', border: '1px solid rgba(53,94,59,0.2)' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(53,94,59,0.15)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-foreground text-base mb-1">Intake form submitted!</p>
          <p className="text-sm text-muted-foreground font-light leading-relaxed">
            Thank you{clientName ? `, ${clientName.split(' ')[0]}` : ''}. Your intake has been received and Maggi will review it before your consultation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-border" style={{ minHeight: '520px' }}>
      <Widget
        id={INTAKE_FORM_ID}
        style={{ width: '100%', height: '520px' }}
        className="typeform-intake-widget"
        hidden={{
          name: clientName ?? '',
          email: clientEmail ?? '',
        }}
        onSubmit={handleSubmit}
        enableSandbox={false}
      />
    </div>
  );
}
