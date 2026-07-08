'use client';

import React, { useEffect, useRef } from 'react';
import ConsultationScheduler from '@/components/ConsultationScheduler';

interface BookConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BookConsultationModal({ isOpen, onClose }: BookConsultationModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Book a Consultation"
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--background, #FAF7F2)' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border"
          style={{ background: 'var(--background, #FAF7F2)' }}
        >
          <div>
            <h2 className="font-serif text-xl text-foreground">Book a Consultation</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Instant confirmation · Google Meet link sent to your inbox
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all"
            aria-label="Close booking modal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scheduler */}
        <div className="p-6">
          <ConsultationScheduler
            onBookingComplete={() => {
              // Keep modal open to show success state inside scheduler
            }}
          />
        </div>
      </div>
    </div>
  );
}
