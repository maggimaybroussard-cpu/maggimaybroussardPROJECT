'use client';

import Link from 'next/link';

export default function CCPALink() {
  return (
    <Link
      href="/privacy#do-not-sell"
      className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors duration-200 uppercase tracking-wider"
    >
      Do Not Sell My Personal Information
    </Link>
  );
}
