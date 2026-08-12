const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));

export function exportTableToExcel(filename:string,headers:string[],rows:Array<Array<string|number|null|undefined>>){
 const table=`<table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 const html=`<html><head><meta charset="UTF-8"></head><body>${table}</body></html>`;
 const blob=new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename.endsWith('.xls')?filename:`${filename}.xls`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function printTableAsPdf(title:string,headers:string[],rows:Array<Array<string|number|null|undefined>>){
 const popup=window.open('','_blank','noopener,noreferrer,width=1100,height=800');if(!popup)throw new Error('El navegador bloqueó la ventana de exportación PDF. Permite ventanas emergentes para Central GO.');
 const table=`<table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#111;padding:24px}h1{font-size:20px}p{font-size:11px;color:#666}table{border-collapse:collapse;width:100%;font-size:9px}th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top}th{background:#eee} @page{size:landscape;margin:10mm}</style></head><body><h1>${escapeHtml(title)}</h1><p>Generado por Central GO · ${new Date().toLocaleString('es-CL')}</p>${table}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);popup.document.close();
}
