import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { runtimeConfig } from '../config/runtime';
import { requireSupabase, supabase } from '../lib/supabase';
import type { Company, UserRole } from '../types';

interface AuthProfile {
  id: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  globalRole: 'super_admin' | 'regional_partner' | 'sales_partner' | null;
  active: boolean;
}

interface Membership {
  companyId: string;
  role: 'company_admin' | 'operator' | 'driver';
  active: boolean;
  company: Company;
}

interface AuthContextValue {
  session: Session | null;
  authUser: SupabaseUser | null;
  profile: AuthProfile | null;
  memberships: Membership[];
  companies: Company[];
  effectiveRole: UserRole | null;
  loading: boolean;
  identityError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  refreshIdentity: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const mapCompany = (row: any): Company => ({
  id: row.id,
  name: row.name,
  code: row.code,
  phone: row.phone ?? '',
  address: row.address ?? '',
  vhfFrequency: row.vhf_frequency ?? undefined,
  totalVehicles: 0,
  totalDrivers: 0,
  active: row.active ?? true,
  logoUrl: row.logo_url ?? undefined,
});

const isOfficialOrigin = () => {
  try { return window.location.origin === new URL(runtimeConfig.officialAppUrl).origin; }
  catch { return false; }
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const loadIdentity = async (nextSession: Session | null) => {
    setSession(nextSession);
    setIdentityError(null);
    if (!nextSession) {
      setProfile(null); setMemberships([]); setCompanies([]); setLoading(false); return;
    }

    const db = requireSupabase();
    setLoading(true);
    try {
      const [{ data: profileRow, error: profileError }, { data: membershipRows, error: membershipError }] = await Promise.all([
        db.from('profiles').select('id,name,phone,avatar_url,global_role,active').eq('id', nextSession.user.id).single(),
        db.from('company_memberships').select('company_id,role,active,companies(id,name,code,phone,address,vhf_frequency,logo_url,active)').eq('user_id', nextSession.user.id).eq('active', true),
      ]);
      if (profileError) throw profileError;
      if (membershipError) throw membershipError;
      if (!profileRow.active) throw new Error('Esta cuenta está suspendida. Contacta al administrador de Central GO.');

      const nextProfile: AuthProfile = {
        id: profileRow.id,
        name: profileRow.name,
        phone: profileRow.phone,
        avatarUrl: profileRow.avatar_url,
        globalRole: profileRow.global_role,
        active: profileRow.active,
      };
      setProfile(nextProfile);

      const mapped: Membership[] = (membershipRows ?? [])
        .filter((row: any) => row.companies)
        .map((row: any) => ({
          companyId: row.company_id,
          role: row.role,
          active: row.active,
          company: mapCompany(Array.isArray(row.companies) ? row.companies[0] : row.companies),
        }));
      setMemberships(mapped);

      if (nextProfile.globalRole === 'super_admin') {
        const { data: companyRows, error: companiesError } = await db.from('companies').select('id,name,code,phone,address,vhf_frequency,logo_url,active').order('name');
        if (companiesError) throw companiesError;
        setCompanies((companyRows ?? []).map(mapCompany));
      } else {
        setCompanies(mapped.map((item) => item.company));
      }
    } catch (error) {
      console.error('[Central GO] No fue posible cargar la identidad oficial', error);
      setIdentityError(error instanceof Error ? error.message : 'No fue posible cargar el perfil.');
      setProfile(null); setMemberships([]); setCompanies([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) { setIdentityError(error.message); setLoading(false); return; }
      void loadIdentity(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset-password') {
        window.history.replaceState({}, '', '/reset-password');
      }
      void loadIdentity(nextSession);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    const db = requireSupabase();
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  };

  const signUp = async (name: string, email: string, password: string) => {
    const db = requireSupabase();
    const { data, error } = await db.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
    return { needsEmailConfirmation: !data.session };
  };

  const signOut = async () => {
    const db = requireSupabase();
    const { error } = await db.auth.signOut();
    if (error) throw error;
  };

  const updatePassword = async (password: string) => {
    if (password.length < 10) throw new Error('La contraseña debe tener al menos 10 caracteres.');
    const db = requireSupabase();
    const metadata = { ...(session?.user.user_metadata ?? {}), needs_password_setup: false };
    const { error } = await db.auth.updateUser({ password, data: metadata });
    if (error) throw error;
  };

  const requestPasswordReset = async (email: string) => {
    if (!isOfficialOrigin()) {
      throw new Error(`Por seguridad, solicita la recuperación desde Central GO Oficial: ${runtimeConfig.officialAppUrl}`);
    }
    const db = requireSupabase();
    const { error } = await db.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${runtimeConfig.officialAppUrl}/reset-password` });
    if (error) throw error;
  };

  const effectiveRole = useMemo<UserRole | null>(() => {
    if (profile?.globalRole) return profile.globalRole;
    return memberships[0]?.role ?? null;
  }, [profile, memberships]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    authUser: session?.user ?? null,
    profile,
    memberships,
    companies,
    effectiveRole,
    loading,
    identityError,
    signIn,
    signUp,
    signOut,
    updatePassword,
    requestPasswordReset,
    refreshIdentity: () => loadIdentity(session),
  }), [session, profile, memberships, companies, effectiveRole, loading, identityError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
