'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface GWorkspaceTool {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  action?: { label: string; href: string };
  status?: 'connected' | 'disconnected' | 'pending';
}

interface GoogleWorkspacePanelProps {
  compact?: boolean;
  showStatus?: boolean;
  className?: string;
}

const WORKSPACE_TOOLS: GWorkspaceTool[] = [
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Sync consultations & deadlines',
    color: '#4285F4',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="18" height="18" rx="2" fill="#4285F4" fillOpacity="0.15"/>
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="8" y1="2" x2="8" y2="6" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="3" y1="10" x2="21" y2="10" stroke="#4285F4" strokeWidth="1.5"/>
        <rect x="7" y="13" width="4" height="4" rx="0.5" fill="#4285F4"/>
      </svg>
    ),
    action: { label: 'Book Now', href: '/booking' },
  },
  {
    id: 'meet',
    name: 'Google Meet',
    description: 'Video consultations included',
    color: '#00897B',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="23 7 16 12 23 17 23 7" fill="#00897B" fillOpacity="0.15" stroke="#00897B" strokeWidth="1.5" strokeLinejoin="round"/>
        <rect x="1" y="5" width="15" height="14" rx="2" fill="#00897B" fillOpacity="0.1" stroke="#00897B" strokeWidth="1.5"/>
      </svg>
    ),
    action: { label: 'Schedule', href: '/booking' },
  },
  {
    id: 'docs',
    name: 'Google Docs',
    description: 'Case notes & document drafts',
    color: '#4285F4',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="#4285F4" fillOpacity="0.1" stroke="#4285F4" strokeWidth="1.5" strokeLinejoin="round"/>
        <polyline points="14 2 14 8 20 8" stroke="#4285F4" strokeWidth="1.5" strokeLinejoin="round"/>
        <line x1="16" y1="13" x2="8" y2="13" stroke="#4285F4" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="16" y1="17" x2="8" y2="17" stroke="#4285F4" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    action: { label: 'View Docs', href: '/portal/documents' },
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    description: 'Billing & time tracking',
    color: '#0F9D58',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58" fillOpacity="0.1" stroke="#0F9D58" strokeWidth="1.5"/>
        <line x1="3" y1="9" x2="21" y2="9" stroke="#0F9D58" strokeWidth="1.2"/>
        <line x1="3" y1="15" x2="21" y2="15" stroke="#0F9D58" strokeWidth="1.2"/>
        <line x1="9" y1="3" x2="9" y2="21" stroke="#0F9D58" strokeWidth="1.2"/>
        <line x1="15" y1="3" x2="15" y2="21" stroke="#0F9D58" strokeWidth="1.2"/>
      </svg>
    ),
    action: { label: 'View Billing', href: '/portal/billing' },
  },
  {
    id: 'voice',
    name: 'Google Voice',
    description: 'Direct line to Maggi',
    color: '#DB4437',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .98h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" fill="#DB4437" fillOpacity="0.1" stroke="#DB4437" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    action: { label: 'Contact', href: '/contact' },
  },
];

export default function GoogleWorkspacePanel({ compact = false, showStatus = false, className = '' }: GoogleWorkspacePanelProps) {
  const [gcalConnected, setGcalConnected] = useState(false);

  useEffect(() => {
    fetch('/api/google-calendar/status')
      .then(r => r.json())
      .then(d => setGcalConnected(d.connected ?? false))
      .catch(() => {});
  }, []);

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {WORKSPACE_TOOLS.map(tool => (
          <div
            key={tool.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground"
          >
            {tool.icon}
            <span>{tool.name}</span>
            {showStatus && tool.id === 'calendar' && (
              <span className={`w-1.5 h-1.5 rounded-full ${gcalConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-border shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Google Workspace</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Integrated tools powering your legal workflow</p>
        </div>
        {showStatus && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${gcalConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className="text-muted-foreground">{gcalConnected ? 'Calendar synced' : 'Calendar not connected'}</span>
          </div>
        )}
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {WORKSPACE_TOOLS.map(tool => (
          <div key={tool.id} className="flex items-start gap-3 p-3 rounded-xl border border-border hover:border-muted-foreground/30 transition-colors">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tool.color}15` }}>
              {tool.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{tool.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
              {tool.action && (
                <Link href={tool.action.href} className="text-xs font-medium mt-1.5 inline-block hover:underline" style={{ color: tool.color }}>
                  {tool.action.label} →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
