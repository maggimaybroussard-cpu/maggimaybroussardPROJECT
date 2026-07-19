'use client';

import React, { useState, useEffect } from 'react';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  getCurrentPushSubscription,
} from '@/lib/pushNotifications';

interface CaseUpdatePushEnablerProps {
  userId?: string;
}

export default function CaseUpdatePushEnabler({ userId }: CaseUpdatePushEnablerProps) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function init() {
      const ok = await isPushSupported();
      setSupported(ok);
      if (!ok) return;
      const perm = await getPushPermission();
      setPermission(perm);
      const sub = await getCurrentPushSubscription();
      setSubscribed(!!sub);
    }
    init();
  }, []);

  if (!mounted || !supported || permission === 'denied') return null;
  if (subscribed) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Push notifications enabled — you'll receive case updates and document alerts
      </div>
    );
  }

  const handleEnable = async () => {
    setLoading(true);
    try {
      const ok = await subscribeToPush(userId, 'client');
      if (ok) {
        setSubscribed(true);
        setPermission('granted');
        setJustEnabled(true);
      } else {
        const perm = await getPushPermission();
        setPermission(perm);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border p-4 flex items-start gap-3" style={{ borderColor: '#D9D0C5', background: '#FAF7F2' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#355E3B' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm" style={{ color: '#2C1F14' }}>Enable Case Update Alerts</p>
        <p className="text-xs mt-0.5" style={{ color: '#7A6B5D' }}>
          Get instant push notifications for case updates, document-ready alerts, and deadlines — right on your home screen.
        </p>
        {justEnabled && (
          <p className="text-xs mt-1 text-emerald-600 font-medium">✓ Notifications enabled!</p>
        )}
      </div>
      {!subscribed && (
        <button
          onClick={handleEnable}
          disabled={loading}
          className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: '#355E3B' }}
        >
          {loading ? '…' : 'Enable'}
        </button>
      )}
    </div>
  );
}
