'use client';

import React, { useState, useEffect } from 'react';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentPushSubscription,
} from '@/lib/pushNotifications';

interface PushNotificationManagerProps {
  userId?: string;
  userType?: 'client' | 'admin';
  compact?: boolean;
}

export default function PushNotificationManager({
  userId,
  userType = 'client',
  compact = false,
}: PushNotificationManagerProps) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  if (!mounted || !supported) return null;

  const handleEnable = async () => {
    setLoading(true);
    try {
      const ok = await subscribeToPush(userId, userType);
      if (ok) {
        setSubscribed(true);
        setPermission('granted');
      } else {
        const perm = await getPushPermission();
        setPermission(perm);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  };

  if (permission === 'denied') {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        <span>Push notifications blocked. Enable in browser settings.</span>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={subscribed ? handleDisable : handleEnable}
        disabled={loading}
        title={subscribed ? 'Disable push notifications' : 'Enable push notifications'}
        className="relative p-2 rounded-lg transition-colors"
        style={{
          background: subscribed ? 'rgba(53,94,59,0.10)' : 'rgba(200,150,90,0.10)',
          color: subscribed ? '#355E3B' : '#C8965A',
        }}
      >
        {loading ? (
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : subscribed ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            <circle cx="18" cy="5" r="3" fill="#355E3B" stroke="none" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
      style={{
        background: subscribed ? 'rgba(53,94,59,0.05)' : 'rgba(250,247,242,1)',
        borderColor: subscribed ? 'rgba(53,94,59,0.25)' : '#D9D0C5',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: subscribed ? 'rgba(53,94,59,0.12)' : 'rgba(200,150,90,0.12)' }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={subscribed ? '#355E3B' : '#C8965A'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#2C1F14', fontFamily: 'Georgia, serif' }}>
            Browser Push Alerts
          </p>
          <p className="text-xs" style={{ color: '#7A6B5D' }}>
            {subscribed
              ? 'You\'ll receive alerts for case updates, invoices & consultations'
              : 'Get instant alerts for case updates, invoices & consultations'}
          </p>
        </div>
      </div>

      <button
        onClick={subscribed ? handleDisable : handleEnable}
        disabled={loading}
        className="flex-shrink-0 text-xs font-semibold px-4 py-2 rounded-lg transition-all"
        style={{
          background: subscribed ? 'rgba(220,38,38,0.08)' : '#C8965A',
          color: subscribed ? '#DC2626' : '#FFFFFF',
          border: subscribed ? '1px solid rgba(220,38,38,0.20)' : 'none',
          fontFamily: 'Georgia, serif',
          minWidth: 80,
        }}
      >
        {loading ? (
          <span className="flex items-center gap-1">
            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            ...
          </span>
        ) : subscribed ? (
          'Disable'
        ) : (
          'Enable'
        )}
      </button>
    </div>
  );
}
