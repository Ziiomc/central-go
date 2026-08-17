import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/docs/manual-central-go-centrales.pdf');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const W = 595.28, H = 841.89;
const C = {
  navy:[0.02,0.09,0.15], navy2:[0.04,0.15,0.28], blue:[0.08,0.59,1], cyan:[0.39,0.85,1],
  ink:[0.07,0.16,0.23], muted:[0.40,0.47,0.54], light:[0.96,0.98,0.99], pale:[0.92,0.97,1],
  line:[0.84,0.89,0.94], white:[1,1,1], green:[0.09,0.72,0.47], amber:[0.95,0.70,0.20], red:[0.91,0.33,0.41]
};
const fmt=n=>Number(n).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
const rgb=c=>`${fmt(c[0])} ${fmt(c[1])} ${fmt(c[2])}`;
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const latin=s=>Buffer.from(String(s).replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'"), 'latin1').toString('latin1');

function wrap(text, max=76){
  const words=latin(text).split(/\s+/); const lines=[]; let line='';
  for(const w of words){ const next=line?`${line} ${w}`:w; if(next.length>max&&line){lines.push(line);line=w;} else line=next; }
  if(line)lines.push(line); return lines;
}
function textCmd(x,y,text,size=10,font='F1',color=C.ink){return `BT /${font} ${fmt(size)} Tf ${rgb(color)} rg 1 0 0 1 ${fmt(x)} ${fmt(y)} Tm (${esc(latin(text))}) Tj ET\n`;}
function rectCmd(x,y,w,h,fill,stroke=null,lw=.6){let s=`${rgb(fill)} rg ${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re f\n`;if(stroke)s+=`${rgb(stroke)} RG ${fmt(lw)} w ${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re S\n`;return s;}
function lineCmd(x1,y1,x2,y2,color=C.line,lw=.6){return `${rgb(color)} RG ${fmt(lw)} w ${fmt(x1)} ${fmt(y1)} m ${fmt(x2)} ${fmt(y2)} l S\n`;}
function paragraph(page,x,y,text,{size=9.4,leading=14,font='F1',color=C.ink,max=84}={}){const lines=wrap(text,max);for(const l of lines){page.push(textCmd(x,y,l,size,font,color));y-=leading;}return y;}
function heading(page,n,title){page.push(textCmd(48,H-76,`${n}. ${title}`,18,'F2',C.navy2));page.push(lineCmd(48,H-86,W-48,H-86,C.line,1));return H-112;}
function card(page,x,y,w,title,body,tone=C.pale){const lines=wrap(body,48);const h=40+lines.length*12;page.push(rectCmd(x,y-h,w,h,tone,C.line,.6));page.push(textCmd(x+10,y-18,title,10,'F2',C.navy2));let yy=y-34;for(const l of lines){page.push(textCmd(x+10,yy,l,8.4,'F1',C.ink));yy-=12;}return h;}
function step(page,y,n,title,body,color=C.blue){const lines=wrap(body,78);const h=34+lines.length*12;page.push(rectCmd(48,y-h,34,h,color));page.push(textCmd(58,y-22,String(n).padStart(2,'0'),10,'F2',C.white));page.push(rectCmd(82,y-h,W-130,h,C.light,C.line,.6));page.push(textCmd(94,y-18,title,9.5,'F2',C.navy2));let yy=y-34;for(const l of lines){page.push(textCmd(94,yy,l,8.5,'F1',C.ink));yy-=12;}return y-h-8;}
function addHeaderFooter(page,idx){page.push(rectCmd(0,H-40,W,40,C.navy));page.push(textCmd(24,H-25,'CENTRAL GO',9,'F2',C.white));page.push(textCmd(W-170,H-25,'Manual para centrales',7.5,'F1',C.white));page.push(lineCmd(48,35,W-48,35,C.line,.5));page.push(textCmd(48,20,'Operacion - despacho - flota - reportes',7,'F1',C.muted));page.push(textCmd(W-55,20,String(idx),7,'F1',C.muted));}

const pages=[];
{
 const p=[]; p.push(rectCmd(0,0,W,H,C.navy)); p.push(rectCmd(W-235,H-310,235,235,C.navy2));
 p.push(textCmd(48,H-150,'MANUAL DE USO',10,'F2',C.cyan));
 p.push(textCmd(48,H-190,'Central GO',28,'F2',C.white)); p.push(textCmd(48,H-225,'para Centrales de Taxi',28,'F2',C.white));
 let y=H-265; y=paragraph(p,48,y,'Guia visual y profesional para configurar la central, administrar la flota, despachar carreras, supervisar conductores y revisar la operacion diaria.',{size:11,leading:17,color:[0.72,0.90,1],max:60});
 p.push(rectCmd(W-190,H-265,120,120,[0.03,0.10,0.20],C.blue,.8));
 p.push(rectCmd(W-170,H-240,80,32,C.blue)); p.push(rectCmd(W-155,H-214,50,22,C.cyan));
 p.push(rectCmd(48,H-365,360,54,[0.08,0.23,0.40],[0.18,0.42,0.65],.7));
 paragraph(p,62,H-338,'Tu objetivo: operar la central con mas orden, control, trazabilidad y rapidez, sin perder el rol de la operadora.',{size:9.2,leading:13,color:C.white,max:74});
 paragraph(p,48,170,'Central GO conecta la central, sus operadoras, conductores, vehiculos y clientes dentro de una plataforma SaaS multiempresa con despacho digital, GPS, historial y analitica.',{size:8.4,leading:13,color:C.white,max:90});
 p.push(textCmd(48,55,'Edicion profesional 2026',7.5,'F1',C.muted)); pages.push(p);
}
{
 const p=[]; addHeaderFooter(p,2); let y=heading(p,1,'Que es Central GO');
 y=paragraph(p,48,y,'Central GO es una plataforma de gestion y despacho para centrales de taxi. Moderniza la coordinacion entre la central, sus operadoras y los conductores, manteniendo cada empresa separada y protegida por roles.',{max:92}); y-=10;
 const h1=card(p,48,y,238,'Despacho inteligente','Crea carreras, asigna moviles manualmente y utiliza automatismos disponibles para agilizar la operacion.');
 const h2=card(p,309,y,238,'GPS y mapa en tiempo real','Visualiza la ubicacion reportada por los moviles y toma mejores decisiones de asignacion.'); y-=Math.max(h1,h2)+14;
 const h3=card(p,48,y,238,'PWA del conductor','El conductor recibe carreras, cambia estados, comparte ubicacion y usa herramientas como SOS desde su telefono.');
 const h4=card(p,309,y,238,'Historial y analitica','Cada operacion queda registrada y puede revisarse con metricas, graficos y exportaciones.'); y-=Math.max(h3,h4)+18;
 p.push(rectCmd(48,y-55,W-96,55,C.navy2)); paragraph(p,62,y-22,'Central GO no reemplaza a la operadora: la fortalece con visibilidad, trazabilidad y herramientas modernas.',{size:9.2,leading:14,color:C.white,max:86}); pages.push(p);
}
{
 const p=[]; addHeaderFooter(p,3); let y=heading(p,2,'Puesta en marcha de la central');
 y=paragraph(p,48,y,'Antes de iniciar el turno revisa esta secuencia. Reduce errores y asegura que toda la cadena operativa funcione correctamente.',{max:90}); y-=8;
 const items=[['Configura la central','Revisa datos generales, usuarios, permisos y ajustes esenciales.'],['Revisa conductores','Comprueba que los choferes del turno esten incorporados y aprobados.'],['Registra vehiculos','Verifica que cada movil este correctamente asociado a la flota.'],['Valida la PWA','Cada conductor debe poder iniciar sesion y quedar disponible.'],['Comprueba el GPS','Asegurate de que los moviles aparezcan con ubicacion reciente.'],['Crea una carrera de prueba','Registra cliente, origen y destino para validar el flujo.'],['Despacha y completa','Asigna el movil, cambia estados y finaliza correctamente la carrera.']];
 let n=1; for(const [t,b] of items){y=step(p,y,n++,t,b,C.blue);} pages.push(p);
}
{
 const p=[]; addHeaderFooter(p,4); let y=heading(p,3,'Consola de despacho de la operadora');
 y=paragraph(p,48,y,'La consola concentra el trabajo diario. Desde aqui se crean carreras, se revisa la cola de despacho, se supervisan moviles y se consulta el mapa.',{max:92}); y-=10;
 const cards=[['Nueva carrera','Abre el formulario para registrar una solicitud nueva.'],['Buscador global','Encuentra carrera, cliente, telefono, calle o numero de movil.'],['Cola de despacho','Muestra carreras pendientes, asignadas, en camino, en llegada o en curso.'],['Moviles libres y en servicio','Resume la disponibilidad actual de la flota.'],['Ubicar','Centra el mapa en el conductor seleccionado.'],['Actualizar','Refresca la vista operativa y ayuda a sincronizar la supervision visual.']];
 for(let i=0;i<cards.length;i+=2){const a=card(p,48,y,238,cards[i][0],cards[i][1]);const b=card(p,309,y,238,cards[i+1][0],cards[i+1][1]);y-=Math.max(a,b)+12;}
 y-=8; p.push(textCmd(48,y,'Buenas practicas',11,'F2',C.blue)); y-=18;
 for(const t of ['Usa el buscador para actuar rapido sobre una carrera o movil.','Manten la cola ordenada y evita dejar carreras antiguas pendientes.','Verifica los estados antes de cancelar, desasignar o reasignar.']){p.push(textCmd(58,y,'- '+t,8.8,'F1',C.ink));y-=18;} pages.push(p);
}
{
 const p=[]; addHeaderFooter(p,5); let y=heading(p,4,'Flujo correcto de una carrera');
 y=paragraph(p,48,y,'Cada carrera debe avanzar por estados. Esto mantiene a la central informada y alimenta correctamente los reportes.',{max:90}); y-=8;
 const flow=[['Registrar','Ingresa cliente, telefono, origen, destino y observaciones.'],['Asignar','Selecciona un movil o utiliza la asignacion disponible.'],['En camino','El conductor acepta y se dirige al pasajero.'],['Llegada','El movil ya esta en el punto de recogida.'],['En viaje','El pasajero esta a bordo y la carrera comenzo.'],['Finalizar','Cierra la carrera para que quede contabilizada.']]; const cols=[C.navy2,C.blue,C.amber,C.amber,C.red,C.green];
 let n=1; for(let i=0;i<flow.length;i++)y=step(p,y,n++,flow[i][0],flow[i][1],cols[i]);
 p.push(rectCmd(48,y-54,W-96,54,[0.08,0.23,0.40])); paragraph(p,62,y-20,'Si algo falla: desasigna para quitar el movil y volver a ofrecer la carrera; cancela cuando el servicio ya no continuara. Siempre deja una razon clara.',{size:8.8,leading:13,color:C.white,max:90}); pages.push(p);
}
{
 const p=[]; addHeaderFooter(p,6); let y=heading(p,5,'Conductores, vehiculos y acceso');
 y=paragraph(p,48,y,'Central GO separa la administracion de personas y moviles para mantener control documental, operativo y de seguridad.',{max:90}); y-=10;
 const cs=[['Conductores','Incorpora choferes y controla estados: disponible, en camino, en carrera, pausado, fuera de linea o SOS.'],['Vehiculos','Manten la flota registrada y correctamente asociada a cada unidad operativa.'],['Solicitudes de incorporacion','La central puede revisar solicitudes antes de aprobar nuevos conductores.'],['Acceso del conductor','La PWA permite recibir carreras, compartir GPS y operar desde el telefono.']];
 for(let i=0;i<cs.length;i+=2){const a=card(p,48,y,238,cs[i][0],cs[i][1]);const b=card(p,309,y,238,cs[i+1][0],cs[i+1][1]);y-=Math.max(a,b)+14;}
 p.push(rectCmd(48,y-60,W-96,60,C.navy2)); paragraph(p,62,y-22,'Regla de seguridad: ningun conductor deberia operar sin validacion previa de identidad, documentacion y vinculo con el vehiculo.',{size:9,leading:14,color:C.white,max:88}); pages.push(p);
}
{
 const p=[]; addHeaderFooter(p,7); let y=heading(p,6,'Mapa, GPS, radio y seguridad');
 y=paragraph(p,48,y,'Estas herramientas entregan visibilidad sobre la flota y ayudan a resolver la operacion con mayor rapidez.',{max:90}); y-=10;
 const cs=[['GPS en tiempo real','Muestra la ubicacion reciente del movil. Una actualizacion atrasada puede indicar senal debil o falta de conexion.'],['Ubicar movil','Selecciona un conductor para enfocarlo en el mapa y facilitar decisiones de despacho.'],['Radio digital','Complementa la comunicacion de la central sin eliminar el control de la operadora.'],['SOS','Un conductor en estado SOS debe tratarse como prioridad maxima y activar el protocolo interno.']];
 for(let i=0;i<cs.length;i+=2){const a=card(p,48,y,238,cs[i][0],cs[i][1]);const b=card(p,309,y,238,cs[i+1][0],cs[i+1][1]);y-=Math.max(a,b)+14;}
 p.push(textCmd(48,y-4,'Si un movil aparece sin senal',11,'F2',C.blue)); y-=26;
 for(const t of ['Comprueba conexion de datos.','Revisa permisos de ubicacion.','Confirma que la PWA tenga sesion activa.','Revisa restricciones de bateria y segundo plano.']){p.push(textCmd(58,y,'- '+t,8.8,'F1',C.ink));y-=18;} pages.push(p);
}
{
 const p=[]; addHeaderFooter(p,8); let y=heading(p,7,'Clientes, tarifas, usuarios y configuracion');
 y=paragraph(p,48,y,'Una administracion limpia evita errores en el despacho y mejora la continuidad operativa.',{max:90}); y-=10;
 const cs=[['Clientes','Conserva la informacion necesaria para identificar solicitudes habituales.'],['Tarifas','Asegura que los valores usados por la central esten actualizados.'],['Usuarios y roles','Entrega a cada persona solo los permisos que necesita. Evita compartir cuentas.'],['Operadores','Gestiona al personal de despacho y sus accesos.'],['Configuracion general','Revisa los datos base de la central y preferencias disponibles.'],['Historial','Consulta carreras previas para resolver dudas o reclamos.']];
 for(let i=0;i<cs.length;i+=2){const a=card(p,48,y,238,cs[i][0],cs[i][1]);const b=card(p,309,y,238,cs[i+1][0],cs[i+1][1]);y-=Math.max(a,b)+12;} pages.push(p);
}
{
 const p=[]; addHeaderFooter(p,9); let y=heading(p,8,'Analitica, exportaciones y revision del turno');
 y=paragraph(p,48,y,'Selecciona un rango horario exacto y revisa el comportamiento de la operacion con metricas y graficos.',{max:90}); y-=10;
 const cs=[['Carreras','Total de operaciones dentro del periodo.'],['Completadas','Viajes cerrados correctamente.'],['Efectividad','Relacion entre operaciones completadas y oportunidades disponibles.'],['Facturacion','Suma de montos de carreras completadas.'],['Conduccion','Tiempo acumulado efectivamente en viaje.'],['Conexion','Tiempo en linea reportado por conductores.'],['Llamadas','Pedidos, consultas, cancelaciones o reclamos.'],['Rendimiento','Carreras, rechazos, km, tiempo y montos por movil.']];
 for(let i=0;i<cs.length;i+=2){const a=card(p,48,y,238,cs[i][0],cs[i][1]);const b=card(p,309,y,238,cs[i+1][0],cs[i+1][1]);y-=Math.max(a,b)+10;}
 p.push(textCmd(48,y-3,'Exportaciones',11,'F2',C.blue)); paragraph(p,48,y-25,'Central GO permite exportar a Excel y generar un PDF con graficas. Define correctamente Desde y Hasta para que el documento refleje solo la franja deseada.',{size:8.8,leading:13,max:92}); pages.push(p);
}
{
 const p=[]; addHeaderFooter(p,10); let y=heading(p,9,'Solucion rapida y checklist diario');
 const probs=[['El conductor no recibe la carrera','Verifica conexion, disponibilidad, sesion y notificaciones.'],['No aparece en el mapa','Revisa GPS, permisos, datos y segundo plano.'],['Una carrera quedo trabada','Revisa el estado antes de desasignar, cancelar o duplicar.'],['No llegan notificaciones','Comprueba permisos, conexion, bateria y sonido.'],['Las metricas no cuadran','Revisa el horario y confirma que las carreras esten cerradas.'],['Error persistente','Registra evidencia y escala con todos los antecedentes.']];
 for(let i=0;i<probs.length;i+=2){const a=card(p,48,y,238,probs[i][0],probs[i][1],[1,.97,.91]);const b=card(p,309,y,238,probs[i+1][0],probs[i+1][1],[1,.97,.91]);y-=Math.max(a,b)+10;}
 y-=4;p.push(textCmd(48,y,'Checklist diario',11,'F2',C.blue));y-=22;
 const checks=['Operadoras con acceso correcto.','Conductores registrados y aprobados.','Vehiculos correctamente asociados.','GPS actualizado en moviles activos.','Notificaciones y sonido habilitados.','Se puede crear una carrera de prueba.','Asignacion y cambios de estado responden.','No hay carreras antiguas abiertas.','Al cierre, revisar analitica y exportar el turno.'];
 let i=1;for(const t of checks){p.push(textCmd(58,y,`${String(i++).padStart(2,'0')}  ${t}`,8.6,'F1',C.ink));y-=17;}
 pages.push(p);
}

const objects=[];
objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
const kids=[]; let id=5;
for(const cmds of pages){
  const contentId=id++; const pageId=id++; kids.push(`${pageId} 0 R`);
  const stream=latin(cmds.join(''));
  objects[contentId]=`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`;
  objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
}
objects[2]=`<< /Type /Pages /Count ${pages.length} /Kids [ ${kids.join(' ')} ] >>`;

let chunks=[Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n','latin1')];
const offsets=[0];
for(let i=1;i<objects.length;i++){
  offsets[i]=Buffer.concat(chunks).length;
  chunks.push(Buffer.from(`${i} 0 obj\n${objects[i]}\nendobj\n`,'latin1'));
}
const xref=Buffer.concat(chunks).length;
let xr=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
for(let i=1;i<objects.length;i++)xr+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
xr+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
chunks.push(Buffer.from(xr,'latin1'));
fs.writeFileSync(OUT,Buffer.concat(chunks));
console.log(`Generated ${OUT} (${fs.statSync(OUT).size} bytes)`);
