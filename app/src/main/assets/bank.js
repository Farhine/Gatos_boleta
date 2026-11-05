'use strict';
/* Interpreta avisos de banco. Sin dependencias, para poder probarlo aparte. */
const BANK=(()=>{
const NO=/rechazad|no (se )?(pudo|pudimos)|fall[oó]|oferta|promo|cashback|gana|cup[oó]n|descuentos?\b|disponible|cr[eé]dito pre|invierte|rendimiento|vence|recuerda|solicita/i;
const IN=/recibiste|te (transfiri|enviaron|deposit|pag[oó]|lleg[oó])|abono|dep[oó]sito|ingres[oó]|transferencia recibida|devoluci[oó]n|reembolso/i;
const OUT=/compra|compraste|pagaste|pago\b|cargo|transferiste|enviaste|transferencia|giro|retiro/i;
function parse(text){const m=text.match(/\$\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/);if(!m)return null;const amount=parseInt(m[1].replace(/\D/g,''),10);if(!amount)return null;
  const inc=IN.test(text);if(NO.test(text)&&!inc)return null;if(!inc&&!OUT.test(text))return null;
  const w=text.slice(m.index+m[0].length).match(/\b(?:en|a|de|para)\s+([A-ZÁÉÍÓÚÑ0-9][^\n.,;]{1,34})/)||text.match(/\b(?:en|a|de|para)\s+([A-ZÁÉÍÓÚÑ0-9][^\n.,;$]{1,34})/);
  return{amount,dir:inc?'in':'out',merchant:w?w[1].replace(/\s+(el|por|con|tarjeta)\b.*$/i,'').trim():''}}
return{parse};
})();
if(typeof module!=='undefined')module.exports=BANK;
