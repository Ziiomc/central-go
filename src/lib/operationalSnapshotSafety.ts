import { requireSupabase } from './supabase';

const SNAPSHOT_PREFIX='centralgo:operational-snapshot:v1:';
const LAST_USER_KEY='centralgo:operational-snapshot:last-user';
let registered=false;

const purgeOperationalSnapshots=()=>{
  try{
    const keys:string[]=[];
    for(let index=0;index<localStorage.length;index+=1){
      const key=localStorage.key(index);
      if(key?.startsWith(SNAPSHOT_PREFIX))keys.push(key);
    }
    keys.forEach(key=>localStorage.removeItem(key));
  }catch{/* Private mode or blocked storage: nothing persistent to purge. */}
};

const rememberUser=(userId:string|null|undefined)=>{
  try{
    const previous=localStorage.getItem(LAST_USER_KEY);
    const next=userId||'';
    // Never reuse an operational snapshot created by another authenticated user.
    if(previous!==null&&previous!==next)purgeOperationalSnapshots();
    if(next)localStorage.setItem(LAST_USER_KEY,next);
    else localStorage.removeItem(LAST_USER_KEY);
  }catch{/* Session remains protected by Supabase/RLS even without local storage. */}
};

/**
 * Operational snapshots exist only to make brief reconnects feel instant. They
 * must never survive an account change on a shared dispatch computer.
 */
export const registerOperationalSnapshotSafety=()=>{
  if(registered||typeof window==='undefined')return;
  registered=true;
  const db=requireSupabase();

  void db.auth.getSession().then(({data})=>rememberUser(data.session?.user.id)).catch(()=>undefined);
  db.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'){
      purgeOperationalSnapshots();
      rememberUser(null);
      return;
    }
    if(event==='SIGNED_IN'||event==='USER_UPDATED')rememberUser(session?.user.id);
  });
};
