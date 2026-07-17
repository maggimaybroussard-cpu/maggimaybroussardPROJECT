'use client';

import React, { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    const msg = error?.message ?? '';
    const isChunkError =
      error?.name === 'ChunkLoadError' || msg.includes("reading'call'") ||
      msg.includes("reading\"call\"") ||
      msg.includes("reading 'call'") ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Cannot read properties of undefined') ||
      msg.includes('ChunkLoadError');

    if (isChunkError) {
      const alreadyReloaded = sessionStorage.getItem('chunk-reload-attempted');
      if (!alreadyReloaded) {
        sessionStorage.setItem('chunk-reload-attempted', '1');
        window.location.reload();
        return;
      }
    }
    // Clear the guard on non-chunk errors so future chunk errors can still reload
    sessionStorage.removeItem('chunk-reload-attempted');
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, background: '#fafaf9' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.75rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem('chunk-reload-attempted');
              reset();
            }}
            style={{ background: '#4A3728', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.5rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500 }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
