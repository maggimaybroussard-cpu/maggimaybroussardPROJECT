'use client';

import React from 'react';
import Header from '@/components/Header';

interface HeaderInnerProps {
  initialClaims?: Record<string, unknown> | null;
}

export default function HeaderInner({ initialClaims }: HeaderInnerProps) {
  return <Header initialClaims={initialClaims} />;
}
