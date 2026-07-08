'use client';

import dynamic from 'next/dynamic';

const HeaderInner = dynamic(() => import('./HeaderInner'), { ssr: false });

export default function Header() {
  return <HeaderInner />;
}