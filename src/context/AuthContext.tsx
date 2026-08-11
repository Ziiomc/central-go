import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { requireSupabase, supabase } from '../lib/supabase';
import type { Company, UserRole } from '../types';

interface AuthProfile { id:string; name:string; phone:string|null; avatarUrl:string|null; globalRole:'super_admin'|'regional_partner'|'sales_partner'|null; active:boolean; }
interface Membership { companyId:string; role:'company_admin'|'operator'|'driver'; active:boolean; company:Company; }
export interface SaaSAccount { accountKind:'central'|'sales_partner'; companyId:string|null; status:string; trialStartedAt:string; trialEndsAt:string; currentPeriodEnd:string|null; }
interface AuthContextValue { session:Session|null; authUser:SupabaseUser|null; profile:AuthProfile|null; memberships:Membership[]; companies:Company[]; saasAccount:SaaSAccount|null; effectiveRole:UserRole|null; loading:boolean; identityError:string|null; signInWithGoogle:()=>Promise<void>; signIn:(email:string,password:string)=>Promise<void>; signOut:()=>Promise<void>; updatePassword:(password:string)=>Promise<void>; refreshIdentity:()=>Promise<void>; }
const AuthContext=createContext<AuthContextValue|undefined>(undefined);
const mapCompany=(row:any):Company=>({id:row.id,name:row.name,code:row.code,phone:row.phone??'',address:row.address??'',vhfFrequency:row.vhf_frequency??undefined,totalVehicles:0,totalDrivers:0,active:row.active??true,logoUrl:row.logo_url??undefined});

export const AuthProvider:React.FC<React.PropsWithChildren>=({children})=>{
 const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<AuthProfile|null>(null),[memberships,setMemberships]=useState<Membership[]>([]),[companies,setCompanies]=useState<Company[]>([]),[saasAccount,setSaasAccount]=useState<SaaSAccount|null>(null),[loading,setLoading]=useState(true),[identityError,setIdentityError]=useState<string|null>(null);
 const loadIdentity=async(nextSession:Session|null)=>{setSession(nextSession);setIdentityError(null);if(!nextSession){setProfile(null);setMemberships([]);setCompanies([]);setSaasAccount(null);setLoading(false);return;}const db=requireSupabase();setLoading(true);try{
  const [{data:profileRow,error:profileError},{data:membershipRows,error:membershipError},{data:saasRow,error:saasError}]=await Promise.all([
   db.from('profiles').select('id,name,phone,avatar_url,global_role,active').eq('id',nextSession.user.id).single(),
   db.from('company_memberships').select('company_id,role,active,companies(id,name,code,phone,address,vhf_frequency,logo_url,active)').eq('user_id',nextSession.user.id).eq('active',true),
   db.from('saas_accounts').select('account_kind,company_id,status,trial_started_at,trial_ends_at,current_period_end').eq('user_id',nextSession.user.id).maybeSingle()
  ]);if(profileError)throw profileError;if(membershipError)throw membershipError;if(saasError)throw saasError;if(!profileRow.active)throw new Error('Esta cuenta está suspendida. Contacta a Central GO.');
  const nextProfile={id:profileRow.id,name:profileRow.name,phone:profileRow.phone,avatarUrl:profileRow.avatar_url,globalRole:profileRow.global_role,active:profileRow.active};setProfile(nextProfile);
  const mapped:Membership[]=(membershipRows??[]).filter((r:any)=>r.companies).map((r:any)=>({companyId:r.company_id,role:r.role,active:r.active,company:mapCompany(Array.isArray(r.companies)?r.companies[0]:r.companies)}));setMemberships(mapped);
  setSaasAccount(saasRow?{accountKind:saasRow.account_kind,companyId:saasRow.company_id,status:saasRow.status,trialStartedAt:saasRow.trial_started_at,trialEndsAt:saasRow.trial_ends_at,currentPeriodEnd:saasRow.current_period_end}:null);
  if(nextProfile.globalRole==='super_admin'){const {data,error}=await db.from('companies').select('id,name,code,phone,address,vhf_frequency,logo_url,active').order('name');if(error)throw error;setCompanies((data??[]).map(mapCompany));}else setCompanies(mapped.map(x=>x.company));
 }catch(error){console.error('[Central GO] identity',error);setIdentityError(error instanceof Error?error.message:'No fue posible cargar el perfil.');setProfile(null);setMemberships([]);setCompanies([]);setSaasAccount(null);}finally{setLoading(false);}};
 useEffect(()=>{if(!supabase){setLoading(false);return;}let mounted=true;supabase.auth.getSession().then(({data,error})=>{if(!mounted)return;if(error){setIdentityError(error.message);setLoading(false);return;}void loadIdentity(data.session);});const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>{if(mounted)void loadIdentity(next);});return()=>{mounted=false;listener.subscription.unsubscribe();};},[]);
 const signInWithGoogle=async()=>{const db=requireSupabase();const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/`}});if(error)throw error;};
 const signIn=async(email:string,password:string)=>{const db=requireSupabase();const {error}=await db.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;};
 const signOut=async()=>{const {error}=await requireSupabase().auth.signOut();if(error)throw error;};
 const updatePassword=async(password:string)=>{if(password.length<10)throw new Error('La contraseña debe tener al menos 10 caracteres.');const db=requireSupabase();const metadata={...(session?.user.user_metadata??{}),needs_password_setup:false};const {data,error}=await db.auth.updateUser({password,data:metadata});if(error)throw error;if(data.user&&session)setSession({...session,user:data.user});};
 const effectiveRole=useMemo<UserRole|null>(()=>profile?.globalRole??memberships[0]?.role??null,[profile,memberships]);
 const value=useMemo(()=>({session,authUser:session?.user??null,profile,memberships,companies,saasAccount,effectiveRole,loading,identityError,signInWithGoogle,signIn,signOut,updatePassword,refreshIdentity:()=>loadIdentity(session)}),[session,profile,memberships,companies,saasAccount,effectiveRole,loading,identityError]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>{const c=useContext(AuthContext);if(!c)throw new Error('useAuth must be used within AuthProvider');return c;};