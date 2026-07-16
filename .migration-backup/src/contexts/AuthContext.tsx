'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  company?: string;
  address_line1?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  role: string;
  avatar_url?: string;
  notification_prefs?: Record<string, boolean>;
  invoice_email_settings?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  user: any;
  session: any;
  loading: boolean;
  userRole: string | null;
  isAdmin: boolean;
  isClient: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, string>) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  getCurrentUser: () => Promise<any>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<UserProfile | null>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const supabase = createClient();

  const fetchRole = async (currentUser: any) => {
    if (!currentUser) {
      setUserRole(null);
      return;
    }
    // Check auth metadata first (fastest, no DB round-trip)
    const metaRole =
      currentUser.user_metadata?.role ||
      currentUser.app_metadata?.role ||
      null;
    if (metaRole) {
      setUserRole(metaRole);
      return;
    }
    // Fallback: read from user_profiles table
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();
      setUserRole(data?.role ?? 'client');
    } catch {
      setUserRole('client');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      fetchRole(session?.user ?? null).finally(() => setLoading(false));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      fetchRole(session?.user ?? null).finally(() => setLoading(false));
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Email/Password Sign Up
  const signUp = async (email: string, password: string, metadata: Record<string, string> = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
          role: 'client',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal/onboarding`,
      },
    });
    if (error) throw error;
    return data;
  };

  // Email/Password Sign In
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  // Google OAuth Sign In
  const signInWithGoogle = async (redirectTo?: string) => {
    const next = redirectTo ?? '/portal/dashboard';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) throw error;
  };

  // Sign Out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUserRole(null);
  };

  // Reset Password (sends email)
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/portal/reset-password`,
    });
    if (error) throw error;
  };

  // Update Password (after reset link clicked)
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  // Get Current User
  const getCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  // Check if Email is Verified
  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  // Get User Profile from Database
  const getUserProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data as UserProfile | null;
  };

  // Update User Profile
  const updateProfile = async (patch: Partial<UserProfile>) => {
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { id: user.id, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    if (error) throw error;
    // Also sync full_name to auth metadata if provided
    if (patch.full_name) {
      await supabase.auth.updateUser({ data: { full_name: patch.full_name } });
    }
  };

  // Refresh role from DB (call after role changes)
  const refreshRole = async () => {
    const {
      data: { user: freshUser },
    } = await supabase.auth.getUser();
    await fetchRole(freshUser);
  };

  const isAdmin = userRole === 'admin';
  const isClient = userRole === 'client' || (!isAdmin && !!user);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    userRole,
    isAdmin,
    isClient,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    updateProfile,
    refreshRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
