'use client';

import React, { Suspense, useRef } from 'react';
import { Widget } from '@typeform/embed-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { trackIntakeFormComplete } from '@/lib/analytics';

const TYPEFORM_ID = 'uJ5Oyo7R';

function TypeformIntake() {
  const serviceTypeRef = useRef<string>('unknown');

  function handleSubmit({ responseId }: { responseId: string }) {
    trackIntakeFormComplete({
      serviceType: serviceTypeRef.current,
      responseId,
    });
  }

  // onResponse fires with each answer — capture the service/matter type selection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleResponse(data: any) {
    try {
      const answers: Array<{
        field: { ref: string };
        type: string;
        text?: string;
        choice?: { label: string };
        choices?: { labels: string[] };
      }> = data?.answers ?? [];

      for (const answer of answers) {
        const ref: string = answer?.field?.ref ?? '';
        if (
          ref.toLowerCase().includes('service') ||
          ref.toLowerCase().includes('matter') ||
          ref.toLowerCase().includes('type')
        ) {
          const label =
            answer?.choice?.label ??
            answer?.choices?.labels?.join(', ') ??
            answer?.text ??
            '';
          if (label) {
            serviceTypeRef.current = label;
          }
        }
      }
    } catch {
      // silently ignore parse errors
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5]">
      <Header />

      {/* Hero banner */}
      <section className="bg-[#2C2416] py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block bg-[#C8965A]/20 text-[#C8965A] text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4">
            Client Intake
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Start Your Legal Matter
          </h1>
          <p className="text-[#C4B49A] text-base md:text-lg max-w-xl mx-auto">
            Complete this short questionnaire so we can understand your needs before your consultation. Takes 3–5 minutes.
          </p>
        </div>
      </section>

      {/* Typeform embed */}
      <main className="flex-1 w-full">
        <Widget
          id={TYPEFORM_ID}
          style={{ width: '100%', height: '680px' }}
          className="w-full"
          hideFooter={false}
          hideHeaders={false}
          opacity={100}
          onSubmit={handleSubmit}
          onResponse={handleResponse}
        />
      </main>

      <Footer />
    </div>
  );
}

export default function IntakePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-[#7A6B5D] text-sm">Loading intake form…</div>
      </div>
    }>
      <TypeformIntake />
    </Suspense>
  );
}
