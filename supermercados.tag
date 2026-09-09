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
    js var fs = require('fs'); if (!fs.exists('resultados.csv')) { fs.write('resultados.csv', 'modo,producto_solicitado,nombre_encontrado,precio,supermercado,url,fecha,stock_status\n', 'w'); }

echo ----------------------------------------------------------------------------
echo [INFO] Procesando producto: `producto` (Fila `iteration`)
echo ----------------------------------------------------------------------------

// Obtenemos la fecha actual en formato YYYY-MM-DD
js var hoy = new Date(); var m = (hoy.getMonth() + 1).toString(); var d = hoy.getDate().toString(); if (m.length < 2) m = '0' + m; if (d.length < 2) d = '0' + d; fechaHoy = hoy.getFullYear() + '-' + m + '-' + d;

// Detectar el modo de ejecución (compra_mes o individual)
js var modo_actual = 'compra_mes'; try { if (typeof modo !== 'undefined' && modo && modo !== 'modo') { modo_actual = modo.trim(); } } catch(e) { modo_actual = 'compra_mes'; }

// Codificamos el término para URL segura (reemplaza espacios por %20 para soportar búsquedas compuestas como 'leche serenisima' o 'galletitas oreo')
js prod_url = encodeURIComponent(producto.trim());


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

// Extracción precisa de datos del DOM en Carrefour (VTEX)
dom begin
var nameEl = document.querySelector('[class*="productBrand"], [class*="product-summary-2-x-nameContainer"], [data-testid="product-summary-name"]');
var priceEl = document.querySelector('[class*="sellingPrice"], [class*="currencyContainer"], [class*="price_sellingPrice"]');
var linkEl = document.querySelector('[class*="product-summary"] a[href*="/p"]') || document.querySelector('section a[href*="/p"]') || document.querySelector('article a[href*="/p"]');

if (nameEl) {
    var rawPrice = priceEl ? priceEl.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : 'N/D';
    var isUnavailable = false;
    var card = nameEl.closest('article, [class*="product-summary"], section') || document.body;
    var cardText = card ? card.innerText.toLowerCase() : '';
    if (document.querySelector('[class*="unavailable"], [class*="outOfStock"]') || cardText.indexOf('agotado') > -1 || cardText.indexOf('sin stock') > -1) {
        isUnavailable = true;
    }
    if (rawPrice === 'N/D' || rawPrice === '' || rawPrice === '$ 0' || rawPrice === '$ 0,00') {
        isUnavailable = true;
    }
    return JSON.stringify({
        name: nameEl.innerText.trim(),
        price: rawPrice,
        url: linkEl ? linkEl.href : window.location.href,
        stock: isUnavailable ? 'SIN STOCK' : 'DISPONIBLE'
    });
} else {
    return 'null';
}
dom finish

js var cData = JSON.parse(dom_result); if (cData) { carrefour_nom = cData.name; carrefour_pre = cData.price; carrefour_url = cData.url; carrefour_stock = cData.stock; }
echo [Carrefour] Extraído: `carrefour_nom` | `carrefour_pre` | `carrefour_stock`
write `csv_row([modo_actual, producto, carrefour_nom, carrefour_pre, "Carrefour", carrefour_url, fechaHoy, carrefour_stock])` to resultados.csv


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

// Extracción precisa de datos del DOM en COTO (Angular SPA)
dom begin
var item = document.querySelector('constructor-result-item');
if (item) {
    var nameEl = item.querySelector('.nombre-producto') || item.querySelector('h3') || item.querySelector('h2');
    var priceEl = item.querySelector('.card-title') || item.querySelector('h4') || item.querySelector('[class*="price"]');
    var linkEl = item.querySelector('a');
    var pName = nameEl ? nameEl.innerText.trim() : 'Producto COTO';
    var pPrice = priceEl ? priceEl.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : 'N/D';
    
    var isUnavailable = false;
    var itemText = (item.innerText || '').toLowerCase();
    if (itemText.indexOf('sin stock') > -1 || itemText.indexOf('agotado') > -1 || itemText.indexOf('no disponible') > -1) {
        isUnavailable = true;
    }
    var btn = item.querySelector('button, [class*="btn"]');
    if (btn && (btn.disabled || (btn.innerText && (btn.innerText.toLowerCase().indexOf('agotado') > -1 || btn.innerText.toLowerCase().indexOf('sin stock') > -1)))) {
        isUnavailable = true;
    }
    if (pPrice === 'N/D' || pPrice === '' || pPrice === '$0' || pPrice === '$0,00') {
        isUnavailable = true;
    }

    return JSON.stringify({
        name: pName,
        price: pPrice,
        url: linkEl ? linkEl.href : window.location.href,
        stock: isUnavailable ? 'SIN STOCK' : 'DISPONIBLE'
    });
} else {
    return 'null';
}
dom finish

js var ctData = JSON.parse(dom_result); if (ctData) { coto_nom = ctData.name; coto_pre = ctData.price; coto_url = ctData.url; coto_stock = ctData.stock; }
echo [COTO] Extraído: `coto_nom` | `coto_pre` | `coto_stock`
write `csv_row([modo_actual, producto, coto_nom, coto_pre, "COTO", coto_url, fechaHoy, coto_stock])` to resultados.csv


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

// Extracción precisa de datos del DOM en Día % (VTEX)
dom begin
var dCard = document.querySelector('article') || document.querySelector('[class*="product-summary"]');
if (dCard) {
    var nameEl = dCard.querySelector('h3') || dCard.querySelector('[class*="productBrand"]');
    var priceEl = dCard.querySelector('[class*="sellingPrice"]') || dCard.querySelector('[class*="currencyContainer"]');
    var linkEl = dCard.querySelector('a[href*="/p"]') || dCard.querySelector('a');
    
    // Si no encuentra clase de precio directa, busca el texto con signo $
    var pPrice = 'N/D';
    if (priceEl) {
        pPrice = priceEl.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    } else {
        var lines = dCard.innerText.split('\n').filter(function(s){ return s.trim().length > 0; });
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].indexOf('$') > -1) {
                pPrice = lines[i].trim();
                break;
            }
        }
    }

    var cardText = (dCard.innerText || '').toLowerCase();
    var isUnavailable = false;
    if (cardText.indexOf('agotado') > -1 || cardText.indexOf('sin stock') > -1 || cardText.indexOf('no disponible') > -1) {
        isUnavailable = true;
    }
    if (pPrice === 'N/D' || pPrice === '' || pPrice === '$ 0' || pPrice === '$ 0,00') {
        isUnavailable = true;
    }

    return JSON.stringify({
        name: nameEl ? nameEl.innerText.trim() : 'Producto Día %',
        price: pPrice,
        url: linkEl ? linkEl.href : window.location.href,
        stock: isUnavailable ? 'SIN STOCK' : 'DISPONIBLE'
    });
} else {
    return 'null';
}
dom finish

js var dData = JSON.parse(dom_result); if (dData) { dia_nom = dData.name; dia_pre = dData.price; dia_url = dData.url; dia_stock = dData.stock; }
echo [Día %] Extraído: `dia_nom` | `dia_pre` | `dia_stock`
write `csv_row([modo_actual, producto, dia_nom, dia_pre, "Día %", dia_url, fechaHoy, dia_stock])` to resultados.csv

echo [INFO] Finalizada la consulta para: `producto`
