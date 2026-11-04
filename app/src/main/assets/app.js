'use strict';
const CATS=[['super','Súper','🛒'],['comida','Comida','🍽️'],['transporte','Transporte','🚌'],['alojamiento','Alojamiento','🛏️'],['hogar','Hogar','🏠'],['salud','Salud','💊'],['ocio','Ocio','🎟️'],['ropa','Ropa','👕'],['otro','Otro','📦']];
const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clp=n=>(n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const fdate=s=>{const[y,m,d]=s.split('-');return `${+d} ${MES[m-1]} ${y}`};
const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const cat=id=>CATS.find(c=>c[0]===id)||CATS[8];
const parseN=v=>{const n=parseInt(String(v).replace(/[^\d-]/g,''),10);return isNaN(n)?0:n};

/* --- almacenamiento --- */
let db,S={expenses:[],trips:[],loans:[],people:[]};
const open=()=>new Promise((ok,no)=>{const r=indexedDB.open('boleta',1);r.onupgradeneeded=()=>{r.result.createObjectStore('kv');r.result.createObjectStore('photos')};r.onsuccess=()=>{db=r.result;ok()};r.onerror=()=>no(r.error)});
const tx=(st,m,f)=>new Promise((ok,no)=>{const t=db.transaction(st,m),r=f(t.objectStore(st));t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>no(t.error)});
const save=()=>tx('kv','readwrite',s=>s.put(S,'state'));
const putPhoto=(id,d)=>tx('photos','readwrite',s=>s.put(d,id));
const getPhoto=id=>tx('photos','readonly',s=>s.get(id));
const delPhoto=id=>tx('photos','readwrite',s=>s.delete(id));

/* --- cálculo: cuánto corresponde a cada persona en un gasto --- */
function shares(e){
  const r={}; const add=(p,v)=>r[p]=(r[p]||0)+v;
  const group=['Yo',...(e.split||[])];
  let rest=e.total;
  const dist=v=>{const u=Math.floor(v/group.length);let x=v-u*group.length;group.forEach(p=>{add(p,u+(x>0?1:0));x--})};
  (e.items||[]).forEach(i=>{rest-=i.price;i.owner==='shared'?dist(i.price):add(i.owner,i.price)});
  if(rest>0)dist(rest);
  return r;
}
const mine=e=>shares(e).Yo||0;
/* >0 esa persona me debe; <0 yo le debo */
function balances(list=S.expenses,loans=S.loans){
  const b={};const add=(p,v)=>b[p]=(b[p]||0)+v;
  list.forEach(e=>{const s=shares(e);
    if(e.payer==='Yo')Object.keys(s).forEach(p=>{if(p!=='Yo')add(p,s[p])});
    else if(s.Yo)add(e.payer,-s.Yo)});
  loans.forEach(l=>add(l.person,l.dir==='me'?l.amount:-l.amount));
  return b;
}
const tripOf=e=>S.trips.find(t=>e.date>=t.start&&e.date<=t.end);
const sum=(a,f)=>a.reduce((x,y)=>x+f(y),0);
const byDate=a=>[...a].sort((x,y)=>y.date.localeCompare(x.date)||(y.id>x.id?1:-1));
const addPeople=l=>l.forEach(p=>{if(p&&p!=='Yo'&&!S.people.includes(p))S.people.push(p)});

/* --- navegación --- */
let stack=[{v:'home'}],month=today().slice(0,7),metric='mes',draft=null;
const cur=()=>stack[stack.length-1];
const go=(v,a={})=>{stack.push({v,...a});scrollTo(0,0);render()};
const tab=v=>{stack=[{v}];scrollTo(0,0);render()};
window.appBack=()=>{const w=$('.view');if(w){w.remove();return true}if(stack.length>1){stack.pop();draft=null;render();return true}if(cur().v!=='home'){tab('home');return true}return false};
const toast=m=>{const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),2200)};

const head=(t,right='')=>`<header>${stack.length>1?'<button class="back" data-a="back" aria-label="Volver">←</button>':''}<h1>${esc(t)}</h1>${right}</header>`;
const navbar=()=>{const v=stack[0].v;return `<button class="fab" data-a="new" aria-label="Nuevo gasto">+</button><nav>${[['home','🧾','Gastos'],['trips','🧳','Viajes'],['debts','🤝','Deudas'],['stats','📊','Métricas']].map(n=>`<button class="${v===n[0]?'on':''}" data-tab="${n[0]}"><span>${n[1]}</span>${n[2]}</button>`).join('')}</nav>`};
function expRow(e){const m=mine(e),o=e.total!==m||e.payer!=='Yo',b=e.payer!=='Yo'?`pagó ${esc(e.payer)}`:(e.split||[]).length?`con ${e.split.map(esc).join(', ')}`:'';
  return `<button class="row" data-e="${e.id}"><span class="ico">${cat(e.cat)[2]}</span><span class="grow">${esc(e.title)}${e.photos?.length?' 📷':''}<br><span class="sm">${cat(e.cat)[1]}${b?' · '+b:''}</span></span><span class="num" style="text-align:right">${clp(e.total)}${o?`<br><span class="sm">tuyo ${clp(m)}</span>`:''}</span></button>`}
function dayList(list){if(!list.length)return '<div class="empty">Sin gastos todavía.<br>Toca + para agregar el primero.</div>';
  let h='',d='';byDate(list).forEach(e=>{if(e.date!==d){if(d)h+='</div>';d=e.date;h+=`<h2>${fdate(d)} · <span class="num">${clp(sum(list.filter(x=>x.date===d),mine))}</span></h2><div class="card" style="padding:2px 14px;margin-top:4px">`}h+=expRow(e)});return h+'</div>'}
const shiftM=(m,k)=>{let[y,n]=m.split('-').map(Number);n+=k;while(n<1){n+=12;y--}while(n>12){n-=12;y++}return `${y}-${pad(n)}`};
const mLabel=m=>`${MES[+m.slice(5)-1]} ${m.slice(0,4)}`;
const monthPick=()=>`<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><button class="btn" data-m="-1">‹</button><b style="flex:1;text-align:center">${mLabel(month)}</b><button class="btn" data-m="1">›</button></div>`;

window.onOcr=(lines,err)=>{if(cur().v!=='form'||!draft)return;if(err||!lines.length)return toast('No se pudo leer. Prueba con más luz y la boleta plana.');
  const r=OCR.parse(lines,today()),d=draft;if(!d.title.trim()&&r.title)d.title=r.title;if(!parseN(d.total)&&r.total)d.total=r.total;if(r.date)d.date=r.date;if(r.cat)d.cat=r.cat;
  if(r.items.length&&(!d.items.length||confirm('¿Reemplazar el detalle actual por el leído?')))d.items=r.items;
  render();const s=sum(d.items,i=>i.price),t=parseN(d.total);toast(!r.items.length?'Sin ítems detectados: revisa los datos':s!==t?`Revisa: el detalle suma ${clp(s)} y el total es ${clp(t)}`:'Boleta leída. Revisa los datos')};
/* --- pantallas --- */
const V={
home(){const l=S.expenses.filter(e=>e.date.startsWith(month)),t=today(),act=S.trips.find(x=>t>=x.start&&t<=x.end);
  return head('Gastos')+`<main>${act?`<button class="row card" style="border:1px solid var(--line);padding:12px" data-t="${act.id}"><span class="ico">🧳</span><span class="grow">Viaje en curso: ${esc(act.name)}</span>›</button>`:''}${monthPick()}<div class="card hero"><span class="sm">Tu gasto del mes</span><b class="num">${clp(sum(l,mine))}</b><span class="sm">${l.length} gasto${l.length===1?'':'s'} · pagado en total ${clp(sum(l.filter(e=>e.payer==='Yo'),e=>e.total))}</span></div>${dayList(l)}</main>`+navbar()},
trips(){const l=[...S.trips].sort((a,b)=>b.start.localeCompare(a.start));
  return head('Viajes')+`<main><button class="btn pri full" data-a="newtrip">Nuevo viaje o período</button>${l.length?'':'<div class="empty">Crea un viaje con fecha de inicio y fin. Los gastos de esas fechas se agrupan solos.</div>'}${l.map(t=>{const x=S.expenses.filter(e=>tripOf(e)?.id===t.id);return `<button class="row card" style="border:1px solid var(--line);padding:12px" data-t="${t.id}"><span class="ico">🧳</span><span class="grow">${esc(t.name)}<br><span class="sm">${fdate(t.start)} → ${fdate(t.end)}</span></span><span class="num">${clp(sum(x,mine))}</span></button>`}).join('')}</main>`+navbar()},
trip(){const t=S.trips.find(x=>x.id===cur().id);if(!t)return appBack(),'';const l=S.expenses.filter(e=>tripOf(e)?.id===t.id),d=Math.max(1,Math.round((new Date(t.end)-new Date(t.start))/864e5)+1),b=balances(l,[]);
  return head(t.name,`<button class="btn" data-a="edittrip">Editar</button>`)+`<main><div class="card hero"><span class="sm">${fdate(t.start)} → ${fdate(t.end)}</span><b class="num">${clp(sum(l,mine))}</b><span class="sm">tu parte · ${clp(sum(l,mine)/d)} por día (${d} días)</span></div>${t.budget?budget(t,sum(l,mine)):''}${balList(b,'Saldos del viaje')}${catBars(l)}${dayList(l)}</main>`+navbar()},
tripform(){const t=cur().id?S.trips.find(x=>x.id===cur().id):{name:'',start:today(),end:today(),budget:0};
  return head(cur().id?'Editar viaje':'Nuevo viaje')+`<main><div class="card"><label>Nombre<input id="tn" value="${esc(t.name)}" placeholder="Ej: Vacaciones en Pucón"></label><div class="two"><label>Inicio<input id="ts" type="date" value="${t.start}"></label><label>Fin<input id="te" type="date" value="${t.end}"></label></div><label>Presupuesto (opcional)<input id="tb" inputmode="numeric" value="${t.budget||''}"></label><button class="btn pri full" data-a="savetrip">Guardar</button>${cur().id?'<button class="btn bad full" data-a="deltrip">Eliminar viaje (los gastos se conservan)</button>':''}</div></main>`},
debts(){const b=balances(),ps=Object.keys(b).filter(p=>b[p]),a=sum(ps,p=>Math.max(b[p],0)),o=sum(ps,p=>Math.max(-b[p],0));
  return head('Deudas')+`<main><div class="stat"><div class="card"><span class="sm">Te deben</span><b class="num pos">${clp(a)}</b></div><div class="card"><span class="sm">Debes</span><b class="num neg">${clp(o)}</b></div></div><button class="btn pri full" data-a="newloan">Anotar deuda</button><h2>Por persona</h2>${ps.length?`<div class="card" style="padding:2px 14px">${ps.sort((x,y)=>b[y]-b[x]).map(p=>`<button class="row" data-p="${esc(p)}"><span class="grow">${esc(p)}</span><span class="num ${b[p]>0?'pos':'neg'}">${b[p]>0?'te debe':'le debes'} ${clp(Math.abs(b[p]))}</span></button>`).join('')}</div>`:'<div class="empty">Todo saldado.</div>'}</main>`+navbar()},
person(){const p=cur().p,bal=balances()[p]||0,ex=byDate(S.expenses.filter(e=>{const s=shares(e);return e.payer===p?s.Yo:e.payer==='Yo'&&s[p]})),lo=S.loans.filter(l=>l.person===p).sort((a,b)=>b.date.localeCompare(a.date));
  return head(p)+`<main><div class="card hero"><span class="sm">${bal>0?'Te debe':bal<0?'Le debes':'Están a mano'}</span><b class="num ${bal>0?'pos':bal<0?'neg':''}">${clp(Math.abs(bal))}</b></div>${bal?`<button class="btn pri full" data-a="settle">Marcar saldado</button><label>O registrar pago parcial<input id="pp" inputmode="numeric" placeholder="Monto"></label><button class="btn full" data-a="partial">Registrar pago</button>`:''}<h2>Gastos</h2><div class="card" style="padding:2px 14px">${ex.map(e=>{const s=shares(e),v=e.payer==='Yo'?s[p]:-s.Yo;return `<button class="row" data-e="${e.id}"><span class="grow">${esc(e.title)}<br><span class="sm">${fdate(e.date)}</span></span><span class="num ${v>0?'pos':'neg'}">${clp(v)}</span></button>`}).join('')||'<div class="empty">Sin gastos compartidos.</div>'}</div><h2>Anotaciones y pagos</h2><div class="card" style="padding:2px 14px">${lo.map(l=>`<div class="row"><span class="grow">${esc(l.note||'Anotación')}<br><span class="sm">${fdate(l.date)}</span></span><span class="num ${l.dir==='me'?'pos':'neg'}">${clp(l.dir==='me'?l.amount:-l.amount)}</span><button class="x" data-dl="${l.id}" aria-label="Eliminar">×</button></div>`).join('')||'<div class="empty">Sin anotaciones.</div>'}</div></main>`},
loan(){return head('Anotar deuda')+`<main><div class="card"><label>Persona<input id="lp" list="pl" placeholder="Nombre"><datalist id="pl">${S.people.map(p=>`<option value="${esc(p)}">`).join('')}</datalist></label><label>Quién debe<select id="ld"><option value="me">Esa persona me debe</option><option value="them">Yo le debo</option></select></label><label>Monto<input id="la" inputmode="numeric"></label><label>Motivo<input id="ln" placeholder="Ej: préstamo para el taxi"></label><label>Fecha<input id="lf" type="date" value="${today()}"></label><button class="btn pri full" data-a="saveloan">Guardar</button></div></main>`},
stats(){const y=S.expenses,opts=[['mes',mLabel(month)],['todo','Todo'],...S.trips.map(t=>[t.id,t.name])];
  const l=metric==='mes'?y.filter(e=>e.date.startsWith(month)):metric==='todo'?y:y.filter(e=>tripOf(e)?.id===metric);
  const tot=sum(l,mine),days=new Set(l.map(e=>e.date)).size,big=[...l].sort((a,b)=>mine(b)-mine(a))[0];
  const ms=[...Array(6)].map((_,i)=>shiftM(today().slice(0,7),i-5)),mv=ms.map(m=>sum(y.filter(e=>e.date.startsWith(m)),mine)),mx=Math.max(...mv,1);
  return head('Métricas')+`<main><div class="chips">${opts.map(o=>`<button class="chip ${metric===o[0]?'on':''}" data-mt="${o[0]}">${esc(o[1])}</button>`).join('')}</div>${metric==='mes'?monthPick():''}<div class="stat" style="margin-top:10px"><div class="card"><span class="sm">Tu gasto</span><b class="num">${clp(tot)}</b></div><div class="card"><span class="sm">Promedio por día con gasto</span><b class="num">${clp(days?tot/days:0)}</b></div><div class="card"><span class="sm">N° de gastos</span><b class="num">${l.length}</b></div><div class="card"><span class="sm">Mayor gasto</span><b>${big?esc(big.title):'—'}</b><span class="sm num">${big?clp(mine(big)):''}</span></div></div>${catBars(l)}<h2>Últimos 6 meses</h2><div class="card"><div class="cols">${ms.map((m,i)=>`<div><i style="height:${mv[i]/mx*85}%" title="${clp(mv[i])}"></i>${MES[+m.slice(5)-1]}</div>`).join('')}</div></div><h2>Respaldo</h2><div class="two"><button class="btn" data-a="export">Exportar</button><button class="btn" data-a="import">Importar</button></div></main>`+navbar()},
detail(){const e=S.expenses.find(x=>x.id===cur().id);if(!e)return appBack(),'';const s=shares(e),t=tripOf(e),rest=e.total-sum(e.items||[],i=>i.price);
  return head(e.title,`<button class="btn" data-a="edit">Editar</button>`)+`<main><div class="card hero"><span class="sm">${cat(e.cat)[2]} ${cat(e.cat)[1]} · ${fdate(e.date)}${t?' · '+esc(t.name):''}</span><b class="num">${clp(e.total)}</b><span class="sm">Pagó ${e.payer==='Yo'?'yo':esc(e.payer)}</span></div>${e.photos?.length?`<h2>Boleta</h2><div class="pics" id="pics"></div>`:''}${e.items?.length?`<h2>Detalle</h2><div class="card" style="padding:2px 14px">${e.items.map(i=>`<div class="row"><span class="grow">${esc(i.name)}${i.owner==='Yo'?'':` <span class="tag ${i.owner==='shared'?'':'w'}">${i.owner==='shared'?'dividido':'de '+esc(i.owner)}</span>`}</span><span class="num">${clp(i.price)}</span></div>`).join('')}${rest>0?`<div class="row"><span class="grow sm">Sin detallar</span><span class="num sm">${clp(rest)}</span></div>`:''}</div>`:''}${Object.keys(s).length>1||e.payer!=='Yo'?`<h2>Reparto</h2><div class="card" style="padding:2px 14px">${Object.keys(s).map(p=>`<div class="row"><span class="grow">${p==='Yo'?'Yo':esc(p)}</span><span class="num">${clp(s[p])}</span></div>`).join('')}</div>`:''}${e.note?`<h2>Nota</h2><div class="card">${esc(e.note)}</div>`:''}<button class="btn bad full" data-a="delexp">Eliminar gasto</button></main>`},
form(){const d=draft,sumI=sum(d.items,i=>parseN(i.price)),ps=S.people;
  const owners=(o)=>`<option value="Yo" ${o==='Yo'?'selected':''}>Es mío</option><option value="shared" ${o==='shared'?'selected':''}>Dividido entre el grupo</option>${ps.map(p=>`<option value="${esc(p)}" ${o===p?'selected':''}>De ${esc(p)}</option>`).join('')}`;
  return head(d.id?'Editar gasto':'Nuevo gasto')+`<main><div class="card"><label>Nombre<input data-f="title" value="${esc(d.title)}" placeholder="Ej: Gasto súper"></label><div class="two"><label>Total<input class="num" data-f="total" inputmode="numeric" value="${d.total||''}" placeholder="0"></label><label>Fecha<input data-f="date" type="date" value="${d.date}"></label></div><label>Categoría</label><div class="chips">${CATS.map(c=>`<button class="chip ${d.cat===c[0]?'on':''}" data-c="${c[0]}">${c[2]} ${c[1]}</button>`).join('')}</div></div>
<div class="card"><b>Boleta</b><div class="two" style="margin-top:8px"><button class="btn" data-a="cam">📷 Sacar foto</button><button class="btn" data-a="gal">🖼️ Galería</button></div><div class="pics" id="pics"></div>${d.photos.length?'<button class="btn full" data-a="ocr">🔎 Leer boleta</button>':''}</div>
<div class="card"><b>Personas</b><div style="display:flex;gap:8px;margin-top:6px"><input id="np" placeholder="Agregar persona" style="margin:0"><button class="btn" data-a="addp">Agregar</button></div><label>¿Quién pagó?</label><div class="chips">${['Yo',...ps].map(p=>`<button class="chip ${d.payer===p?'on':''}" data-pay="${esc(p)}">${esc(p)}</button>`).join('')}</div>${ps.length?`<label>Dividir en partes iguales con</label><div class="chips">${ps.map(p=>`<button class="chip ${d.split.includes(p)?'on':''}" data-sp="${esc(p)}">${esc(p)}</button>`).join('')}</div>`:''}</div>
<div class="card"><b>Detalle de la boleta</b><div class="sm">Opcional. Lo que no detalles se reparte según el grupo de arriba.</div>${d.items.map((i,n)=>`<div class="item"><input data-i="${n}" data-k="name" value="${esc(i.name)}" placeholder="Producto"><input class="num" data-i="${n}" data-k="price" inputmode="numeric" value="${i.price||''}" placeholder="$"><button class="x" data-di="${n}" aria-label="Quitar">×</button><select data-i="${n}" data-k="owner">${owners(i.owner)}</select></div>`).join('')}<button class="btn full" data-a="additem">+ Agregar ítem</button><div class="sm" id="isum" style="margin-top:6px">${d.items.length?`Suma del detalle: ${clp(sumI)}`:''}</div></div>
<div class="card"><label style="margin-top:0">Nota<textarea data-f="note" rows="2">${esc(d.note)}</textarea></label></div><button class="btn pri full" data-a="saveexp">Guardar gasto</button></main>`}
};
function budget(t,v){const p=v/t.budget;return `<div class="card"><span class="sm">Presupuesto ${clp(t.budget)} · ${p>1?`excedido en ${clp(v-t.budget)}`:`quedan ${clp(t.budget-v)}`}</span><div class="bar"><i style="width:${Math.min(p,1)*100}%;${p>1?'background:var(--warn)':''}"></i></div></div>`}
function catBars(l){const m={};l.forEach(e=>m[e.cat]=(m[e.cat]||0)+mine(e));const k=Object.keys(m).filter(c=>m[c]).sort((a,b)=>m[b]-m[a]);if(!k.length)return '';const tot=sum(k,c=>m[c]);return `<h2>Por categoría</h2><div class="card">${k.map(c=>`<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between"><span>${cat(c)[2]} ${cat(c)[1]}</span><span class="num">${clp(m[c])} · ${Math.round(m[c]/tot*100)}%</span></div><div class="bar"><i style="width:${m[c]/m[k[0]]*100}%"></i></div></div>`).join('')}</div>`}
function balList(b,t){const k=Object.keys(b).filter(p=>b[p]);return k.length?`<h2>${t}</h2><div class="card" style="padding:2px 14px">${k.map(p=>`<button class="row" data-p="${esc(p)}"><span class="grow">${esc(p)}</span><span class="num ${b[p]>0?'pos':'neg'}">${clp(b[p])}</span></button>`).join('')}</div>`:''}
async function pics(ids,edit){const c=$('#pics');if(!c)return;for(const id of ids){const d=await getPhoto(id);if(!d)continue;const w=document.createElement('div');w.className='pic';w.innerHTML=`<img alt="Foto de boleta" data-z="1">${edit?`<button class="x" data-dp="${id}" aria-label="Quitar">×</button>`:''}`;w.firstChild.src=d;c.append(w)}}
function render(){app.innerHTML=V[cur().v]();if(cur().v==='detail'){const e=S.expenses.find(x=>x.id===cur().id);e&&pics(e.photos||[])}if(cur().v==='form')pics(draft.photos,true)}
function compress(f){return new Promise((ok,no)=>{const u=URL.createObjectURL(f),i=new Image;i.onload=()=>{const k=Math.min(1,1800/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(u);ok(c.toDataURL('image/jpeg',.78))};i.onerror=no;i.src=u})}
async function addFile(ev){const fs=[...ev.target.files];ev.target.value='';for(const f of fs){try{const id=uid();await putPhoto(id,await compress(f));draft.photos.push(id)}catch{toast('No se pudo leer la imagen')}}render()}
$('#file').onchange=addFile;$('#gal').onchange=addFile;
$('#imp').onchange=async ev=>{const f=ev.target.files[0];ev.target.value='';if(!f)return;try{const j=JSON.parse(await f.text());if(!j.state?.expenses)throw 0;if(!confirm('Esto reemplaza todos los datos actuales. ¿Continuar?'))return;S=j.state;await save();for(const k in j.photos)await putPhoto(k,j.photos[k]);toast('Respaldo importado');render()}catch{toast('Archivo no válido')}};
async function exportar(){const photos={};for(const e of S.expenses)for(const id of e.photos||[])photos[id]=await getPhoto(id);const t=JSON.stringify({v:1,state:S,photos}),n=`boleta-${today()}.json`;if(window.Android)Android.shareFile(n,t);else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t]));a.download=n;a.click()}}
const A={
back:appBack,new(){draft={title:'',total:0,date:today(),cat:'super',payer:'Yo',split:[],items:[],photos:[],note:''};go('form')},
edit(){draft=JSON.parse(JSON.stringify(S.expenses.find(x=>x.id===cur().id)));draft.items=draft.items||[];draft.split=draft.split||[];draft.photos=draft.photos||[];go('form')},
async ocr(){if(!window.Android)return toast('Disponible solo en la app');const id=draft.photos[draft.photos.length-1];toast('Leyendo boleta…');Android.readReceipt(await getPhoto(id))},
cam(){$('#file').click()},gal(){$('#gal').click()},
additem(){draft.items.push({name:'',price:0,owner:'Yo'});render()},
addp(){const v=$('#np').value.trim();if(!v)return;addPeople([v]);save();render()},
async saveexp(){const d=draft;d.title=d.title.trim();d.total=parseN(d.total);d.items=d.items.filter(i=>i.name.trim()||parseN(i.price)).map(i=>({...i,name:i.name.trim()||'Ítem',price:parseN(i.price)}));
  if(!d.total&&d.items.length)d.total=sum(d.items,i=>i.price);
  if(!d.title)return toast('Ponle un nombre');if(d.total<=0)return toast('Ingresa el total');if(sum(d.items,i=>i.price)>d.total)return toast('El detalle supera el total');
  if(d.id){const old=S.expenses.find(x=>x.id===d.id);(old.photos||[]).filter(p=>!d.photos.includes(p)).forEach(delPhoto);S.expenses[S.expenses.indexOf(old)]=d}else{d.id=uid();S.expenses.push(d)}
  await save();month=d.date.slice(0,7);const id=d.id,was=stack[stack.length-2];stack.pop();draft=null;if(was?.v!=='detail')stack.push({v:'detail',id});scrollTo(0,0);render()},
async delexp(){if(!confirm('¿Eliminar este gasto?'))return;const e=S.expenses.find(x=>x.id===cur().id);(e.photos||[]).forEach(delPhoto);S.expenses=S.expenses.filter(x=>x!==e);await save();appBack()},
newtrip(){go('tripform')},edittrip(){go('tripform',{id:cur().id})},
async savetrip(){const n=$('#tn').value.trim(),s=$('#ts').value,e=$('#te').value;if(!n)return toast('Ponle un nombre');if(!s||!e||e<s)return toast('Revisa las fechas');const o={name:n,start:s,end:e,budget:parseN($('#tb').value)},id=cur().id;if(id)Object.assign(S.trips.find(x=>x.id===id),o);else S.trips.push({id:uid(),...o});await save();appBack()},
async deltrip(){if(!confirm('¿Eliminar el viaje?'))return;S.trips=S.trips.filter(t=>t.id!==cur().id);await save();tab('trips')},
newloan(){go('loan')},
async saveloan(){const p=$('#lp').value.trim(),a=parseN($('#la').value);if(!p||a<=0)return toast('Falta persona o monto');addPeople([p]);S.loans.push({id:uid(),person:p,dir:$('#ld').value,amount:a,note:$('#ln').value.trim(),date:$('#lf').value||today()});await save();appBack()},
async settle(){await pay(Math.abs(balances()[cur().p]||0))},
async partial(){const a=parseN($('#pp').value);if(a<=0)return toast('Ingresa un monto');await pay(Math.min(a,Math.abs(balances()[cur().p]||0)))},
export:exportar,import(){$('#imp').click()}
};
async function pay(a){const p=cur().p,b=balances()[p]||0;S.loans.push({id:uid(),person:p,dir:b>0?'them':'me',amount:a,note:'Pago registrado',date:today()});await save();render()}
document.addEventListener('click',ev=>{const t=ev.target.closest('button,[data-z]');if(!t)return;const q=t.dataset;
  if(q.z){const w=document.createElement('div');w.className='view';w.innerHTML='<img alt="Boleta">';w.firstChild.src=t.src;w.onclick=()=>w.remove();document.body.append(w);return}
  if(q.a)return A[q.a]();if(q.tab)return tab(q.tab);if(q.e)return go('detail',{id:q.e});if(q.t)return go('trip',{id:q.t});if(q.p)return go('person',{p:q.p});
  if(q.m){month=shiftM(month,+q.m);return render()}if(q.mt){metric=q.mt;return render()}
  if(q.c){draft.cat=q.c;return render()}if(q.pay){draft.payer=q.pay;return render()}
  if(q.sp){const i=draft.split.indexOf(q.sp);i<0?draft.split.push(q.sp):draft.split.splice(i,1);return render()}
  if(q.di){draft.items.splice(+q.di,1);return render()}
  if(q.dp){draft.photos=draft.photos.filter(p=>p!==q.dp);return render()}
  if(q.dl){if(confirm('¿Eliminar esta anotación?')){S.loans=S.loans.filter(l=>l.id!==q.dl);save().then(render)}}
});
document.addEventListener('input',ev=>{const t=ev.target,q=t.dataset;if(q.f)draft[q.f]=t.value;if(q.i){draft.items[+q.i][q.k]=t.value;const s=$('#isum');if(s)s.textContent='Suma del detalle: '+clp(sum(draft.items,i=>parseN(i.price)))}});
open().then(async()=>{const s=await tx('kv','readonly',x=>x.get('state'));if(s)S=s;render()});
