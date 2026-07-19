'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import TimeManagementWidget from '@/components/TimeManagementWidget';
import DocumentStorageWidget from '@/components/DocumentStorageWidget';

export default function WorkspaceWidgetsPage() {
  const [activeTab, setActiveTab] = useState<'time' | 'docs' | 'both'>('both');

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="border-b border-border bg-gradient-to-r from-amber-50 via-white to-blue-50">
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">Home</Link>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-[11px] text-foreground uppercase tracking-widest">Workspace</span>
              </div>
              <h1 className="text-2xl font-serif font-bold text-foreground">Workspace Widgets</h1>
              <p className="text-sm text-muted-foreground mt-1">Time management &amp; document storage — standalone or integrated with Lexi</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Admin Dashboard
              </Link>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex gap-2 mt-6">
            {([
              { key: 'both', label: '⚡ Both Widgets', desc: 'Side by side' },
              { key: 'time', label: '⏰ Time Management', desc: 'Tasks & timers' },
              { key: 'docs', label: '📁 Document Storage', desc: 'Files & search' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all ${
                  activeTab === tab.key
                    ? 'bg-foreground text-background'
                    : 'border border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Widget Area */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 py-8">
        {activeTab === 'both' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⏰</span>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Time Management</h2>
                  <p className="text-[11px] text-muted-foreground">Track tasks, timers, and deadlines</p>
                </div>
              </div>
              <TimeManagementWidget className="h-[600px]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📁</span>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Document Storage</h2>
                  <p className="text-[11px] text-muted-foreground">Upload, organize, and search documents</p>
                </div>
              </div>
              <DocumentStorageWidget className="h-[600px]" />
            </div>
          </div>
        )}

        {activeTab === 'time' && (
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⏰</span>
              <div>
                <h2 className="text-lg font-bold text-foreground">Time Management</h2>
                <p className="text-sm text-muted-foreground">Track tasks, set timers, manage deadlines</p>
              </div>
            </div>
            <TimeManagementWidget className="h-[650px]" />
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📁</span>
              <div>
                <h2 className="text-lg font-bold text-foreground">Document Storage</h2>
                <p className="text-sm text-muted-foreground">Upload, organize, tag, and search documents</p>
              </div>
            </div>
            <DocumentStorageWidget className="h-[650px]" />
          </div>
        )}

        {/* Info cards */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: '🔗',
              title: 'Lexi Integration',
              desc: 'Both widgets connect to Lexi — send tasks and documents directly to your AI legal assistant for analysis and action.',
            },
            {
              icon: '📱',
              title: 'Floating Widgets',
              desc: 'Use the floating versions on any page — they appear as minimizable overlays so you can track time while working.',
            },
            {
              icon: '💾',
              title: 'Local Persistence',
              desc: 'All data is saved locally in your browser. No data leaves your device unless you explicitly send it to Lexi.',
            },
          ].map(card => (
            <div key={card.title} className="bg-secondary/40 rounded-2xl p-5 border border-border">
              <div className="text-2xl mb-2">{card.icon}</div>
              <h3 className="text-sm font-bold text-foreground mb-1">{card.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
