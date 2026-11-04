'use strict';
/* Convierte las líneas del OCR {t,x,y,h} en datos de boleta. Sin dependencias, para poder probarlo aparte. */
const OCR=(()=>{
const SKIP=/\b(rut|r\.u\.t|iva|neto|exento|sub-?total|vuelto|efectivo|tarjeta|d[eé]bito|cr[eé]dito|redcompra|boleta|folio|fecha|hora|caja|cajero|sii|giro|total|pagar|ahorro|descuentos?|dcto|cuotas?|transbank|autorizaci[oó]n|direcci[oó]n|fono|tel[eé]fono|gracias)\b/i;
const NOTOT=/sub-?total|ahorro|descuento|items?\b|art[ií]culos?|neto/i;
const PRICE=/(?:\$\s*)?(\d{1,3}(?:[.,\s]\d{3})+|\d{3,7})\s*(?:[A-Z])?\s*$/;
const num=s=>parseInt(s.replace(/\D/g,''),10);
const letters=s=>(s.match(/[a-záéíóúñ]/gi)||[]).length;
function rows(lines){
  const out=[];[...lines].sort((a,b)=>(a.y+a.h/2)-(b.y+b.h/2)).forEach(l=>{
    const r=out.find(o=>Math.abs(o.c-(l.y+l.h/2))<Math.max(o.h,l.h)*.6);
    r?r.p.push(l):out.push({c:l.y+l.h/2,h:l.h,p:[l]})});
  return out.map(r=>r.p.sort((a,b)=>a.x-b.x).map(l=>l.t).join(' ').trim()).filter(Boolean);
}
function date(rs,now){for(const r of rs){const m=r.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})\b/);if(!m)continue;
  const y=m[3].length===2?'20'+m[3]:m[3],mm=+m[2],d=+m[1];if(mm<1||mm>12||d<1||d>31)continue;
  const s=`${y}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`;if(s<=now)return s}return ''}
const guess=t=>/l[ií]der|jumbo|tottus|unimarc|santa isabel|acuenta|ekono|supermerc/i.test(t)?'super':/copec|shell|petrobras|enex|aramco|uber|cabify/i.test(t)?'transporte':/farmacia|cruz verde|salcobrand|ahumada|dr\.? simi/i.test(t)?'salud':/restaur|caf[eé]|sushi|pizza|mcdonald|burger|starbucks/i.test(t)?'comida':/sodimac|easy|homecenter|construmart/i.test(t)?'hogar':/falabella|paris|ripley|h&m|zara/i.test(t)?'ropa':'';
const tc=s=>s.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
function parse(lines,now){
  const rs=rows(lines);let total=0,ti=-1;
  rs.forEach((r,i)=>{if(/total|a\s*pagar/i.test(r)&&!NOTOT.test(r)){let m=r.match(PRICE)||(rs[i+1]||'').match(PRICE);if(m&&num(m[1])>=total){total=num(m[1]);ti=i}}});
  const end=ti<0?rs.length:ti,items=[];let pend='';
  for(let i=0;i<end;i++){const r=rs[i],m=r.match(PRICE),neg=/-\s*\$?\s*[\d.,]+\s*$/.test(r);
    if(SKIP.test(r)||neg){pend='';continue}
    if(!m){pend=letters(r)>=3?r:'';continue}
    let name=r.slice(0,m.index).replace(/^\s*\d{4,}\s*/,'').replace(/[$\s]+$/,'').trim();
    if(letters(name)<3){if(!pend)continue;name=pend}
    items.push({name:tc(name),price:num(m[1]),owner:'Yo'});pend=''}
  if(!total)total=items.reduce((a,b)=>a+b.price,0);
  const shop=rs.slice(0,6).find(r=>letters(r)>=3&&!SKIP.test(r))||'';
  return{title:tc(shop),total,date:date(rs,now),items,cat:guess(rs.slice(0,8).join(' ')),raw:rs.length};
}
return{parse,rows};
})();
if(typeof module!=='undefined')module.exports=OCR;
