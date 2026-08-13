import{requireSupabase}from'./supabase';

const validate=(file:File)=>{if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Usa una imagen JPG, PNG o WebP.');if(file.size>5*1024*1024)throw new Error('La imagen no puede superar 5 MB.');};
const extension=(file:File)=>file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
const upload=async(path:string,file:File)=>{validate(file);const db=requireSupabase();const{error}=await db.storage.from('profile-images').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});if(error)throw error;const{data}=db.storage.from('profile-images').getPublicUrl(path);return`${data.publicUrl}?v=${Date.now()}`;};

export async function uploadOwnAvatar(userId:string,file:File){const url=await upload(`users/${userId}/avatar.${extension(file)}`,file);const{error}=await requireSupabase().rpc('centralgo_update_own_avatar',{p_url:url});if(error)throw error;return url;}
export async function uploadCompanyLogo(companyId:string,file:File){const url=await upload(`companies/${companyId}/logo.${extension(file)}`,file);const{error}=await requireSupabase().rpc('centralgo_update_company_logo',{p_company_id:companyId,p_url:url});if(error)throw error;return url;}
