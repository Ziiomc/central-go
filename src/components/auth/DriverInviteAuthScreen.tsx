import React,{useEffect,useState}from'react';
import{Building2,CarFront,Loader2,ShieldCheck}from'lucide-react';
import{ONBOARDING_INTENT_KEY}from'../../context/AuthContext';
import{buildDriverInviteUrl,rememberDriverInviteToken,resolveDriverInvite,type DriverInviteTarget}from'../../lib/driverInvite';
import{googleOAuthOptions}from'../../lib/googleOAuth';
import{createPasswordAccountWithoutEmail,signInWithCompatiblePassword}from'../../lib/passwordAuth';
import{requireSupabase}from'../../lib/supabase';
import{friendlyAuthError,validateAuthPassword}from'../../lib/authPasswordPolicy';
import{AuthShell}from'./AuthShell';
import{PasswordRequirements}from'./PasswordRequirements';

export const DriverInviteAuthScreen:React.FC<{inviteCode:string}>=({inviteCode})=>{
 const[mode,setMode]=useState<'register'|'login'>('register');
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const[busy,setBusy]=useState(false),[checking,setChecking]=useState(true),[error,setError]=useState('');
 const[target,setTarget]=useState<DriverInviteTarget|null>(null);

 useEffect(()=>{rememberDriverInviteToken(inviteCode);window.localStorage.setItem(ONBOARDING_INTENT_KEY,'driver');let active=true;void resolveDriverInvite(inviteCode).then(result=>{if(!active)return;if(!result)throw new Error('Este enlace de invitación ya no está activo.');setTarget(result);}).catch(err=>{if(active)setError(friendlyAuthError(err,'No fue posible validar la invitación.'));}).finally(()=>{if(active)setChecking(false);});return()=>{active=false;};},[inviteCode]);

 const redirectUrl=()=>buildDriverInviteUrl(inviteCode);
 const prepareDriverIntent=()=>{rememberDriverInviteToken(inviteCode);window.localStorage.setItem(ONBOARDING_INTENT_KEY,'driver');};

 const google=async()=>{if(!target||busy)return;setBusy(true);setError('');try{prepareDriverIntent();const{error:oauthError}=await requireSupabase().auth.signInWithOAuth({provider:'google',options:googleOAuthOptions(redirectUrl())});if(oauthError)throw oauthError;}catch(err){setError(friendlyAuthError(err,'No fue posible continuar con Google.'));setBusy(false);}};

 const submit=async(event:React.FormEvent)=>{event.preventDefault();if(!target||busy)return;setBusy(true);setError('');try{const normalized=email.trim().toLowerCase();if(!normalized.includes('@'))throw new Error('Ingresa un correo válido.');prepareDriverIntent();if(mode==='register'){const passwordError=validateAuthPassword(password);if(passwordError)throw new Error(passwordError);if(password!==confirm)throw new Error('Las contraseñas no coinciden.');await createPasswordAccountWithoutEmail(normalized,password,'driver');}const{data}=await signInWithCompatiblePassword(normalized,password);if(!data.session)throw new Error('No fue posible iniciar la sesión.');window.location.assign(redirectUrl());}catch(err){setError(friendlyAuthError(err,mode==='register'?'No fue posible crear tu cuenta.':'No fue posible iniciar sesión.'));setBusy(false);}};

 const changeMode=(next:'register'|'login')=>{setMode(next);setError('');setPassword('');setConfirm('');};

 return <AuthShell compact eyebrow="Invitación privada de una central" title="Comienza como conductor">
  <div className="flex items-center gap-3"><span className="cg-role-icon h-12 w-12"><CarFront className="h-6 w-6"/></span><div><p className="cg-card-kicker">Central GO · Alta directa</p><h1 className="cg-card-title text-2xl">Únete como conductor</h1></div></div>
  <div className="mt-4 rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-4">{checking?<p className="flex items-center gap-2 text-xs font-black text-[var(--cg-text)]"><Loader2 className="h-4 w-4 animate-spin"/>Validando invitación privada…</p>:target?<><p className="flex items-center gap-2 text-sm font-black text-[var(--cg-text)]"><Building2 className="h-4 w-4 text-[var(--cg-primary)]"/>{target.companyName}</p><p className="mt-1 text-[11px] leading-relaxed text-[var(--cg-muted)]">Esta central ya autorizó tu ingreso. Crea tu acceso con correo y una contraseña sencilla; no necesitas confirmar ningún correo.</p><p className="mt-2 flex items-center gap-1.5 text-[11px] font-black text-emerald-400"><ShieldCheck className="h-4 w-4"/>No necesitas subir cédula, licencia ni documentación de postulación.</p></>:null}</div>
  {error&&<div className="cg-alert cg-alert-error">{error}</div>}
  <div className="cg-segmented" role="tablist"><button type="button" data-active={mode==='register'} onClick={()=>changeMode('register')}>Crear cuenta</button><button type="button" data-active={mode==='login'} onClick={()=>changeMode('login')}>Ya tengo cuenta</button></div>
  <button type="button" disabled={busy||checking||!target} onClick={()=>void google()} className="cg-google-button"><span className="cg-google-mark" aria-hidden="true">G</span>{busy?'Conectando…':'Continuar con Google'}</button>
  <div className="cg-divider">o usa correo y contraseña</div>
  <form onSubmit={submit} className="cg-form">
   <label className="cg-field"><span>Correo electrónico</span><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"/></label>
   <label className="cg-field"><span>Contraseña</span><input required minLength={mode==='register'?8:undefined} type="password" autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='register'?'Mínimo 8 caracteres':'Tu contraseña'}/></label>
   {mode==='register'&&<PasswordRequirements password={password}/>} 
   {mode==='register'&&<label className="cg-field"><span>Repetir contraseña</span><input required minLength={8} type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repite tu contraseña"/></label>}
   <button disabled={busy||checking||!target} className="cg-primary-button">{busy&&<Loader2 className="h-4 w-4 animate-spin"/>}{busy?'Procesando…':mode==='register'?'Crear cuenta y entrar a la central':'Entrar a la central'}</button>
  </form>
  <p className="cg-auth-hint">Contraseña simple: 8 caracteres mínimo. No enviamos enlaces de confirmación ni de acceso por correo.</p>
 </AuthShell>;
};
