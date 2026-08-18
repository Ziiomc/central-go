import React,{useEffect,useState}from'react';
import{createPortal}from'react-dom';
import{LayoutGrid,List}from'lucide-react';

type ViewMode='cards'|'list';
type CollectionKind='drivers'|'vehicles';
type MountContext={kind:CollectionKind;mount:HTMLElement;grid:HTMLElement};

const storageKey=(kind:CollectionKind)=>`centralgo:${kind}:view-mode`;
const readPreference=(kind:CollectionKind):ViewMode=>{
 try{const saved=localStorage.getItem(storageKey(kind));if(saved==='cards'||saved==='list')return saved;}catch{}
 return window.innerWidth>=900?'list':'cards';
};

export const CollectionViewModeControls:React.FC=()=>{
 const[context,setContext]=useState<MountContext|null>(null);
 const[mode,setMode]=useState<ViewMode>('list');

 useEffect(()=>{
  let currentMount:HTMLElement|null=null;
  let currentGrid:HTMLElement|null=null;
  const scan=()=>{
   const driverInput=document.querySelector<HTMLInputElement>('input[placeholder^="Nombre, móvil"]');
   const vehicleInput=document.querySelector<HTMLInputElement>('input[placeholder^="Buscar por móvil"]');
   const input=driverInput??vehicleInput;
   const kind:CollectionKind|undefined=driverInput?'drivers':vehicleInput?'vehicles':undefined;
   if(!input||!kind){
    if(currentGrid){currentGrid.classList.remove('cg-collection-grid','cg-drivers-collection','cg-vehicles-collection');delete currentGrid.dataset.view;currentGrid=null;}
    if(currentMount){currentMount.remove();currentMount=null;}
    setContext(null);return;
   }
   const toolbar=input.parentElement?.parentElement as HTMLElement|null;
   const grid=toolbar?.nextElementSibling as HTMLElement|null;
   if(!toolbar||!grid)return;
   if(currentGrid===grid&&currentMount?.isConnected)return;
   if(currentGrid&&currentGrid!==grid){currentGrid.classList.remove('cg-collection-grid','cg-drivers-collection','cg-vehicles-collection');delete currentGrid.dataset.view;}
   if(currentMount&&currentMount.parentElement!==toolbar)currentMount.remove();
   toolbar.classList.add('cg-collection-toolbar');
   grid.classList.add('cg-collection-grid',kind==='drivers'?'cg-drivers-collection':'cg-vehicles-collection');
   let mount=toolbar.querySelector<HTMLElement>('[data-centralgo-collection-view="1"]');
   if(!mount){mount=document.createElement('div');mount.dataset.centralgoCollectionView='1';mount.className='shrink-0';toolbar.appendChild(mount);}
   currentMount=mount;currentGrid=grid;
   const preference=readPreference(kind);grid.dataset.view=preference;setMode(preference);setContext({kind,mount,grid});
  };
  scan();
  const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});
  return()=>{observer.disconnect();if(currentGrid){currentGrid.classList.remove('cg-collection-grid','cg-drivers-collection','cg-vehicles-collection');delete currentGrid.dataset.view;}if(currentMount)currentMount.remove();};
 },[]);

 const choose=(next:ViewMode)=>{
  if(!context)return;setMode(next);context.grid.dataset.view=next;
  try{localStorage.setItem(storageKey(context.kind),next);}catch{}
 };
 if(!context)return null;
 return createPortal(<div className="cg-view-switch" role="group" aria-label="Cambiar vista">
  <span className="cg-view-switch-label">Vista</span>
  <button type="button" onClick={()=>choose('list')} className={mode==='list'?'is-active':''} aria-pressed={mode==='list'} title="Vista lista"><List className="h-3.5 w-3.5"/><span>Lista</span></button>
  <button type="button" onClick={()=>choose('cards')} className={mode==='cards'?'is-active':''} aria-pressed={mode==='cards'} title="Vista tarjetas"><LayoutGrid className="h-3.5 w-3.5"/><span>Tarjetas</span></button>
 </div>,context.mount);
};
