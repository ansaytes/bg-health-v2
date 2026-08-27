'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole = 'superuser' | 'administrator' | 'viewer';

export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  national_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperuser: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  isAdmin: false,
  isSuperuser: false,
  refreshProfile: async () => {},
});

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const role = profile?.role ?? null;
  const isAdmin = role === 'superuser' || role === 'administrator';
  const isSuperuser = role === 'superuser';

  const refreshProfile = useCallback(async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (cancelled) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        const p = await fetchProfile(sess.user.id);
        if (!cancelled) setProfile(p);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    // Timeout fallback: if Supabase is unreachable, stop loading after 3s
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 3000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        if (cancelled) return;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          const p = await fetchProfile(sess.user.id);
          if (!cancelled) setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, profile, role, loading, isAdmin, isSuperuser, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
