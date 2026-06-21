'use client';

import React, { Suspense } from 'react';
import ReferralPortalContent from './ReferralPortalContent';

export default function ReferralPortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF7F2' }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4A3728' }} />
      </div>
    }>
      <ReferralPortalContent />
    </Suspense>
  );
}
