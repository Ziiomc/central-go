const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));

export function exportTableToExcel(filename:string,headers:string[],rows:Array<Array<string|number|null|undefined>>){
 const table=`<table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 const html=`<html><head><meta charset="UTF-8"></head><body>${table}</body></html>`;
 const blob=new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename.endsWith('.xls')?filename:`${filename}.xls`;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}

/* Generates a printable report in a hidden iframe instead of window.open.
   This avoids popup blockers, which were the reason PDF appeared to do nothing.
   Browser print lets the operator choose "Guardar como PDF" on all supported desktops. */
export function printTableAsPdf(title:string,headers:string[],rows:Array<Array<string|number|null|undefined>>){
 const table=`<table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#111;padding:18px}h1{font-size:19px;margin:0 0 5px}p{font-size:10px;color:#666;margin:0 0 14px}table{border-collapse:collapse;width:100%;font-size:8.5px}th,td{border:1px solid #aaa;padding:5px;text-align:left;vertical-align:top;word-break:break-word}th{background:#eee}@page{size:landscape;margin:9mm}</style></head><body><h1>${escapeHtml(title)}</h1><p>Generado por Central GO · ${new Date().toLocaleString('es-CL')}</p>${table}</body></html>`;
 const frame=document.createElement('iframe');frame.style.position='fixed';frame.style.right='0';frame.style.bottom='0';frame.style.width='1px';frame.style.height='1px';frame.style.border='0';frame.style.opacity='0';frame.setAttribute('aria-hidden','true');document.body.appendChild(frame);
 const doc=frame.contentDocument;if(!doc){frame.remove();throw new Error('No fue posible preparar el informe PDF.');}doc.open();doc.write(html);doc.close();
 window.setTimeout(()=>{try{const win=frame.contentWindow;if(!win)throw new Error('No fue posible abrir el informe PDF.');win.focus();win.print();}finally{window.setTimeout(()=>frame.remove(),2000);}},250);
}
