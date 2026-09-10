// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// Trabajo Práctico Integrador - Etapa 1: RPA
//
// Script: supermercados.tag
// Descripción: Automatización de búsqueda y extracción de precios en
//              Carrefour, COTO y Día % a partir de un archivo input.csv.
//              Persistencia de resultados en resultados.csv.
//
// Ejecución: tagui supermercados.tag input.csv
// ==============================================================================

// En la primera iteración creamos el encabezado si el archivo aún no existe
if iteration equals to 1
    js var fs = require('fs'); if (!fs.exists('resultados.csv')) { fs.write('resultados.csv', 'modo,producto_solicitado,nombre_encontrado,precio,supermercado,url,fecha,stock_status,cantidad\n', 'w'); }

echo ----------------------------------------------------------------------------
echo [INFO] Procesando producto: `producto` (Fila `iteration`)
echo ----------------------------------------------------------------------------

// Obtenemos la fecha actual en formato YYYY-MM-DD
js var hoy = new Date(); var m = (hoy.getMonth() + 1).toString(); var d = hoy.getDate().toString(); if (m.length < 2) m = '0' + m; if (d.length < 2) d = '0' + d; fechaHoy = hoy.getFullYear() + '-' + m + '-' + d;

// Detectar el modo de ejecución y cantidad solicitada
js modo_actual = 'compra_mes'; try { if (typeof modo !== 'undefined' && modo && modo !== 'modo') { modo_actual = modo.trim(); } } catch(e) { modo_actual = 'compra_mes'; }
js cant_actual = 1; try { if (typeof cantidad !== 'undefined' && cantidad && !isNaN(parseInt(cantidad))) { cant_actual = parseInt(cantidad); } } catch(e) { cant_actual = 1; }

// Codificamos el término para URL segura (reemplaza espacios por %20 para soportar búsquedas compuestas y limpia comas en URL)
js prod_clean = producto.replace(/"/g, '').replace(/'/g, '').trim();
js prod_url = encodeURIComponent(prod_clean.replace(/,/g, ' ').replace(/\s+/g, ' '));


// ==============================================================================
// 1. CONSULTA EN CARREFOUR ARGENTINA
// ==============================================================================
echo [Carrefour] Navegando a la búsqueda de: `producto`
https://www.carrefour.com.ar/`prod_url`
wait 6

// Si se presenta el banner de cookies de OneTrust, lo cerramos
if present('Aceptar todo')
    click Aceptar todo
    wait 1

carrefour_nom = "No encontrado"
carrefour_pre = "N/D"
carrefour_url = url()
carrefour_stock = "NO ENCONTRADO"

// Extracción inteligente de múltiples tarjetas del DOM en Carrefour (VTEX)
dom begin
function cleanText(s) {
    if (!s) return '';
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
}
function parsePriceVal(s) {
    if (!s) return null;
    var m = s.match(/[\d.]+(?:,\d+)?/);
    if (!m) return null;
    var val = parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
    return (isNaN(val) || val <= 0) ? null : val;
}

var qStr = cleanText("`producto`");
var qWords = qStr.split(/\s+/).filter(function(w){ return w.length >= 2; });

var cards = Array.from(document.querySelectorAll('article, [class*="product-summary"], [class*="vtex-search-result-3-x-galleryItem"]')).slice(0, 8);
if (cards.length === 0) return 'null';

var candidates = [];
for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    var nEl = c.querySelector('[class*="productBrand"], [class*="product-summary-2-x-nameContainer"], [data-testid="product-summary-name"], h3, h2');
    var pEl = c.querySelector('[class*="sellingPrice"], [class*="currencyContainer"], [class*="price_sellingPrice"]');
    var lEl = c.querySelector('a[href*="/p"]') || c.querySelector('a');
    if (!nEl) continue;

    var nameVal = nEl.innerText.trim();
    var priceVal = pEl ? pEl.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : 'N/D';
    var urlVal = lEl ? lEl.href : window.location.href;

    var cardText = (c.innerText || '').toLowerCase();
    var unavail = (c.querySelector('[class*="unavailable"], [class*="outOfStock"]') !== null) || cardText.indexOf('agotado') > -1 || cardText.indexOf('sin stock') > -1;
    if (priceVal === 'N/D' || priceVal === '' || priceVal === '$ 0' || priceVal === '$ 0,00') unavail = true;

    var nClean = cleanText(nameVal);
    var score = 0;
    if (nClean.indexOf(qStr) > -1) score += 100;
    for (var w = 0; w < qWords.length; w++) {
        if (nClean.indexOf(qWords[w]) > -1) score += 20;
    }
    if ((qStr.indexOf('gaseosa') > -1 || qStr.indexOf('bebida') > -1) && (nClean.indexOf('shampoo') > -1 || nClean.indexOf('jabon') > -1 || nClean.indexOf('xkg') > -1)) {
        score -= 200;
    }
    if (unavail) score -= 10;

    var priceNum = parsePriceVal(priceVal);
    candidates.push({
        name: nameVal,
        price: priceVal,
        priceNum: priceNum,
        url: urlVal,
        stock: unavail ? 'SIN STOCK' : 'DISPONIBLE',
        score: score,
        valido: (!unavail && priceNum !== null && score > 0)
    });
}

if (candidates.length === 0) return 'null';

// REGLA 7: ORDENAR CANDIDATOS VÁLIDOS POR PRECIO ASCENDENTE (MENOR PRECIO VÁLIDO GANA)
var validOnes = candidates.filter(function(x) { return x.valido; });
if (validOnes.length > 0) {
    validOnes.sort(function(a, b) { return a.priceNum - b.priceNum; });
    return JSON.stringify(validOnes[0]);
}

candidates.sort(function(a, b) { return b.score - a.score; });
if (candidates[0].score > 0) {
    return JSON.stringify(candidates[0]);
}

var fallbackC = candidates[0];
fallbackC.stock = 'COINCIDENCIA NO VÁLIDA';
return JSON.stringify(fallbackC);
dom finish

js var cData = JSON.parse(dom_result); if (cData) { carrefour_nom = cData.name; carrefour_pre = cData.price; carrefour_url = cData.url; carrefour_stock = cData.stock; }
echo [Carrefour] Extraído: `carrefour_nom` | `carrefour_pre` | `carrefour_stock`
write `csv_row([modo_actual, producto, carrefour_nom, carrefour_pre, "Carrefour", carrefour_url, fechaHoy, carrefour_stock, cant_actual])` to resultados.csv


// ==============================================================================
// 2. CONSULTA EN COTO DIGITAL
// ==============================================================================
echo [COTO] Navegando a la búsqueda de: `producto`
https://www.coto.com.ar/productos/`prod_url`
wait 6

coto_nom = "No encontrado"
coto_pre = "N/D"
coto_url = url()
coto_stock = "NO ENCONTRADO"

// Extracción inteligente de múltiples tarjetas del DOM en COTO (Angular SPA)
dom begin
function cleanText(s) {
    if (!s) return '';
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
}
function parsePriceVal(s) {
    if (!s) return null;
    var m = s.match(/[\d.]+(?:,\d+)?/);
    if (!m) return null;
    var val = parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
    return (isNaN(val) || val <= 0) ? null : val;
}

var qStr = cleanText("`producto`");
var qWords = qStr.split(/\s+/).filter(function(w){ return w.length >= 2; });

var items = Array.from(document.querySelectorAll('constructor-result-item')).slice(0, 8);
if (items.length === 0) return 'null';

var candidates = [];
for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var nEl = it.querySelector('.nombre-producto, h3, h2');
    var pEl = it.querySelector('.card-title, h4, [class*="price"]');
    var lEl = it.querySelector('a');
    if (!nEl) continue;

    var nameVal = nEl.innerText.trim();
    var priceVal = pEl ? pEl.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : 'N/D';
    var urlVal = lEl ? lEl.href : window.location.href;

    var itText = (it.innerText || '').toLowerCase();
    var unavail = itText.indexOf('sin stock') > -1 || itText.indexOf('agotado') > -1 || itText.indexOf('no disponible') > -1;
    var btn = it.querySelector('button, [class*="btn"]');
    if (btn && (btn.disabled || (btn.innerText && (btn.innerText.toLowerCase().indexOf('agotado') > -1 || btn.innerText.toLowerCase().indexOf('sin stock') > -1)))) {
        unavail = true;
    }
    if (priceVal === 'N/D' || priceVal === '' || priceVal === '$0' || priceVal === '$0,00') unavail = true;

    var nClean = cleanText(nameVal);
    var score = 0;
    if (nClean.indexOf(qStr) > -1) score += 100;
    for (var w = 0; w < qWords.length; w++) {
        if (nClean.indexOf(qWords[w]) > -1) score += 20;
    }
    if ((qStr.indexOf('gaseosa') > -1 || qStr.indexOf('bebida') > -1) && (nClean.indexOf('shampoo') > -1 || nClean.indexOf('xkg') > -1 || nClean.indexOf('jabon') > -1)) {
        score -= 200;
    }
    if (unavail) score -= 10;

    var priceNum = parsePriceVal(priceVal);
    candidates.push({
        name: nameVal,
        price: priceVal,
        priceNum: priceNum,
        url: urlVal,
        stock: unavail ? 'SIN STOCK' : 'DISPONIBLE',
        score: score,
        valido: (!unavail && priceNum !== null && score > 0)
    });
}

if (candidates.length === 0) return 'null';

// REGLA 7: ORDENAR CANDIDATOS VÁLIDOS POR PRECIO ASCENDENTE (MENOR PRECIO VÁLIDO GANA)
var validOnes = candidates.filter(function(x) { return x.valido; });
if (validOnes.length > 0) {
    validOnes.sort(function(a, b) { return a.priceNum - b.priceNum; });
    return JSON.stringify(validOnes[0]);
}

candidates.sort(function(a, b) { return b.score - a.score; });
if (candidates[0].score > 0) {
    return JSON.stringify(candidates[0]);
}

var fallbackCt = candidates[0];
fallbackCt.stock = 'COINCIDENCIA NO VÁLIDA';
return JSON.stringify(fallbackCt);
dom finish

js var ctData = JSON.parse(dom_result); if (ctData) { coto_nom = ctData.name; coto_pre = ctData.price; coto_url = ctData.url; coto_stock = ctData.stock; }
echo [COTO] Extraído: `coto_nom` | `coto_pre` | `coto_stock`
write `csv_row([modo_actual, producto, coto_nom, coto_pre, "COTO", coto_url, fechaHoy, coto_stock, cant_actual])` to resultados.csv


// ==============================================================================
// 3. CONSULTA EN DÍA %
// ==============================================================================
echo [Día %] Navegando a la búsqueda de: `producto`
https://diaonline.supermercadosdia.com.ar/`prod_url`
wait 6

dia_nom = "No encontrado"
dia_pre = "N/D"
dia_url = url()
dia_stock = "NO ENCONTRADO"

// Extracción inteligente de múltiples tarjetas del DOM en Día % (VTEX)
dom begin
function cleanText(s) {
    if (!s) return '';
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
}
function parsePriceVal(s) {
    if (!s) return null;
    var m = s.match(/[\d.]+(?:,\d+)?/);
    if (!m) return null;
    var val = parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
    return (isNaN(val) || val <= 0) ? null : val;
}

var qStr = cleanText("`producto`");
var qWords = qStr.split(/\s+/).filter(function(w){ return w.length >= 2; });

var dCards = Array.from(document.querySelectorAll('article, [class*="product-summary"]')).slice(0, 8);
if (dCards.length === 0) return 'null';

var candidates = [];
for (var i = 0; i < dCards.length; i++) {
    var c = dCards[i];
    var nEl = c.querySelector('h3, [class*="productBrand"]');
    var pEl = c.querySelector('[class*="sellingPrice"], [class*="currencyContainer"]');
    var lEl = c.querySelector('a[href*="/p"]') || c.querySelector('a');
    if (!nEl) continue;

    var nameVal = nEl.innerText.trim();
    var priceVal = 'N/D';
    if (pEl) {
        priceVal = pEl.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    } else {
        var lines = c.innerText.split('\n').filter(function(s){ return s.trim().length > 0; });
        for (var l = 0; l < lines.length; l++) {
            if (lines[l].indexOf('$') > -1) {
                priceVal = lines[l].trim();
                break;
            }
        }
    }
    var urlVal = lEl ? lEl.href : window.location.href;

    var cardText = (c.innerText || '').toLowerCase();
    var unavail = cardText.indexOf('agotado') > -1 || cardText.indexOf('sin stock') > -1 || cardText.indexOf('no disponible') > -1;
    if (priceVal === 'N/D' || priceVal === '' || priceVal === '$ 0' || priceVal === '$ 0,00') unavail = true;

    var nClean = cleanText(nameVal);
    var score = 0;
    if (nClean.indexOf(qStr) > -1) score += 100;
    for (var w = 0; w < qWords.length; w++) {
        if (nClean.indexOf(qWords[w]) > -1) score += 20;
    }
    if ((qStr.indexOf('gaseosa') > -1 || qStr.indexOf('bebida') > -1) && (nClean.indexOf('shampoo') > -1 || nClean.indexOf('jabon') > -1 || nClean.indexOf('xkg') > -1)) {
        score -= 200;
    }
    if (unavail) score -= 10;

    var priceNum = parsePriceVal(priceVal);
    candidates.push({
        name: nameVal,
        price: priceVal,
        priceNum: priceNum,
        url: urlVal,
        stock: unavail ? 'SIN STOCK' : 'DISPONIBLE',
        score: score,
        valido: (!unavail && priceNum !== null && score > 0)
    });
}

if (candidates.length === 0) return 'null';

// REGLA 7: ORDENAR CANDIDATOS VÁLIDOS POR PRECIO ASCENDENTE (MENOR PRECIO VÁLIDO GANA)
var validOnes = candidates.filter(function(x) { return x.valido; });
if (validOnes.length > 0) {
    validOnes.sort(function(a, b) { return a.priceNum - b.priceNum; });
    return JSON.stringify(validOnes[0]);
}

candidates.sort(function(a, b) { return b.score - a.score; });
if (candidates[0].score > 0) {
    return JSON.stringify(candidates[0]);
}

var fallbackD = candidates[0];
fallbackD.stock = 'COINCIDENCIA NO VÁLIDA';
return JSON.stringify(fallbackD);
dom finish

js var dData = JSON.parse(dom_result); if (dData) { dia_nom = dData.name; dia_pre = dData.price; dia_url = dData.url; dia_stock = dData.stock; }
echo [Día %] Extraído: `dia_nom` | `dia_pre` | `dia_stock`
write `csv_row([modo_actual, producto, dia_nom, dia_pre, "Día %", dia_url, fechaHoy, dia_stock, cant_actual])` to resultados.csv

echo [INFO] Finalizada la consulta para: `producto`
