import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthChangeEvent, EmailOtpType, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { requireSupabase, supabase } from '../lib/supabase';
import type { Company, UserRole } from '../types';
import { runtimeConfig } from '../config/runtime';

interface AuthProfile { id:string; name:string; phone:string|null; avatarUrl:string|null; globalRole:'super_admin'|'regional_partner'|'sales_partner'|null; active:boolean; }
interface Membership { companyId:string; role:'company_admin'|'operator'|'driver'; active:boolean; company:Company; }
export interface SaaSAccount { accountKind:'central'|'driver'|'operator'|'sales_partner'; companyId:string|null; status:string; trialStartedAt:string; trialEndsAt:string; currentPeriodEnd:string|null; countryCode:string|null; region:string|null; city:string|null; }
export type OnboardingRole='central'|'driver'|'operator'|'sales_partner';
export const ONBOARDING_INTENT_KEY='centralgo:onboarding-intent';
export interface DriverApplication { id:string; companyId:string; companyName:string; status:'draft'|'pending'|'approved'|'rejected'|'withdrawn'; rejectionReason:string|null; createdAt:string; }
export interface PartnerApplication { id:string; status:'pending'|'approved'|'rejected'; countryCode:string; region:string|null; city:string; eligibleReviewAt:string; rejectionReason:string|null; createdAt:string; reviewedAt:string|null; }
interface AuthContextValue { session:Session|null; authUser:SupabaseUser|null; profile:AuthProfile|null; memberships:Membership[]; companies:Company[]; saasAccount:SaaSAccount|null; driverApplication:DriverApplication|null; partnerApplication:PartnerApplication|null; effectiveRole:UserRole|null; loading:boolean; identityError:string|null; signInWithGoogle:(intent?:OnboardingRole)=>Promise<void>; signUp:(email:string,password:string,intent:OnboardingRole)=>Promise<boolean>; signIn:(email:string,password:string)=>Promise<void>; signOut:()=>Promise<void>; updatePassword:(password:string)=>Promise<void>; requestPasswordReset:(email:string)=>Promise<void>; refreshIdentity:()=>Promise<void>; }
const AuthContext=createContext<AuthContextValue|undefined>(undefined);
const mapCompany=(row:any):Company=>({id:row.id,name:row.name,code:row.code,phone:row.phone??'',address:row.address??'',vhfFrequency:row.vhf_frequency??undefined,totalVehicles:0,totalDrivers:0,active:row.active??true,logoUrl:row.logo_url??undefined});
const wait=(ms:number)=>new Promise(resolve=>window.setTimeout(resolve,ms));

const consumeTokenHashLink=async()=>{
 if(typeof window==='undefined'||!supabase)return null;
 const params=new URLSearchParams(window.location.search);
 const tokenHash=params.get('token_hash');
 const rawType=params.get('type');
 if(!tokenHash||!rawType)return null;
 const allowedTypes:EmailOtpType[]=['invite','recovery','email','magiclink','signup','email_change'];
 if(!allowedTypes.includes(rawType as EmailOtpType))return null;
 const {data,error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:rawType as EmailOtpType});
 if(error)throw error;
 const cleaned=new URL(window.location.href);
 cleaned.searchParams.delete('token_hash');
 cleaned.searchParams.delete('type');
 window.history.replaceState({},document.title,`${cleaned.pathname}${cleaned.search}${cleaned.hash}`);
 return data.session;
};

const consumeLegacyAuthHash=async()=>{
 if(typeof window==='undefined'||!supabase||!window.location.hash)return null;
 const params=new URLSearchParams(window.location.hash.slice(1));
 const accessToken=params.get('access_token');
 const refreshToken=params.get('refresh_token');
 const type=params.get('type');
 const allowedHashTypes=['recovery','invite','signup','magiclink'];
 if(!accessToken||!refreshToken||!type||!allowedHashTypes.includes(type))return null;
 const {data,error}=await supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
 if(error)throw error;
 window.history.replaceState({},document.title,`${window.location.pathname}${window.location.search}`);
 return data.session;
};

export const AuthProvider:React.FC<React.PropsWithChildren>=({children})=>{
 const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<AuthProfile|null>(null),[memberships,setMemberships]=useState<Membership[]>([]),[companies,setCompanies]=useState<Company[]>([]),[saasAccount,setSaasAccount]=useState<SaaSAccount|null>(null),[driverApplication,setDriverApplication]=useState<DriverApplication|null>(null),[partnerApplication,setPartnerApplication]=useState<PartnerApplication|null>(null),[loading,setLoading]=useState(true),[identityError,setIdentityError]=useState<string|null>(null);
 const identityRequestRef=useRef(0);
 const identityUserRef=useRef<string|null>(null);
 const sessionRef=useRef<Session|null>(null);

 const setStableSession=(nextSession:Session|null)=>{sessionRef.current=nextSession;setSession(nextSession);};
 const loadIdentity=async(nextSession:Session|null)=>{
  const requestId=++identityRequestRef.current;setStableSession(nextSession);setIdentityError(null);
  if(!nextSession){identityUserRef.current=null;setProfile(null);setMemberships([]);setCompanies([]);setSaasAccount(null);setDriverApplication(null);setPartnerApplication(null);setLoading(false);return;}
  const db=requireSupabase();setLoading(true);
  try{
   const {data:profileRow,error:profileError}=await db.from('profiles').select('id,name,phone,avatar_url,global_role,active').eq('id',nextSession.user.id).single();
   if(requestId!==identityRequestRef.current)return;if(profileError)throw profileError;if(!profileRow.active)throw new Error('Esta cuenta está suspendida. Contacta a Central GO.');
   const nextProfile:AuthProfile={id:profileRow.id,name:profileRow.name,phone:profileRow.phone,avatarUrl:profileRow.avatar_url,globalRole:profileRow.global_role,active:profileRow.active};identityUserRef.current=nextSession.user.id;setProfile(nextProfile);
   if(nextProfile.globalRole==='super_admin'){setMemberships([]);setSaasAccount(null);setDriverApplication(null);setPartnerApplication(null);const {data,error}=await db.from('companies').select('id,name,code,phone,address,vhf_frequency,logo_url,active').order('name');if(requestId!==identityRequestRef.current)return;if(error){console.warn('[Central GO] companies unavailable for superadmin',error);setCompanies([]);setIdentityError('Tu cuenta Superadmin está activa, pero no pudimos cargar las centrales. Pulsa actualizar o vuelve a intentar.');}else setCompanies((data??[]).map(mapCompany));return;}
   const {data:membershipRows,error:membershipError}=await db.from('company_memberships').select('company_id,role,active,companies(id,name,code,phone,address,vhf_frequency,logo_url,active)').eq('user_id',nextSession.user.id).eq('active',true);if(requestId!==identityRequestRef.current)return;
   let mapped:Membership[]=[];if(membershipError){if(!nextProfile.globalRole)throw membershipError;console.warn('[Central GO] memberships unavailable',membershipError);setIdentityError('Tu cuenta está activa, pero no pudimos cargar temporalmente sus accesos de central.');}else mapped=(membershipRows??[]).filter((r:any)=>r.companies).map((r:any)=>({companyId:r.company_id,role:r.role,active:r.active,company:mapCompany(Array.isArray(r.companies)?r.companies[0]:r.companies)}));setMemberships(mapped);setCompanies(mapped.map(x=>x.company));
   const {data:applicationRow,error:applicationError}=await db.from('driver_applications').select('id,company_id,status,rejection_reason,created_at,companies(name)').eq('user_id',nextSession.user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(requestId!==identityRequestRef.current)return;
   if(applicationError){console.warn('[Central GO] driver application unavailable',applicationError);setDriverApplication(null);}else if(applicationRow){const company=Array.isArray(applicationRow.companies)?applicationRow.companies[0]:applicationRow.companies;setDriverApplication({id:applicationRow.id,companyId:applicationRow.company_id,companyName:(company as any)?.name??'Central',status:applicationRow.status,rejectionReason:applicationRow.rejection_reason,createdAt:applicationRow.created_at});}else setDriverApplication(null);
   const {data:partnerApplicationRow,error:partnerApplicationError}=await db.from('partner_applications').select('id,status,country_code,region,city,eligible_review_at,rejection_reason,created_at,reviewed_at').eq('user_id',nextSession.user.id).maybeSingle();if(requestId!==identityRequestRef.current)return;
   if(partnerApplicationError){console.warn('[Central GO] partner application unavailable',partnerApplicationError);setPartnerApplication(null);}else if(partnerApplicationRow){setPartnerApplication({id:partnerApplicationRow.id,status:partnerApplicationRow.status,countryCode:partnerApplicationRow.country_code,region:partnerApplicationRow.region,city:partnerApplicationRow.city,eligibleReviewAt:partnerApplicationRow.eligible_review_at,rejectionReason:partnerApplicationRow.rejection_reason,createdAt:partnerApplicationRow.created_at,reviewedAt:partnerApplicationRow.reviewed_at});}else setPartnerApplication(null);
   const readSaas=()=>db.from('saas_accounts').select('account_kind,company_id,status,trial_started_at,trial_ends_at,current_period_end,country_code,region,city').eq('user_id',nextSession.user.id).maybeSingle();let saasResult=await readSaas();if(saasResult.error){await wait(300);if(requestId!==identityRequestRef.current)return;saasResult=await readSaas();}if(requestId!==identityRequestRef.current)return;
   if(saasResult.error){console.warn('[Central GO] saas account unavailable',saasResult.error);setSaasAccount(null);if(!nextProfile.globalRole&&mapped.length===0)setIdentityError('No pudimos validar temporalmente tu tipo de cuenta. Reintenta antes de crear una cuenta nueva.');}else{const row=saasResult.data;setSaasAccount(row?{accountKind:row.account_kind,companyId:row.company_id,status:row.status,trialStartedAt:row.trial_started_at,trialEndsAt:row.trial_ends_at,currentPeriodEnd:row.current_period_end,countryCode:row.country_code,region:row.region,city:row.city}:null);}
  }catch(error){if(requestId!==identityRequestRef.current)return;console.error('[Central GO] identity',error);identityUserRef.current=null;setIdentityError(error instanceof Error?error.message:'No fue posible cargar el perfil.');setProfile(null);setMemberships([]);setCompanies([]);setSaasAccount(null);setDriverApplication(null);setPartnerApplication(null);}finally{if(requestId===identityRequestRef.current)setLoading(false);}
 };
 const handleAuthChange=(event:AuthChangeEvent,next:Session|null)=>{if(event==='INITIAL_SESSION')return;const sameUser=Boolean(next?.user.id&&identityUserRef.current===next.user.id);if(next&&sameUser&&(event==='TOKEN_REFRESHED'||event==='SIGNED_IN'||event==='USER_UPDATED'||event==='PASSWORD_RECOVERY')){setStableSession(next);return;}if(event==='SIGNED_OUT'||!next){void loadIdentity(null);return;}void loadIdentity(next);};
 useEffect(()=>{if(!supabase){setLoading(false);return;}let mounted=true;const timers:number[]=[];const bootstrap=async()=>{try{const tokenHashSession=await consumeTokenHashLink();if(!mounted)return;if(tokenHashSession){await loadIdentity(tokenHashSession);return;}const recovered=await consumeLegacyAuthHash();if(!mounted)return;if(recovered){await loadIdentity(recovered);return;}const {data,error}=await supabase.auth.getSession();if(!mounted)return;if(error){setIdentityError(error.message);setLoading(false);return;}await loadIdentity(data.session);}catch(error){if(!mounted)return;setIdentityError(error instanceof Error?error.message:'No fue posible recuperar la sesión.');setLoading(false);}};void bootstrap();const {data:listener}=supabase.auth.onAuthStateChange((event,next)=>{const timer=window.setTimeout(()=>{if(mounted)handleAuthChange(event,next);},0);timers.push(timer);});return()=>{mounted=false;timers.forEach(window.clearTimeout);listener.subscription.unsubscribe();};},[]);
 const rememberIntent=(intent?:OnboardingRole)=>{if(typeof window==='undefined')return;if(intent)window.localStorage.setItem(ONBOARDING_INTENT_KEY,intent);else window.localStorage.removeItem(ONBOARDING_INTENT_KEY);};
 const signInWithGoogle=async(intent?:OnboardingRole)=>{rememberIntent(intent);const db=requireSupabase();const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${runtimeConfig.officialAppUrl}/`}});if(error)throw error;};
 const signUp=async(email:string,password:string,intent:OnboardingRole)=>{const normalized=email.trim().toLowerCase();if(!normalized.includes('@'))throw new Error('Ingresa un correo válido.');if(password.length<10)throw new Error('La contraseña debe tener al menos 10 caracteres.');rememberIntent(intent);const db=requireSupabase();const {data,error}=await db.auth.signUp({email:normalized,password,options:{emailRedirectTo:`${runtimeConfig.officialAppUrl}/`,data:{account_kind:intent}}});if(error)throw error;if(data.session){await loadIdentity(data.session);return true;}return false;};
 const signIn=async(email:string,password:string)=>{const db=requireSupabase();const {data,error}=await db.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;if(data.session)await loadIdentity(data.session);};
 const signOut=async()=>{const {error}=await requireSupabase().auth.signOut();if(error)throw error;};
 const updatePassword=async(password:string)=>{if(password.length<10)throw new Error('La contraseña debe tener al menos 10 caracteres.');const db=requireSupabase();const metadata={...(sessionRef.current?.user.user_metadata??{}),needs_password_setup:false,operator_invite:false};const {error}=await db.auth.updateUser({password,data:metadata});if(error)throw error;};
 const requestPasswordReset=async(email:string)=>{const normalized=email.trim().toLowerCase();if(!normalized.includes('@'))throw new Error('Ingresa un correo válido.');const db=requireSupabase();const {error}=await db.auth.resetPasswordForEmail(normalized,{redirectTo:`${runtimeConfig.officialAppUrl}/`});if(error)throw error;};
 const effectiveRole=useMemo<UserRole|null>(()=>profile?.globalRole??memberships[0]?.role??null,[profile,memberships]);
 const value=useMemo(()=>({session,authUser:session?.user??null,profile,memberships,companies,saasAccount,driverApplication,partnerApplication,effectiveRole,loading,identityError,signInWithGoogle,signUp,signIn,signOut,updatePassword,requestPasswordReset,refreshIdentity:()=>loadIdentity(sessionRef.current)}),[session,profile,memberships,companies,saasAccount,driverApplication,partnerApplication,effectiveRole,loading,identityError]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>{const c=useContext(AuthContext);if(!c)throw new Error('useAuth must be used within AuthProvider');return c;};
