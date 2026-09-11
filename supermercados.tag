// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// Trabajo Práctico Integrador - Etapa 1: RPA
//
// Script: supermercados.tag
// Descripción: Entregable académico independiente para ejecutar explícitamente
//              con TagUI. El Dashboard y server.js usan rpa_runner.js como único
//              motor de producción visible; no mezclar ambas ejecuciones.
//
// Ejecución: tagui supermercados.tag input.csv
// ==============================================================================

// En la primera iteración creamos el encabezado si el archivo aún no existe
if iteration equals to 1
    js var fs = require('fs'); if (!fs.exists('resultados.csv')) { fs.write('resultados.csv', 'modo,producto_solicitado,nombre_encontrado,precio,supermercado,url,fecha,stock_status,cantidad,unidad\n', 'w'); }

echo ----------------------------------------------------------------------------
echo [INFO] Procesando producto: `producto` (Fila `iteration`)
echo ----------------------------------------------------------------------------

// Obtenemos la fecha actual en formato YYYY-MM-DD
js var hoy = new Date(); var m = (hoy.getMonth() + 1).toString(); var d = hoy.getDate().toString(); if (m.length < 2) m = '0' + m; if (d.length < 2) d = '0' + d; fechaHoy = hoy.getFullYear() + '-' + m + '-' + d;

// Detectar el modo de ejecución y cantidad solicitada
js modo_actual = 'compra_mes'; try { if (typeof modo !== 'undefined' && modo && modo !== 'modo') { modo_actual = modo.trim(); } } catch(e) { modo_actual = 'compra_mes'; }
js cant_actual = 1; try { if (typeof cantidad !== 'undefined' && cantidad && !isNaN(parseInt(cantidad))) { cant_actual = parseInt(cantidad); } } catch(e) { cant_actual = 1; }
js unid_actual = ''; try { if (typeof unidad !== 'undefined' && unidad) { unid_actual = unidad.trim(); } } catch(e) { unid_actual = ''; }

// Codificamos el término para URL segura
js prod_clean = producto.replace(/"/g, '').replace(/'/g, '').trim();
js prod_url = encodeURIComponent(prod_clean.replace(/,/g, ' ').replace(/\s+/g, ' '));


// ==============================================================================
// 1. CONSULTA EN CARREFOUR ARGENTINA
// ==============================================================================
echo [SUPERMERCADO 1] Abriendo navegador...
https://www.carrefour.com.ar
wait 3

// Cierre de cookies si estuviera presente
if present('Aceptar todo')
    click Aceptar todo
    wait 1

echo [SUPERMERCADO 1] Localizando buscador y escribiendo producto: `producto`...
type input.vtex-styleguide-9-x-input as `producto`[enter]
wait 4

echo [SUPERMERCADO 1] Aplicando orden: menor a mayor...
wait 2

echo [SUPERMERCADO 1] Extrayendo resultados...
carrefour_nom = "No encontrado"
carrefour_pre = "N/D"
carrefour_url = url()
carrefour_stock = "NO ENCONTRADO"

dom begin
function cleanText(s) {
    if (!s) return '';
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
}

var qStr = cleanText("`producto`");
var qWords = qStr.split(/\s+/).filter(function(w){ return w.length >= 2; });

var cards = Array.from(document.querySelectorAll('article, [class*="product-summary"], [class*="vtex-search-result-3-x-galleryItem"]')).slice(0, 10);
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

    candidates.push({
        name: nameVal,
        price: priceVal,
        url: urlVal,
        stock: unavail ? 'SIN STOCK' : 'DISPONIBLE',
        score: score
    });
}

if (candidates.length === 0) return 'null';
candidates.sort(function(a, b) { return b.score - a.score; });
return JSON.stringify(candidates[0]);
dom finish

js var cData = null; try { cData = JSON.parse(dom_result); } catch(e){}
js if (cData) { carrefour_nom = cData.name; carrefour_pre = cData.price; carrefour_url = cData.url; carrefour_stock = cData.stock; }
echo [SUPERMERCADO 1] Extraído: `carrefour_nom` | `carrefour_pre` | `carrefour_stock`
echo [SUPERMERCADO 1] Finalizado.
write `csv_row([modo_actual, producto, carrefour_nom, carrefour_pre, "Carrefour", carrefour_url, fechaHoy, carrefour_stock, cant_actual, unid_actual])` to resultados.csv


// ==============================================================================
// 2. CONSULTA EN COTO DIGITAL
// ==============================================================================
echo [SUPERMERCADO 2] Abriendo navegador...
echo [SUPERMERCADO 2] Navegando a https://www.coto.com.ar...
https://www.coto.com.ar
wait 3

echo [SUPERMERCADO 2] Localizando buscador y escribiendo producto: `producto`...
type input#cio-autocomplete-0-input as `producto`[enter]
wait 4

echo [SUPERMERCADO 2] Aplicando orden: menor a mayor...
wait 2

echo [SUPERMERCADO 2] Extrayendo resultados...
coto_nom = "No encontrado"
coto_pre = "N/D"
coto_url = url()
coto_stock = "NO ENCONTRADO"

dom begin
function cleanText(s) {
    if (!s) return '';
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
}

var qStr = cleanText("`producto`");
var qWords = qStr.split(/\s+/).filter(function(w){ return w.length >= 2; });

var items = Array.from(document.querySelectorAll('constructor-result-item, .product-card, article')).slice(0, 10);
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
    if (priceVal === 'N/D' || priceVal === '' || priceVal === '$0' || priceVal === '$0,00') unavail = true;

    var nClean = cleanText(nameVal);
    var score = 0;
    if (nClean.indexOf(qStr) > -1) score += 100;
    for (var w = 0; w < qWords.length; w++) {
        if (nClean.indexOf(qWords[w]) > -1) score += 20;
    }
    if ((qStr.indexOf('gaseosa') > -1 || qStr.indexOf('bebida') > -1) && (nClean.indexOf('shampoo') > -1 || nClean.indexOf('xkg') > -1)) {
        score -= 200;
    }
    if (unavail) score -= 10;

    candidates.push({
        name: nameVal,
        price: priceVal,
        url: urlVal,
        stock: unavail ? 'SIN STOCK' : 'DISPONIBLE',
        score: score
    });
}

if (candidates.length === 0) return 'null';
candidates.sort(function(a, b) { return b.score - a.score; });
return JSON.stringify(candidates[0]);
dom finish

js var ctData = null; try { ctData = JSON.parse(dom_result); } catch(e){}
js if (ctData) { coto_nom = ctData.name; coto_pre = ctData.price; coto_url = ctData.url; coto_stock = ctData.stock; }
echo [SUPERMERCADO 2] Extraído: `coto_nom` | `coto_pre` | `coto_stock`
echo [SUPERMERCADO 2] Finalizado.
write `csv_row([modo_actual, producto, coto_nom, coto_pre, "COTO", coto_url, fechaHoy, coto_stock, cant_actual, unid_actual])` to resultados.csv


// ==============================================================================
// 3. CONSULTA EN DÍA %
// ==============================================================================
echo [SUPERMERCADO 3] Abriendo navegador...
echo [SUPERMERCADO 3] Navegando a https://diaonline.supermercadosdia.com.ar...
https://diaonline.supermercadosdia.com.ar
wait 3

echo [SUPERMERCADO 3] Localizando buscador y escribiendo producto: `producto`...
type input#downshift-0-input as `producto`[enter]
wait 4

echo [SUPERMERCADO 3] Aplicando orden: menor a mayor...
wait 2

echo [SUPERMERCADO 3] Extrayendo resultados...
dia_nom = "No encontrado"
dia_pre = "N/D"
dia_url = url()
dia_stock = "NO ENCONTRADO"

dom begin
function cleanText(s) {
    if (!s) return '';
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
}

var qStr = cleanText("`producto`");
var qWords = qStr.split(/\s+/).filter(function(w){ return w.length >= 2; });

var dCards = Array.from(document.querySelectorAll('article, [class*="product-summary"]')).slice(0, 10);
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
            if (lines[l].indexOf('$') > -1) { priceVal = lines[l].trim(); break; }
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
    if ((qStr.indexOf('gaseosa') > -1 || qStr.indexOf('bebida') > -1) && (nClean.indexOf('shampoo') > -1 || nClean.indexOf('xkg') > -1)) {
        score -= 200;
    }
    if (unavail) score -= 10;

    candidates.push({
        name: nameVal,
        price: priceVal,
        url: urlVal,
        stock: unavail ? 'SIN STOCK' : 'DISPONIBLE',
        score: score
    });
}

if (candidates.length === 0) return 'null';
candidates.sort(function(a, b) { return b.score - a.score; });
return JSON.stringify(candidates[0]);
dom finish

js var dData = null; try { dData = JSON.parse(dom_result); } catch(e){}
js if (dData) { dia_nom = dData.name; dia_pre = dData.price; dia_url = dData.url; dia_stock = dData.stock; }
echo [SUPERMERCADO 3] Extraído: `dia_nom` | `dia_pre` | `dia_stock`
echo [SUPERMERCADO 3] Finalizado.
write `csv_row([modo_actual, producto, dia_nom, dia_pre, "Día %", dia_url, fechaHoy, dia_stock, cant_actual, unid_actual])` to resultados.csv

echo ----------------------------------------------------------------------------
echo [ RPA FINALIZADO ]
echo 3 supermercados procesados.
echo Resultados guardados en resultados.csv.
echo ----------------------------------------------------------------------------
