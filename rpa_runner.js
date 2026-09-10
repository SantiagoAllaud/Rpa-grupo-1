// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// rpa_runner.js - Motor de Automatización RPA Visible con CDP Screencast
// ==============================================================================

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const validador = require('./validador.js');

const CSV_PATH = path.join(__dirname, 'resultados.csv');

// Detecta el ejecutable de Google Chrome en Windows
function getChromePath() {
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const p of paths) {
        if (p && fs.existsSync(p)) return p;
    }
    throw new Error('No se encontró Google Chrome o Edge en las rutas estándar del sistema.');
}

// Retardo asistido
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Tipeo progresivo humano
async function humanType(page, selector, text, delayMs = 70) {
    try {
        await page.waitForSelector(selector, { visible: true, timeout: 6000 });
        await page.click(selector);
        // Limpiar contenido previo si hubiera
        await page.evaluate(sel => {
            const el = document.querySelector(sel);
            if (el) el.value = '';
        }, selector);
        await page.type(selector, text, { delay: delayMs });
        await sleep(300);
    } catch (e) {
        // Fallback si el selector falla
        try {
            await page.keyboard.type(text, { delay: delayMs });
        } catch (err) {}
    }
}

// Scroll suave para visualización en el reproductor
async function smoothScroll(page, totalPixels = 800, steps = 3) {
    const stepPixels = Math.floor(totalPixels / steps);
    for (let i = 0; i < steps; i++) {
        await page.evaluate(px => window.scrollBy({ top: px, behavior: 'smooth' }), stepPixels);
        await sleep(400);
    }
}

// Determina unidad por defecto según valores comerciales típicos en Argentina
function determinarUnidadDefault(producto, unidadIngresada) {
    if (unidadIngresada && unidadIngresada.trim()) return unidadIngresada.trim();
    const p = producto.toLowerCase();
    if (p.includes('arroz')) return '500g';
    if (p.includes('fideos')) return '500g';
    if (p.includes('leche')) return '1L';
    if (p.includes('coca') || p.includes('gaseosa') || p.includes('secco') || p.includes('manaos') || p.includes('pepsi') || p.includes('sprite') || p.includes('fanta')) return '2L';
    if (p.includes('aceite')) return '1.5L';
    if (p.includes('yerba')) return '500g';
    if (p.includes('azucar') || p.includes('azúcar')) return '1kg';
    if (p.includes('cafe') || p.includes('café')) return '170g';
    if (p.includes('galletitas') || p.includes('galletas')) return '300g';
    if (p.includes('papel')) return '4 un.';
    const esLiquido = p.includes('agua') || p.includes('jugo') || p.includes('cerveza') || p.includes('vino') || p.includes('bebida');
    return esLiquido ? '2L' : '500g';
}

// Formato de fecha YYYY-MM-DD
function getFechaHoy() {
    const hoy = new Date();
    let m = (hoy.getMonth() + 1).toString();
    let d = hoy.getDate().toString();
    if (m.length < 2) m = '0' + m;
    if (d.length < 2) d = '0' + d;
    return `${hoy.getFullYear()}-${m}-${d}`;
}

// Asegura cabecera en resultados.csv
function asegurarCSV() {
    if (!fs.existsSync(CSV_PATH)) {
        const header = 'modo,producto_solicitado,nombre_encontrado,precio,supermercado,url,fecha,stock_status,cantidad,unidad\n';
        fs.writeFileSync(CSV_PATH, header, 'utf8');
    }
}

// Cierre agresivo y eliminación de modales de cookies (OneTrust, banners)
async function eliminarCookies(page) {
    try {
        await page.evaluate(() => {
            const selectorsBtn = [
                '#onetrust-accept-btn-handler',
                'button#onetrust-accept-btn-handler',
                '#onetrust-reject-all-handler',
                'button[id*="cookie"]',
                'button[class*="cookie"]',
                'button[aria-label*="Aceptar"]',
                '.vtex-modal__close-button'
            ];
            for (const sel of selectorsBtn) {
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.click();
                    break;
                }
            }
            const banners = [
                '#onetrust-banner-sdk',
                '#onetrust-consent-sdk',
                '.onetrust-pc-dark-filter',
                '#onetrust-style',
                '[class*="cookie-banner"]',
                '[class*="cookie-consent"]',
                '[id*="cookie-banner"]',
                '.vtex-modal__overlay',
                '.modal-backdrop'
            ];
            banners.forEach(b => {
                document.querySelectorAll(b).forEach(el => el.remove());
            });
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        });
    } catch (e) {}
}



// Función principal de ejecución RPA
async function runRPA({ modo = 'individual', items = [], onFrame = null, onStatus = null }) {
    asegurarCSV();
    const chromePath = getChromePath();
    const fechaHoy = getFechaHoy();

    if (onStatus) onStatus({ type: 'init', message: 'Iniciando navegador Google Chrome...' });

    let browser = null;
    let cdpSession = null;
    const resultadosSesion = [];

    try {
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: false, // Visible para screencast
            defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
            args: [
                '--window-size=1366,820',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-blink-features=AutomationControlled',
                '--lang=es-419,es'
            ]
        });

        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();
        await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

        // Conectar CDP Screencast en HD 720p nítido
        try {
            cdpSession = await page.target().createCDPSession();
            await cdpSession.send('Page.startScreencast', {
                format: 'jpeg',
                quality: 92,
                maxWidth: 1280,
                maxHeight: 720,
                everyNthFrame: 1
            });

            cdpSession.on('Page.screencastFrame', async ({ data, sessionId }) => {
                try {
                    await cdpSession.send('Page.screencastFrameAck', { sessionId });
                } catch (e) {}
                if (onFrame) onFrame(data);
            });

            if (onStatus) onStatus({ type: 'connected', message: 'Navegador RPA conectado y transmitiendo en vivo' });
        } catch (e) {
            console.error('[WARN] Error al iniciar screencast CDP:', e.message);
            if (onStatus) onStatus({ type: 'stream_warn', message: 'El RPA continúa ejecutándose pero la visualización en vivo no está disponible.' });
        }

        // Iterar por cada producto
        const totalItems = items.length;
        for (let i = 0; i < totalItems; i++) {
            const itemObj = items[i];
            const productoOriginal = (typeof itemObj === 'string') ? itemObj : itemObj.producto;
            const cantidad = (itemObj.cantidad && parseInt(itemObj.cantidad, 10) > 0) ? parseInt(itemObj.cantidad, 10) : 1;
            const unidad = determinarUnidadDefault(productoOriginal, itemObj.unidad);

            const prodClean = productoOriginal.replace(/"/g, '').replace(/'/g, '').trim();
            const prodUrl = encodeURIComponent(prodClean.replace(/,/g, ' ').replace(/\s+/g, ' '));
            const queryConfig = validador.obtenerConfiguracionBusqueda(prodClean);

            if (onStatus) {
                onStatus({
                    type: 'progress',
                    percent: Math.round((i / totalItems) * 70),
                    message: `[${i + 1}/${totalItems}] Buscando: "${prodClean}" (x${cantidad} ${unidad})`
                });
            }

            // ==============================================================
            // 1. CARREFOUR ARGENTINA
            // ==============================================================
            if (onStatus) onStatus({ type: 'log', message: `[Carrefour] Ingresando a la tienda para buscar: "${prodClean}"` });
            try {
                await page.goto('https://www.carrefour.com.ar', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await eliminarCookies(page);
                await sleep(1500);
                await eliminarCookies(page);

                // Clic en el buscador y tipeo visible
                const searchSelector = 'input[type="search"], input[placeholder*="buscar" i], input[placeholder*="Buscar" i], .vtex-styleguide-9-x-input';
                const foundInput = await page.$(searchSelector);
                if (foundInput) {
                    await humanType(page, searchSelector, prodClean, 75);
                    await page.keyboard.press('Enter');
                    await sleep(4000);
                    await eliminarCookies(page);
                } else {
                    await page.goto(`https://www.carrefour.com.ar/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await eliminarCookies(page);
                    await sleep(3500);
                }

                // Scroll suave
                await smoothScroll(page, 700, 3);
                await eliminarCookies(page);

                // Extracción DOM Carrefour con validación general de todas las categorías y marcas
                const cData = await page.evaluate((config) => {
                    function cleanText(s) {
                        if (!s) return '';
                        return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
                    }
                    function contienePalabra(texto, palabra) {
                        if (!texto || !palabra) return false;
                        if (palabra.length <= 4) {
                            var rx = new RegExp('(?:^|\\s)' + palabra.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:$|\\s)', 'i');
                            return rx.test(texto);
                        }
                        return texto.indexOf(palabra) > -1;
                    }

                    var cards = Array.from(document.querySelectorAll('article, [class*="product-summary"], [class*="vtex-search-result-3-x-galleryItem"]')).slice(0, 15);
                    if (cards.length === 0) return null;

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
                        if (priceVal === 'N/D' || priceVal === '' || priceVal === '$ 0' || priceVal === '$ 0,00' || priceVal === '$0') unavail = true;

                        var nClean = cleanText(nameVal);

                        // 1. Incompatibilidad de categoría
                        if (config.terminosIncompatibles && config.terminosIncompatibles.length > 0) {
                            var tieneInc = false;
                            for (var k = 0; k < config.terminosIncompatibles.length; k++) {
                                if (contienePalabra(nClean, config.terminosIncompatibles[k])) {
                                    tieneInc = true;
                                    break;
                                }
                            }
                            if (tieneInc) continue;
                        }

                        // 2. Coincidencia de categoría
                        if (config.terminosValidos && config.terminosValidos.length > 0) {
                            var coincideCat = config.terminosValidos.some(function(t) {
                                return contienePalabra(nClean, t);
                            });
                            if (!coincideCat) continue;
                        }

                        // 3. Marca / calificador requerido
                        if (config.palabrasRequeridas && config.palabrasRequeridas.length > 0) {
                            var faltaReq = false;
                            for (var p = 0; p < config.palabrasRequeridas.length; p++) {
                                if (!contienePalabra(nClean, config.palabrasRequeridas[p])) {
                                    faltaReq = true;
                                    break;
                                }
                            }
                            if (faltaReq) continue;
                        }

                        // 4. Variante requerida
                        if (config.variantesRequeridas && config.variantesRequeridas.length > 0) {
                            var faltaVar = false;
                            for (var v = 0; v < config.variantesRequeridas.length; v++) {
                                if (!contienePalabra(nClean, config.variantesRequeridas[v])) {
                                    faltaVar = true;
                                    break;
                                }
                            }
                            if (faltaVar) continue;
                        }

                        var score = 0;
                        if (nClean.indexOf(config.queryNormalizada) > -1) score += 100;
                        var qWords = config.queryNormalizada.split(/\s+/).filter(function(w) { return w.length >= 2; });
                        for (var w = 0; w < qWords.length; w++) {
                            if (nClean.indexOf(qWords[w]) > -1) score += 25;
                        }
                        if (unavail) score -= 20;

                        candidates.push({
                            name: nameVal,
                            price: priceVal,
                            url: urlVal,
                            stock: unavail ? 'SIN STOCK' : 'DISPONIBLE',
                            score: score
                        });
                    }

                    if (candidates.length === 0) return null;
                    candidates.sort((a, b) => b.score - a.score);
                    return candidates[0];
                }, queryConfig);

                let cNom = cData ? cData.name : 'No encontrado';
                let cPre = cData ? cData.price : 'N/D';
                let cUrl = cData ? cData.url : page.url();
                let cStk = cData ? cData.stock : 'NO ENCONTRADO';
                let cPreNum = validador.parsePrecio(cPre);

                // Doble validación en Node.js con validador semántico
                if (cData && cNom !== 'No encontrado') {
                    const validacion = validador.validarCoincidencia(prodClean, {
                        nombre: cNom,
                        precioStr: cPre,
                        stockRaw: cStk
                    });
                    if (!validacion.valido) {
                        cNom = 'No encontrado';
                        cPre = 'N/D';
                        cStk = 'NO ENCONTRADO';
                        cPreNum = null;
                    }
                }

                resultadosSesion.push({
                    modo,
                    producto_solicitado: prodClean,
                    nombre_encontrado: cNom,
                    precio: cPreNum,
                    precioStr: cPre,
                    supermercado: 'Carrefour',
                    url: cUrl,
                    fecha: fechaHoy,
                    stock_status: cStk,
                    cantidad,
                    unidad,
                    valido: cPreNum !== null && cStk === 'DISPONIBLE'
                });

                // Escribir fila CSV
                const rowC = `"${modo}","${prodClean}","${cNom.replace(/"/g, '""')}","${cPre}","Carrefour","${cUrl}","${fechaHoy}","${cStk}",${cantidad},"${unidad}"\n`;
                fs.appendFileSync(CSV_PATH, rowC, 'utf8');
                if (onStatus) onStatus({ type: 'log', message: `[Carrefour] Extraído: ${cNom} | ${cPre} | ${cStk}` });
            } catch (e) {
                console.error('[ERROR Carrefour]:', e.message);
                const rowErr = `"${modo}","${prodClean}","No encontrado","N/D","Carrefour","${page.url()}","${fechaHoy}","ERROR",${cantidad},"${unidad}"\n`;
                fs.appendFileSync(CSV_PATH, rowErr, 'utf8');
            }

            // ==============================================================
            // 2. COTO DIGITAL
            // ==============================================================
            if (onStatus) onStatus({ type: 'log', message: `[COTO] Ingresando a la tienda para buscar: "${prodClean}"` });
            try {
                await page.goto('https://www.coto.com.ar', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await eliminarCookies(page);
                await sleep(1500);
                await eliminarCookies(page);

                const cotoInput = await page.$('input#search, input[placeholder*="Buscar" i], input[type="search"]');
                if (cotoInput) {
                    await humanType(page, 'input#search, input[placeholder*="Buscar" i], input[type="search"]', prodClean, 75);
                    await page.keyboard.press('Enter');
                    await sleep(4000);
                    await eliminarCookies(page);
                } else {
                    await page.goto(`https://www.coto.com.ar/productos/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await eliminarCookies(page);
                    await sleep(3500);
                }

                await smoothScroll(page, 700, 3);
                await eliminarCookies(page);

                // Extracción DOM COTO con validación general de todas las categorías y marcas
                const ctData = await page.evaluate((config) => {
                    function cleanText(s) {
                        if (!s) return '';
                        return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
                    }
                    function contienePalabra(texto, palabra) {
                        if (!texto || !palabra) return false;
                        if (palabra.length <= 4) {
                            var rx = new RegExp('(?:^|\\s)' + palabra.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:$|\\s)', 'i');
                            return rx.test(texto);
                        }
                        return texto.indexOf(palabra) > -1;
                    }

                    var items = Array.from(document.querySelectorAll('constructor-result-item')).slice(0, 15);
                    if (items.length === 0) return null;

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
                        if (priceVal === 'N/D' || priceVal === '' || priceVal === '$0' || priceVal === '$0,00' || priceVal === '$ 0') unavail = true;

                        var nClean = cleanText(nameVal);

                        // 1. Incompatibilidad de categoría
                        if (config.terminosIncompatibles && config.terminosIncompatibles.length > 0) {
                            var tieneInc = false;
                            for (var k = 0; k < config.terminosIncompatibles.length; k++) {
                                if (contienePalabra(nClean, config.terminosIncompatibles[k])) {
                                    tieneInc = true;
                                    break;
                                }
                            }
                            if (tieneInc) continue;
                        }

                        // 2. Coincidencia de categoría
                        if (config.terminosValidos && config.terminosValidos.length > 0) {
                            var coincideCat = config.terminosValidos.some(function(t) {
                                return contienePalabra(nClean, t);
                            });
                            if (!coincideCat) continue;
                        }

                        // 3. Marca / calificador requerido
                        if (config.palabrasRequeridas && config.palabrasRequeridas.length > 0) {
                            var faltaReq = false;
                            for (var p = 0; p < config.palabrasRequeridas.length; p++) {
                                if (!contienePalabra(nClean, config.palabrasRequeridas[p])) {
                                    faltaReq = true;
                                    break;
                                }
                            }
                            if (faltaReq) continue;
                        }

                        // 4. Variante requerida
                        if (config.variantesRequeridas && config.variantesRequeridas.length > 0) {
                            var faltaVar = false;
                            for (var v = 0; v < config.variantesRequeridas.length; v++) {
                                if (!contienePalabra(nClean, config.variantesRequeridas[v])) {
                                    faltaVar = true;
                                    break;
                                }
                            }
                            if (faltaVar) continue;
                        }

                        var score = 0;
                        if (nClean.indexOf(config.queryNormalizada) > -1) score += 100;
                        var qWords = config.queryNormalizada.split(/\s+/).filter(function(w) { return w.length >= 2; });
                        for (var w = 0; w < qWords.length; w++) {
                            if (nClean.indexOf(qWords[w]) > -1) score += 25;
                        }
                        if (unavail) score -= 20;

                        candidates.push({
                            name: nameVal,
                            price: priceVal,
                            url: urlVal,
                            stock: unavail ? 'SIN STOCK' : 'DISPONIBLE',
                            score: score
                        });
                    }

                    if (candidates.length === 0) return null;
                    candidates.sort((a, b) => b.score - a.score);
                    return candidates[0];
                }, queryConfig);

                let ctNom = ctData ? ctData.name : 'No encontrado';
                let ctPre = ctData ? ctData.price : 'N/D';
                let ctUrl = ctData ? ctData.url : page.url();
                let ctStk = ctData ? ctData.stock : 'NO ENCONTRADO';
                let ctPreNum = validador.parsePrecio(ctPre);

                // Doble validación en Node.js con validador semántico
                if (ctData && ctNom !== 'No encontrado') {
                    const validacion = validador.validarCoincidencia(prodClean, {
                        nombre: ctNom,
                        precioStr: ctPre,
                        stockRaw: ctStk
                    });
                    if (!validacion.valido) {
                        ctNom = 'No encontrado';
                        ctPre = 'N/D';
                        ctStk = 'NO ENCONTRADO';
                        ctPreNum = null;
                    }
                }

                resultadosSesion.push({
                    modo,
                    producto_solicitado: prodClean,
                    nombre_encontrado: ctNom,
                    precio: ctPreNum,
                    precioStr: ctPre,
                    supermercado: 'COTO',
                    url: ctUrl,
                    fecha: fechaHoy,
                    stock_status: ctStk,
                    cantidad,
                    unidad,
                    valido: ctPreNum !== null && ctStk === 'DISPONIBLE'
                });

                const rowCt = `"${modo}","${prodClean}","${ctNom.replace(/"/g, '""')}","${ctPre}","COTO","${ctUrl}","${fechaHoy}","${ctStk}",${cantidad},"${unidad}"\n`;
                fs.appendFileSync(CSV_PATH, rowCt, 'utf8');
                if (onStatus) onStatus({ type: 'log', message: `[COTO] Extraído: ${ctNom} | ${ctPre} | ${ctStk}` });
            } catch (e) {
                console.error('[ERROR COTO]:', e.message);
                const rowErr = `"${modo}","${prodClean}","No encontrado","N/D","COTO","${page.url()}","${fechaHoy}","ERROR",${cantidad},"${unidad}"\n`;
                fs.appendFileSync(CSV_PATH, rowErr, 'utf8');
            }

            // ==============================================================
            // 3. DÍA %
            // ==============================================================
            if (onStatus) onStatus({ type: 'log', message: `[Día %] Ingresando a la tienda para buscar: "${prodClean}"` });
            try {
                await page.goto('https://diaonline.supermercadosdia.com.ar', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await eliminarCookies(page);
                await sleep(1500);
                await eliminarCookies(page);

                const diaInput = await page.$('input[placeholder*="Buscar" i], input[type="search"]');
                if (diaInput) {
                    await humanType(page, 'input[placeholder*="Buscar" i], input[type="search"]', prodClean, 75);
                    await page.keyboard.press('Enter');
                    await sleep(4000);
                    await eliminarCookies(page);
                } else {
                    await page.goto(`https://diaonline.supermercadosdia.com.ar/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await eliminarCookies(page);
                    await sleep(3500);
                }

                await smoothScroll(page, 700, 3);
                await eliminarCookies(page);

                // Extracción DOM Día % con validación general de todas las categorías y marcas
                const dData = await page.evaluate((config) => {
                    function cleanText(s) {
                        if (!s) return '';
                        return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
                    }
                    function contienePalabra(texto, palabra) {
                        if (!texto || !palabra) return false;
                        if (palabra.length <= 4) {
                            var rx = new RegExp('(?:^|\\s)' + palabra.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:$|\\s)', 'i');
                            return rx.test(texto);
                        }
                        return texto.indexOf(palabra) > -1;
                    }

                    var dCards = Array.from(document.querySelectorAll('article, [class*="product-summary"]')).slice(0, 15);
                    if (dCards.length === 0) return null;

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
                            var lines = c.innerText.split('\n').filter(s => s.trim().length > 0);
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
                        if (priceVal === 'N/D' || priceVal === '' || priceVal === '$ 0' || priceVal === '$ 0,00' || priceVal === '$0') unavail = true;

                        var nClean = cleanText(nameVal);

                        // 1. Incompatibilidad de categoría
                        if (config.terminosIncompatibles && config.terminosIncompatibles.length > 0) {
                            var tieneInc = false;
                            for (var k = 0; k < config.terminosIncompatibles.length; k++) {
                                if (contienePalabra(nClean, config.terminosIncompatibles[k])) {
                                    tieneInc = true;
                                    break;
                                }
                            }
                            if (tieneInc) continue;
                        }

                        // 2. Coincidencia de categoría
                        if (config.terminosValidos && config.terminosValidos.length > 0) {
                            var coincideCat = config.terminosValidos.some(function(t) {
                                return contienePalabra(nClean, t);
                            });
                            if (!coincideCat) continue;
                        }

                        // 3. Marca / calificador requerido
                        if (config.palabrasRequeridas && config.palabrasRequeridas.length > 0) {
                            var faltaReq = false;
                            for (var p = 0; p < config.palabrasRequeridas.length; p++) {
                                if (!contienePalabra(nClean, config.palabrasRequeridas[p])) {
                                    faltaReq = true;
                                    break;
                                }
                            }
                            if (faltaReq) continue;
                        }

                        // 4. Variante requerida
                        if (config.variantesRequeridas && config.variantesRequeridas.length > 0) {
                            var faltaVar = false;
                            for (var v = 0; v < config.variantesRequeridas.length; v++) {
                                if (!contienePalabra(nClean, config.variantesRequeridas[v])) {
                                    faltaVar = true;
                                    break;
                                }
                            }
                            if (faltaVar) continue;
                        }

                        var score = 0;
                        if (nClean.indexOf(config.queryNormalizada) > -1) score += 100;
                        var qWords = config.queryNormalizada.split(/\s+/).filter(function(w) { return w.length >= 2; });
                        for (var w = 0; w < qWords.length; w++) {
                            if (nClean.indexOf(qWords[w]) > -1) score += 25;
                        }
                        if (unavail) score -= 20;

                        candidates.push({
                            name: nameVal,
                            price: priceVal,
                            url: urlVal,
                            stock: unavail ? 'SIN STOCK' : 'DISPONIBLE',
                            score: score
                        });
                    }

                    if (candidates.length === 0) return null;
                    candidates.sort((a, b) => b.score - a.score);
                    return candidates[0];
                }, queryConfig);

                let dNom = dData ? dData.name : 'No encontrado';
                let dPre = dData ? dData.price : 'N/D';
                let dUrl = dData ? dData.url : page.url();
                let dStk = dData ? dData.stock : 'NO ENCONTRADO';
                let dPreNum = validador.parsePrecio(dPre);

                // Doble validación en Node.js con validador semántico
                if (dData && dNom !== 'No encontrado') {
                    const validacion = validador.validarCoincidencia(prodClean, {
                        nombre: dNom,
                        precioStr: dPre,
                        stockRaw: dStk
                    });
                    if (!validacion.valido) {
                        dNom = 'No encontrado';
                        dPre = 'N/D';
                        dStk = 'NO ENCONTRADO';
                        dPreNum = null;
                    }
                }

                resultadosSesion.push({
                    modo,
                    producto_solicitado: prodClean,
                    nombre_encontrado: dNom,
                    precio: dPreNum,
                    precioStr: dPre,
                    supermercado: 'Día %',
                    url: dUrl,
                    fecha: fechaHoy,
                    stock_status: dStk,
                    cantidad,
                    unidad,
                    valido: dPreNum !== null && dStk === 'DISPONIBLE'
                });

                const rowD = `"${modo}","${prodClean}","${dNom.replace(/"/g, '""')}","${dPre}","Día %","${dUrl}","${fechaHoy}","${dStk}",${cantidad},"${unidad}"\n`;
                fs.appendFileSync(CSV_PATH, rowD, 'utf8');
                if (onStatus) onStatus({ type: 'log', message: `[Día %] Extraído: ${dNom} | ${dPre} | ${dStk}` });
            } catch (e) {
                console.error('[ERROR Día %]:', e.message);
                const rowErr = `"${modo}","${prodClean}","No encontrado","N/D","Día %","${page.url()}","${fechaHoy}","ERROR",${cantidad},"${unidad}"\n`;
                fs.appendFileSync(CSV_PATH, rowErr, 'utf8');
            }
        }

        // ==============================================================
        // FASE 2: GENERACIÓN DEL REPORTE EXCEL REAL (ExcelJS)
        // ==============================================================
        if (onStatus) {
            onStatus({
                type: 'progress',
                percent: 90,
                message: 'Generando reporte_supermercados.xlsx con ExcelJS...'
            });
            onStatus({ type: 'log', message: 'Generando reporte_supermercados.xlsx...' });
        }

        try {
            execSync('node generar_excel.js', { cwd: __dirname, stdio: 'pipe' });
            if (onStatus) onStatus({ type: 'log', message: '✓ Archivo Excel generado: reporte_supermercados.xlsx (listo para abrir o descargar)' });
        } catch (e) {
            console.error('[ERROR generando Excel]:', e.message);
            if (onStatus) onStatus({ type: 'log', message: `[WARN] Error generando Excel: ${e.message}` });
        }

        await sleep(1000);

        if (onStatus) {
            onStatus({
                type: 'finished',
                percent: 100,
                message: '✓ RPA FINALIZADO. Reporte Excel real disponible.'
            });
        }

    } finally {
        // Limpieza estricta de conexiones y procesos
        if (cdpSession) {
            try {
                await cdpSession.send('Page.stopScreencast');
                await cdpSession.detach();
            } catch (e) {}
        }
        if (browser) {
            try {
                await browser.close();
            } catch (e) {}
        }
    }

    return resultadosSesion;
}

module.exports = {
    runRPA,
    getChromePath
};
