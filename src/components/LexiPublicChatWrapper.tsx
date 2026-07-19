'use client';

import dynamic from 'next/dynamic';

const LexiPublicChat = dynamic(() => import('@/components/LexiPublicChat'), { ssr: false });

export default function LexiPublicChatWrapper() {
  return <LexiPublicChat />;
}
