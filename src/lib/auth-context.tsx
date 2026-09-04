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

/**
 * Preview / Demo mode — injects a mock user with the role specified by
 * NEXT_PUBLIC_PREVIEW_ROLE (superuser | administrator | viewer). This bypasses
 * Supabase entirely so the preview URL can be opened without credentials.
 * Only active when Supabase URL is not configured OR when explicitly enabled
 * via NEXT_PUBLIC_PREVIEW_ROLE.
 */
const PREVIEW_ROLE = (typeof process !== 'undefined'
  ? (process.env.NEXT_PUBLIC_PREVIEW_ROLE as UserRole | '' | undefined)
  : '') || '';

const SUPABASE_CONFIGURED = !!(
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const PREVIEW_MODE: boolean = !!PREVIEW_ROLE;

const MOCK_USER_ID = 'preview-0000-0000-0000-000000000001';

function buildMockProfile(role: UserRole): UserProfile {
  const now = new Date().toISOString();
  const labelMap: Record<UserRole, { username: string; fullName: string }> = {
    superuser: { username: 'superuser.preview', fullName: 'Preview Superuser' },
    administrator: { username: 'admin.preview', fullName: 'Preview Administrator' },
    viewer: { username: 'viewer.preview', fullName: 'Preview Viewer' },
  };
  const label = labelMap[role];
  return {
    id: MOCK_USER_ID,
    user_id: MOCK_USER_ID,
    username: label.username,
    full_name: label.fullName,
    role,
    national_id: null,
    created_at: now,
    updated_at: now,
  };
}

function buildMockUser(): User {
  return {
    id: MOCK_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'preview@bg-health.local',
    app_metadata: { provider: 'preview' },
    user_metadata: { full_name: 'Preview Superuser' },
    identities: [],
    created_at: new Date().toISOString(),
  } as unknown as User;
}

function buildMockSession(): Session {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'preview-access-token',
    refresh_token: 'preview-refresh-token',
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: 'bearer',
    user: buildMockUser(),
  } as unknown as Session;
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
    if (PREVIEW_MODE && PREVIEW_ROLE) {
      setProfile(buildMockProfile(PREVIEW_ROLE as UserRole));
      return;
    }
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    // === Preview Mode — bypass Supabase, inject mock session ===
    if (PREVIEW_MODE && PREVIEW_ROLE) {
      const role = PREVIEW_ROLE as UserRole;
      const mockUser = buildMockUser();
      const mockProfile = buildMockProfile(role);
      const mockSession = buildMockSession();
      setUser(mockUser);
      setSession(mockSession);
      setProfile(mockProfile);
      setLoading(false);
      return () => { cancelled = true; };
    }

    // === Production Mode — real Supabase auth ===
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
