// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// rpa_runner.js - Motor de Automatización RPA 100% Visible con Chrome y Mouse Real
// ==============================================================================

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const validador = require('./validador.js');

const CSV_PATH = path.join(__dirname, 'resultados.csv');
const MOUSE_HELPER_PATH = path.join(__dirname, 'mouse_helper.exe');

// Configuraciones globales de Demostración
const CONFIG = {
    DEMO_MODE: true,
    TYPING_DELAY: 50,          // 0.05 segundos por carácter (50ms)
    MOUSE_MOVE_DURATION: 600,  // 0.6 segundos por movimiento (600ms)
    PAUSE_AFTER_PAGE_LOAD: 2000,
    PAUSE_BEFORE_CLICK: 500,
    PAUSE_AFTER_CLICK: 1000,
    PAUSE_AFTER_SEARCH: 2500,
    PAUSE_AFTER_FILTER: 2000
};

// Control de aborto global e instantáneo (Kill-Switch)
let isAborted = false;
let activeBrowser = null;

function abortCurrentRun() {
    isAborted = true;
    try {
        require('child_process').execSync('taskkill /F /IM mouse_helper.exe', { windowsHide: true, stdio: 'ignore' });
    } catch (e) {}
    if (activeBrowser) {
        try {
            activeBrowser.close().catch(() => {});
        } catch (e) {}
        activeBrowser = null;
    }
}

function checkAborted() {
    if (isAborted) {
        throw new Error('RPA_ABORTED_BY_USER');
    }
}

// ==============================================================================
// MOTOR DE CURSOR VIRTUAL INDEPENDIENTE (DUAL-POINTER ENGINE)
// Deja el mouse físico del usuario 100% libre. El bot opera con su propio cursor visual.
// ==============================================================================

const VIRTUAL_CURSOR_SCRIPT = `
(function() {
    if (window.__rpa_cursor_installed) return;
    window.__rpa_cursor_installed = true;

    function buildCursorUI() {
        if (document.getElementById('rpa-virtual-cursor-root')) return;

        const root = document.createElement('div');
        root.id = 'rpa-virtual-cursor-root';
        root.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;font-family:Inter,-apple-system,sans-serif;';

        // Puntero Virtual de Alta Definición
        const cursor = document.createElement('div');
        cursor.id = 'rpa-virtual-cursor';
        cursor.style.cssText = 'position:fixed;top:0;left:0;width:28px;height:28px;pointer-events:none;z-index:2147483647;will-change:transform;';
        cursor.innerHTML = \`
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.63-4.63c.1-.1.22-.15.35-.15h6.63c.45 0 .67-.54.35-.85L5.5 3.21z" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M11 16l4 8 2.5-1.2-4-8" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="#ffffff"/>
                <circle cx="6" cy="4" r="2.8" fill="#6366f1" />
            </svg>
            <div id="rpa-cursor-ripple" style="position:absolute;top:0;left:0;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:2.5px solid #6366f1;opacity:0;transform:scale(0.2);pointer-events:none;"></div>
            <div id="rpa-cursor-badge" style="position:absolute;top:20px;left:14px;background:#4f46e5;color:#ffffff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.4);white-space:nowrap;">BOT RPA</div>
        \`;

        root.appendChild(cursor);
        (document.body || document.documentElement).appendChild(root);

        window.__rpa_pos = window.__rpa_pos || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        cursor.style.transform = \`translate(\${window.__rpa_pos.x}px, \${window.__rpa_pos.y}px)\`;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildCursorUI);
    } else {
        buildCursorUI();
    }

    window.__rpa_pulse = function() {
        const ripple = document.getElementById('rpa-cursor-ripple');
        if (!ripple) return;
        ripple.style.transition = 'none';
        ripple.style.transform = 'scale(0.2)';
        ripple.style.opacity = '1';
        setTimeout(() => {
            ripple.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
            ripple.style.transform = 'scale(2.4)';
            ripple.style.opacity = '0';
        }, 20);
    };

    window.__rpa_move = function(targetX, targetY, durationMs) {
        return new Promise((resolve) => {
            const cursor = document.getElementById('rpa-virtual-cursor');
            if (!cursor) return resolve();
            window.__rpa_pos = window.__rpa_pos || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            const startX = window.__rpa_pos.x;
            const startY = window.__rpa_pos.y;
            const startTime = performance.now();
            const dur = Math.max(durationMs || 500, 50);

            const dist = Math.hypot(targetX - startX, targetY - startY);
            const dev = Math.min(dist * 0.2, 70);
            const cp1X = startX + (targetX - startX) * 0.25 + (Math.random() - 0.5) * dev;
            const cp1Y = startY + (targetY - startY) * 0.25 + (Math.random() - 0.5) * dev;
            const cp2X = startX + (targetX - startX) * 0.75 + (Math.random() - 0.5) * dev;
            const cp2Y = startY + (targetY - startY) * 0.75 + (Math.random() - 0.5) * dev;

            function step(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / dur, 1);
                const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                const u = 1 - t;

                const curX = u*u*u*startX + 3*u*u*t*cp1X + 3*u*t*t*cp2X + t*t*t*targetX;
                const curY = u*u*u*startY + 3*u*u*t*cp1Y + 3*u*t*t*cp2Y + t*t*t*targetY;

                window.__rpa_pos.x = curX;
                window.__rpa_pos.y = curY;
                cursor.style.transform = \`translate(\${curX}px, \${curY}px)\`;

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    window.__rpa_pos.x = targetX;
                    window.__rpa_pos.y = targetY;
                    cursor.style.transform = \`translate(\${targetX}px, \${targetY}px)\`;
                    resolve();
                }
            }
            requestAnimationFrame(step);
        });
    };
})();
`;

async function asegurarCursorEnPagina(page) {
    try {
        await page.evaluate((script) => {
            if (!document.getElementById('rpa-virtual-cursor-root')) {
                const s = document.createElement('script');
                s.textContent = script;
                (document.head || document.documentElement).appendChild(s);
            }
        }, VIRTUAL_CURSOR_SCRIPT);
    } catch (e) {}
}

async function getElementViewportPos(page, selector) {
    try {
        return await page.evaluate((sel) => {
            const elements = Array.from(document.querySelectorAll(sel));
            if (!elements || elements.length === 0) return null;

            let el = elements.find(e => {
                const r = e.getBoundingClientRect();
                return r.width > 20 && r.height > 10 && e.offsetParent !== null;
            });
            if (!el) {
                el = elements.find(e => {
                    const r = e.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                });
            }
            if (!el) return null;

            const curR = el.getBoundingClientRect();
            if (curR.top < 0 || curR.bottom > window.innerHeight || curR.left < 0 || curR.right > window.innerWidth) {
                el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
            }

            const r = el.getBoundingClientRect();
            return {
                x: Math.round(r.left + r.width / 2),
                y: Math.round(r.top + r.height / 2)
            };
        }, selector);
    } catch (e) {
        return null;
    }
}

async function virtualMove(page, selectorOrCoords, durationMs = CONFIG.MOUSE_MOVE_DURATION) {
    checkAborted();
    let x, y;
    if (typeof selectorOrCoords === 'string') {
        const pos = await getElementViewportPos(page, selectorOrCoords);
        if (!pos) return false;
        x = pos.x;
        y = pos.y;
    } else if (selectorOrCoords && selectorOrCoords.x !== undefined) {
        x = selectorOrCoords.x;
        y = selectorOrCoords.y;
    } else {
        return false;
    }

    await page.evaluate((tx, ty, dur) => {
        return window.__rpa_move ? window.__rpa_move(tx, ty, dur) : Promise.resolve();
    }, x, y, durationMs);
    return true;
}

async function virtualClick(page, selector, durationMs = CONFIG.MOUSE_MOVE_DURATION) {
    checkAborted();
    const pos = await getElementViewportPos(page, selector);
    if (!pos) return false;

    await virtualMove(page, pos, durationMs);
    await page.evaluate(() => { if (window.__rpa_pulse) window.__rpa_pulse(); });
    await sleep(CONFIG.PAUSE_BEFORE_CLICK);

    await page.evaluate((sel) => {
        const elements = Array.from(document.querySelectorAll(sel));
        const el = elements.find(e => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        }) || elements[0];
        if (el) {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            try { el.focus(); } catch(e) {}
        }
    }, selector).catch(() => {});

    await sleep(CONFIG.PAUSE_AFTER_CLICK);
    return true;
}

async function virtualType(page, selector, text, delayMs = CONFIG.TYPING_DELAY, durationMs = CONFIG.MOUSE_MOVE_DURATION) {
    checkAborted();
    const pos = await getElementViewportPos(page, selector);
    if (!pos) return false;

    await virtualMove(page, pos, durationMs);
    await page.evaluate(() => { if (window.__rpa_pulse) window.__rpa_pulse(); });
    await sleep(CONFIG.PAUSE_BEFORE_CLICK);

    for (let i = 0; i < text.length; i++) {
        checkAborted();
        const char = text[i];
        await page.evaluate((sel, c) => {
            const inputs = Array.from(document.querySelectorAll(sel));
            const inp = inputs.find(el => {
                const r = el.getBoundingClientRect();
                return r.width > 20 && r.height > 10;
            }) || inputs[0];
            if (!inp) return;
            inp.focus();
            inp.value = (inp.value || '') + c;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new KeyboardEvent('keydown', { key: c, bubbles: true }));
            inp.dispatchEvent(new KeyboardEvent('keyup', { key: c, bubbles: true }));
        }, selector, char).catch(() => {});
        await sleep(Math.max(delayMs, 25));
    }

    await page.evaluate((sel) => {
        const inputs = Array.from(document.querySelectorAll(sel));
        const inp = inputs.find(el => {
            const r = el.getBoundingClientRect();
            return r.width > 20 && r.height > 10;
        }) || inputs[0];
        if (inp) inp.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector).catch(() => {});

    await sleep(CONFIG.PAUSE_AFTER_CLICK);
    return true;
}

async function virtualNav(page, targetUrl, delayMs = CONFIG.TYPING_DELAY) {
    checkAborted();
    // 1. Desplazar cursor virtual hacia arriba indicando la navegación
    await page.evaluate(() => {
        if (window.__rpa_move) {
            window.__rpa_move(window.innerWidth * 0.45, 20, 400);
        }
    }).catch(() => {});
    await sleep(200);

    // 2. Escribir la URL en la barra de direcciones real de Google Chrome (Ctrl+L) sin mover el mouse físico del usuario
    try {
        if (fs.existsSync(MOUSE_HELPER_PATH)) {
            spawnSync(MOUSE_HELPER_PATH, ['nav', targetUrl, Math.max(delayMs, 25).toString()], { windowsHide: true, stdio: 'ignore' });
        }
    } catch (e) {}

    // 3. Esperar navegación provocada por el Enter en la barra de direcciones o asegurar con page.goto
    let arrived = false;
    for (let t = 0; t < 30; t++) {
        await sleep(200);
        const curUrl = page.url();
        if (curUrl.includes('carrefour.com.ar') || curUrl.includes('coto.com.ar') || curUrl.includes('supermercadosdia.com.ar')) {
            arrived = true;
            break;
        }
    }
    if (!arrived) {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
    }

    await sleep(CONFIG.PAUSE_AFTER_PAGE_LOAD);
    await asegurarCursorEnPagina(page);
    await eliminarCookies(page);
}

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
    throw new Error('No se encontró Google Chrome en las rutas estándar del sistema.');
}

// Pausa no bloqueante e interrumpible cada 50ms si el usuario cierra el navegador o frontend
async function sleep(ms) {
    const interval = 50;
    let elapsed = 0;
    while (elapsed < ms) {
        checkAborted();
        const chunk = Math.min(interval, ms - elapsed);
        await new Promise(resolve => setTimeout(resolve, chunk));
        elapsed += chunk;
    }
}

// Scroll suave para visualización
async function smoothScroll(page, totalPixels = 600, steps = 3) {
    const stepPixels = Math.floor(totalPixels / steps);
    for (let i = 0; i < steps; i++) {
        await page.evaluate(px => window.scrollBy({ top: px, behavior: 'smooth' }), stepPixels);
        await sleep(400);
    }
}

function getFechaHoy() {
    const hoy = new Date();
    let m = (hoy.getMonth() + 1).toString();
    let d = hoy.getDate().toString();
    if (m.length < 2) m = '0' + m;
    if (d.length < 2) d = '0' + d;
    return `${hoy.getFullYear()}-${m}-${d}`;
}

function asegurarCSV() {
    if (!fs.existsSync(CSV_PATH)) {
        const header = 'modo,producto_solicitado,nombre_encontrado,precio,supermercado,url,fecha,stock_status,cantidad,unidad\n';
        fs.writeFileSync(CSV_PATH, header, 'utf8');
    }
}

// Eliminar modales de cookies, códigos postales y filtros oscuros
async function eliminarCookies(page) {
    try {
        await page.evaluate(() => {
            const selectorsBtn = [
                '#onetrust-accept-btn-handler',
                'button#onetrust-accept-btn-handler',
                '#onetrust-reject-all-handler',
                'button[id*="cookie" i]',
                'button[class*="cookie" i]',
                'button[aria-label*="Aceptar" i]',
                'button[aria-label*="Cerrar" i]',
                'button[aria-label*="Close" i]',
                '.vtex-modal__close-button',
                'button.close',
                '[class*="close-button" i]'
            ];
            for (const sel of selectorsBtn) {
                const btns = document.querySelectorAll(sel);
                btns.forEach(b => {
                    try { b.click(); } catch(e){}
                });
            }
            const banners = [
                '#onetrust-banner-sdk',
                '#onetrust-consent-sdk',
                '.onetrust-pc-dark-filter',
                '[class*="cookie-banner"]',
                '[class*="cookie-consent"]',
                '.vtex-modal__overlay',
                'div[class*="backdrop"]',
                'div[class*="modal-backdrop"]',
                'div[class*="overlay"]'
            ];
            banners.forEach(b => {
                document.querySelectorAll(b).forEach(el => {
                    try { el.remove(); } catch(e){}
                });
            });
            document.body.style.overflow = 'auto';
        });
    } catch (e) {}
}

function determinarUnidadDefault(producto, unidadIngresada) {
    if (unidadIngresada && unidadIngresada.trim()) return unidadIngresada.trim();
    const p = producto.toLowerCase();
    if (p.includes('arroz') || p.includes('fideos')) return '500g';
    if (p.includes('leche')) return '1L';
    if (p.includes('coca') || p.includes('gaseosa') || p.includes('secco') || p.includes('manaos') || p.includes('pepsi')) return '2L';
    if (p.includes('aceite')) return '1.5L';
    if (p.includes('yerba')) return '500g';
    if (p.includes('azucar') || p.includes('azúcar')) return '1kg';
    if (p.includes('cafe') || p.includes('café')) return '170g';
    if (p.includes('galletitas')) return '300g';
    if (p.includes('papel')) return '4 un.';
    return '500g';
}

// Función principal de ejecución RPA
async function runRPA({
    modo = 'individual',
    items = [],
    demoMode = CONFIG.DEMO_MODE,
    typingDelay = CONFIG.TYPING_DELAY,
    mouseDuration = CONFIG.MOUSE_MOVE_DURATION,
    onFrame = null,
    onStatus = null
}) {
    isAborted = false;
    asegurarCSV();
    const chromePath = getChromePath();
    const fechaHoy = getFechaHoy();

    const isDemo = demoMode !== undefined ? demoMode : CONFIG.DEMO_MODE;
    const currentTypingDelay = typingDelay || CONFIG.TYPING_DELAY;
    const currentMouseDuration = mouseDuration || CONFIG.MOUSE_MOVE_DURATION;

    if (onStatus) {
        onStatus({
            type: 'init',
            message: `Iniciando Google Chrome (Modo Demostración: ${isDemo ? 'ACTIVADO' : 'RÁPIDO'})...`
        });
    }

    let browser = null;
    const resultadosSesion = [];

    try {
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: false, // 100% VISIBLE en el escritorio del usuario
            defaultViewport: null, // Ocupa la ventana completa
            args: [
                '--start-maximized',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-blink-features=AutomationControlled',
                '--lang=es-419,es',
                'https://www.google.com' // INICIA SIEMPRE EN EL BUSCADOR DE GOOGLE
            ]
        });

        activeBrowser = browser;

        // Kill-switch: Si el usuario cierra la ventana de Chrome, abortar inmediatamente el proceso
        browser.on('disconnected', () => {
            console.log('[RPA] Navegador Chrome desconectado/cerrado por el usuario.');
            abortCurrentRun();
        });

        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();

        page.on('close', () => {
            console.log('[RPA] Pestaña de Chrome cerrada por el usuario.');
            abortCurrentRun();
        });

        checkAborted();

        if (isDemo) {
            // Registrar motor de cursor virtual persistente en cada navegación
            await page.evaluateOnNewDocument(VIRTUAL_CURSOR_SCRIPT);
            await sleep(800);
            await asegurarCursorEnPagina(page);
        }

        if (onStatus) onStatus({ type: 'connected', message: 'Navegador iniciado en Google (https://www.google.com) con cursor virtual autónomo visible.' });

        if (isDemo) {
            // Pausa visible en Google antes de escribir la primera URL
            await sleep(1500);
        }

        const totalItems = items.length;

        for (let i = 0; i < totalItems; i++) {
            checkAborted();
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
            try {
                checkAborted();
                if (onStatus) {
                    onStatus({ type: 'log', message: '[SUPERMERCADO 1] Escribiendo URL en barra de direcciones: https://www.carrefour.com.ar...' });
                }

                if (isDemo) {
                    // Movimiento visible hacia la barra de direcciones superior y tipeo letra por letra
                    await virtualNav(page, 'https://www.carrefour.com.ar', currentTypingDelay);

                    // Búsqueda del Producto visible
                    if (onStatus) onStatus({ type: 'log', message: `[SUPERMERCADO 1] Buscando producto: "${prodClean}"...` });
                    const searchSel = 'input[id*="downshift"], input.vtex-styleguide-9-x-input, input[placeholder*="Buscá" i], input[placeholder*="buscan" i], input[type="search"]';
                    await page.waitForSelector(searchSel, { timeout: 8000 }).catch(() => {});
                    
                    const typedOk = await virtualType(page, searchSel, prodClean, currentTypingDelay, currentMouseDuration);
                    if (typedOk) {
                        // Mover el cursor virtual visiblemente hacia el botón de búsqueda (lupa) y hacer clic
                        const searchBtnSel = 'button.vtex-store-components-3-x-searchBarIcon--external-search, button[aria-label*="Buscar" i], .vtex-store-components-3-x-searchBarIcon';
                        await virtualClick(page, searchBtnSel, currentMouseDuration);
                        await page.keyboard.press('Enter').catch(() => {});
                    } else {
                        await page.goto(`https://www.carrefour.com.ar/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    }

                    // Esperar verificación de resultados sin saltos abruptos
                    let searchOkC = false;
                    for (let w = 0; w < 16; w++) {
                        await sleep(500);
                        const curUrlC = page.url();
                        if (curUrlC.includes(prodUrl) || curUrlC.includes(encodeURIComponent(prodClean)) || (await page.$('[class*="productBrand"], [class*="product-summary"], article h2, article h3'))) {
                            searchOkC = true;
                            break;
                        }
                    }
                    if (!searchOkC) {
                        await page.goto(`https://www.carrefour.com.ar/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                    }

                    await sleep(CONFIG.PAUSE_AFTER_SEARCH);
                    await asegurarCursorEnPagina(page);
                    await eliminarCookies(page);

                    // Esperar que los cards de productos y títulos estén en pantalla
                    await page.waitForSelector('[class*="productBrand"], [class*="product-summary-2-x-nameContainer"], [data-testid="product-summary-name"], article h2, article h3', { timeout: 12000 }).catch(() => {});
                } else {
                    // Modo rápido
                    await page.goto(`https://www.carrefour.com.ar/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForSelector('[class*="productBrand"], [class*="product-summary-2-x-nameContainer"], [data-testid="product-summary-name"], article h2, article h3', { timeout: 12000 }).catch(() => {});
                }

                await eliminarCookies(page);
                await page.waitForSelector('[class*="productBrand"], [class*="product-summary-2-x-nameContainer"], [data-testid="product-summary-name"], article h2, article h3', { timeout: 8000 }).catch(() => {});

                // Extracción Carrefour
                if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 1] Extrayendo resultados...' });
                let cData = await page.evaluate((config) => {
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

                    var allCards = Array.from(document.querySelectorAll('article, [class*="product-summary"], [class*="vtex-search-result-3-x-galleryItem"]'));
                    var seenCUrls = new Set();
                    var cards = [];
                    for (var el of allCards) {
                        var lEl = el.querySelector('a[href*="/p"]') || el.querySelector('a');
                        if (lEl && lEl.href && !seenCUrls.has(lEl.href)) {
                            seenCUrls.add(lEl.href);
                            cards.push(el);
                        }
                    }
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

                        if (config.terminosIncompatibles && config.terminosIncompatibles.length > 0) {
                            var tieneInc = false;
                            for (var k = 0; k < config.terminosIncompatibles.length; k++) {
                                if (contienePalabra(nClean, config.terminosIncompatibles[k])) { tieneInc = true; break; }
                            }
                            if (tieneInc) continue;
                        }

                        if (config.terminosValidos && config.terminosValidos.length > 0) {
                            var coincideCat = config.terminosValidos.some(function(t) { return contienePalabra(nClean, t); });
                            if (!coincideCat) continue;
                        }

                        candidates.push({
                            name: nameVal,
                            price: priceVal,
                            url: urlVal,
                            stock: unavail ? 'SIN STOCK' : 'DISPONIBLE'
                        });
                    }

                    return candidates.length > 0 ? candidates[0] : null;
                }, queryConfig);

                // Fallback de rescate si no encontró productos en primera pasada
                if (!cData) {
                    await page.goto(`https://www.carrefour.com.ar/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                    await page.waitForSelector('[class*="productBrand"], [class*="product-summary-2-x-nameContainer"], [data-testid="product-summary-name"], article h2, article h3', { timeout: 12000 }).catch(() => {});
                    await sleep(1000);
                    await eliminarCookies(page);
                    cData = await page.evaluate((config) => {
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

                        var allCardsF = Array.from(document.querySelectorAll('article, [class*="product-summary"], [class*="vtex-search-result-3-x-galleryItem"]'));
                        var seenCFUrls = new Set();
                        var cards = [];
                        for (var el of allCardsF) {
                            var lEl = el.querySelector('a[href*="/p"]') || el.querySelector('a');
                            if (lEl && lEl.href && !seenCFUrls.has(lEl.href)) {
                                seenCFUrls.add(lEl.href);
                                cards.push(el);
                            }
                        }
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

                            if (config.terminosIncompatibles && config.terminosIncompatibles.length > 0) {
                                var tieneInc = false;
                                for (var k = 0; k < config.terminosIncompatibles.length; k++) {
                                    if (contienePalabra(nClean, config.terminosIncompatibles[k])) { tieneInc = true; break; }
                                }
                                if (tieneInc) continue;
                            }

                            if (config.terminosValidos && config.terminosValidos.length > 0) {
                                var coincideCat = config.terminosValidos.some(function(t) { return contienePalabra(nClean, t); });
                                if (!coincideCat) continue;
                            }

                            candidates.push({
                                name: nameVal,
                                price: priceVal,
                                url: urlVal,
                                stock: unavail ? 'SIN STOCK' : 'DISPONIBLE'
                            });
                        }

                        return candidates.length > 0 ? candidates[0] : null;
                    }, queryConfig);
                }

                const carrefourItem = {
                    modo,
                    producto: prodClean,
                    nombre_encontrado: cData ? cData.name : 'No encontrado',
                    precio: cData ? cData.price : 'N/D',
                    supermercado: 'Carrefour',
                    url: cData ? cData.url : `https://www.carrefour.com.ar/${prodUrl}`,
                    fecha: fechaHoy,
                    stock_status: cData ? cData.stock : 'NO ENCONTRADO',
                    cantidad,
                    unidad
                };

                const rowC = `"${carrefourItem.modo}","${carrefourItem.producto}","${carrefourItem.nombre_encontrado.replace(/"/g, '""')}","${carrefourItem.precio}","${carrefourItem.supermercado}","${carrefourItem.url}","${carrefourItem.fecha}","${carrefourItem.stock_status}","${cantidad}","${unidad}"\n`;
                fs.appendFileSync(CSV_PATH, rowC, 'utf8');
                resultadosSesion.push(carrefourItem);

                if (onStatus) {
                    onStatus({ type: 'log', message: `[SUPERMERCADO 1] Extraído: ${carrefourItem.nombre_encontrado} | ${carrefourItem.precio} | ${carrefourItem.stock_status}` });
                    onStatus({ type: 'log', message: '[SUPERMERCADO 1] Finalizado.' });
                }
            } catch (errC) {
                console.error('Error en Carrefour:', errC);
                if (onStatus) onStatus({ type: 'log', message: `[SUPERMERCADO 1] Advertencia: ${errC.message}. Continuando...` });
            }

            // ==============================================================
            // 2. COTO DIGITAL
            // ==============================================================
            try {
                checkAborted();
                if (onStatus) {
                    onStatus({ type: 'log', message: '[SUPERMERCADO 2] Escribiendo URL en barra de direcciones: https://www.coto.com.ar...' });
                }

                if (isDemo) {
                    // Movimiento visible hacia la barra de direcciones superior y tipeo letra por letra
                    await virtualNav(page, 'https://www.coto.com.ar', currentTypingDelay);

                    if (onStatus) onStatus({ type: 'log', message: `[SUPERMERCADO 2] Buscando producto: "${prodClean}"...` });
                    const cotoSearchSel = 'input#cio-autocomplete-0-input, input.cio-input, input[placeholder*="comprar" i], input[placeholder*="buscar" i], input[type="search"]';
                    await page.waitForSelector(cotoSearchSel, { visible: true, timeout: 8000 }).catch(() => {});
                    
                    const typedOkCt = await virtualType(page, cotoSearchSel, prodClean, currentTypingDelay, currentMouseDuration);
                    if (typedOkCt) {
                        // Mover el cursor virtual visiblemente hacia el botón de búsqueda de COTO (lupa) y hacer clic
                        const cotoBtnSel = 'button.cio-submit-btn, button[type="submit"], form[action*="search"] button, .cio-search-submit';
                        await virtualClick(page, cotoBtnSel, currentMouseDuration);
                        await page.keyboard.press('Enter').catch(() => {});
                    } else {
                        await page.goto(`https://www.coto.com.ar/productos/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    }

                    // Esperar verificación de resultados sin saltos abruptos
                    let searchOkCt = false;
                    for (let w = 0; w < 16; w++) {
                        await sleep(500);
                        const curUrlCt = page.url();
                        if (curUrlCt.includes('productos') || curUrlCt.includes(prodUrl) || (await page.$('constructor-result-item, .product-card, article'))) {
                            searchOkCt = true;
                            break;
                        }
                    }
                    if (!searchOkCt) {
                        await page.goto(`https://www.coto.com.ar/productos/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                    }

                    await sleep(CONFIG.PAUSE_AFTER_SEARCH);
                    await asegurarCursorEnPagina(page);
                    await eliminarCookies(page);
                    await page.waitForSelector('constructor-result-item, .product-card, article', { timeout: 8000 }).catch(() => {});
                } else {
                    await page.goto(`https://www.coto.com.ar/productos/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForSelector('constructor-result-item, .product-card, article', { timeout: 8000 }).catch(() => {});
                }

                if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 2] Extrayendo resultados...' });
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

                    var items = Array.from(document.querySelectorAll('constructor-result-item, .product-card, article')).slice(0, 15);
                    if (items.length === 0) return null;

                    var candidates = [];
                    for (var i = 0; i < items.length; i++) {
                        var it = items[i];
                        var nEl = it.querySelector('.nombre-producto, h3, h2, [class*="title"]');
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

                        if (config.terminosIncompatibles && config.terminosIncompatibles.length > 0) {
                            var tieneInc = false;
                            for (var k = 0; k < config.terminosIncompatibles.length; k++) {
                                if (contienePalabra(nClean, config.terminosIncompatibles[k])) { tieneInc = true; break; }
                            }
                            if (tieneInc) continue;
                        }

                        if (config.terminosValidos && config.terminosValidos.length > 0) {
                            var coincideCat = config.terminosValidos.some(function(t) { return contienePalabra(nClean, t); });
                            if (!coincideCat) continue;
                        }

                        candidates.push({
                            name: nameVal,
                            price: priceVal,
                            url: urlVal,
                            stock: unavail ? 'SIN STOCK' : 'DISPONIBLE'
                        });
                    }

                    return candidates.length > 0 ? candidates[0] : null;
                }, queryConfig);

                const cotoItem = {
                    modo,
                    producto: prodClean,
                    nombre_encontrado: ctData ? ctData.name : 'No encontrado',
                    precio: ctData ? ctData.price : 'N/D',
                    supermercado: 'COTO',
                    url: ctData ? ctData.url : `https://www.coto.com.ar/productos/${prodUrl}`,
                    fecha: fechaHoy,
                    stock_status: ctData ? ctData.stock : 'NO ENCONTRADO',
                    cantidad,
                    unidad
                };

                const rowCt = `"${cotoItem.modo}","${cotoItem.producto}","${cotoItem.nombre_encontrado.replace(/"/g, '""')}","${cotoItem.precio}","${cotoItem.supermercado}","${cotoItem.url}","${cotoItem.fecha}","${cotoItem.stock_status}","${cantidad}","${unidad}"\n`;
                fs.appendFileSync(CSV_PATH, rowCt, 'utf8');
                resultadosSesion.push(cotoItem);

                if (onStatus) {
                    onStatus({ type: 'log', message: `[SUPERMERCADO 2] Extraído: ${cotoItem.nombre_encontrado} | ${cotoItem.precio} | ${cotoItem.stock_status}` });
                    onStatus({ type: 'log', message: '[SUPERMERCADO 2] Finalizado.' });
                }
            } catch (errCt) {
                console.error('Error en COTO:', errCt);
                if (onStatus) onStatus({ type: 'log', message: `[SUPERMERCADO 2] Advertencia: ${errCt.message}. Continuando...` });
            }

            // ==============================================================
            // 3. DÍA %
            // ==============================================================
            try {
                checkAborted();
                if (onStatus) {
                    onStatus({ type: 'log', message: '[SUPERMERCADO 3] Escribiendo URL en barra de direcciones: https://diaonline.supermercadosdia.com.ar...' });
                }

                if (isDemo) {
                    // Movimiento visible hacia la barra de direcciones superior y tipeo letra por letra
                    await virtualNav(page, 'https://diaonline.supermercadosdia.com.ar', currentTypingDelay);

                    if (onStatus) onStatus({ type: 'log', message: `[SUPERMERCADO 3] Buscando producto: "${prodClean}"...` });
                    const diaSearchSel = 'input#downshift-0-input, input.vtex-styleguide-9-x-input, input[placeholder*="buscando" i], input[placeholder*="buscar" i], input[type="text"][id*="downshift"]';
                    await page.waitForSelector(diaSearchSel, { visible: true, timeout: 8000 }).catch(() => {});
                    
                    const typedOkD = await virtualType(page, diaSearchSel, prodClean, currentTypingDelay, currentMouseDuration);
                    if (typedOkD) {
                        // Mover el cursor virtual visiblemente hacia el botón de búsqueda de Día (lupa) y hacer clic
                        const diaBtnSel = 'button.vtex-store-components-3-x-searchBarIcon--search, button.vtex-store-components-3-x-searchBarIcon, button[aria-label*="Buscar" i]';
                        await virtualClick(page, diaBtnSel, currentMouseDuration);
                        await page.keyboard.press('Enter').catch(() => {});
                    } else {
                        await page.goto(`https://diaonline.supermercadosdia.com.ar/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    }

                    // Esperar verificación de resultados sin saltos abruptos
                    let searchOkD = false;
                    for (let w = 0; w < 16; w++) {
                        await sleep(500);
                        const curUrlD = page.url();
                        if (curUrlD.includes(prodUrl) || (await page.$('article, [class*="product-summary"], [class*="galleryItem"]'))) {
                            searchOkD = true;
                            break;
                        }
                    }
                    if (!searchOkD) {
                        await page.goto(`https://diaonline.supermercadosdia.com.ar/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                    }

                    await sleep(CONFIG.PAUSE_AFTER_SEARCH);
                    await asegurarCursorEnPagina(page);
                    await eliminarCookies(page);
                    await page.waitForSelector('article, [class*="product-summary"], [class*="galleryItem"]', { timeout: 8000 }).catch(() => {});
                } else {
                    await page.goto(`https://diaonline.supermercadosdia.com.ar/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForSelector('article, [class*="product-summary"], [class*="galleryItem"]', { timeout: 8000 }).catch(() => {});
                }

                await eliminarCookies(page);

                if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 3] Extrayendo resultados...' });
                let dData = await page.evaluate((config) => {
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

                    var allCardElements = Array.from(document.querySelectorAll('article, section[class*="product-summary"], [class*="galleryItem"]'));
                    var seenUrls = new Set();
                    var dCards = [];
                    for (var el of allCardElements) {
                        var lEl = el.querySelector('a[href*="/p"]') || el.querySelector('a');
                        if (lEl && lEl.href && !seenUrls.has(lEl.href)) {
                            seenUrls.add(lEl.href);
                            dCards.push(el);
                        }
                    }
                    if (dCards.length === 0) return null;

                    var candidates = [];
                    for (var i = 0; i < dCards.length; i++) {
                        var c = dCards[i];
                        var nEl = c.querySelector('h3, h2, [class*="productBrand"], [class*="nameContainer"], [class*="productName"]');
                        var pEl = c.querySelector('[class*="sellingPriceValue"], [class*="sellingPrice"], [class*="currencyContainer"], [class*="price"]');
                        var lEl = c.querySelector('a[href*="/p"]') || c.querySelector('a');
                        if (!nEl) continue;

                        var nameVal = nEl.innerText.trim();
                        var priceVal = 'N/D';
                        if (pEl && pEl.innerText && pEl.innerText.includes('$')) {
                            priceVal = pEl.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                        } else {
                            var mPrice = (c.innerText || '').match(/\$\s*[\d\.,]+/);
                            if (mPrice) {
                                priceVal = mPrice[0].trim();
                            } else {
                                var lines = c.innerText.split('\n').filter(function(s){ return s.trim().length > 0; });
                                for (var l = 0; l < lines.length; l++) {
                                    if (lines[l].indexOf('$') > -1) { priceVal = lines[l].trim(); break; }
                                }
                            }
                        }
                        var urlVal = lEl ? lEl.href : window.location.href;
                        var cardText = (c.innerText || '').toLowerCase();
                        var unavail = cardText.indexOf('agotado') > -1 || cardText.indexOf('sin stock') > -1 || cardText.indexOf('no disponible') > -1;
                        if (priceVal === 'N/D' || priceVal === '' || priceVal === '$ 0' || priceVal === '$ 0,00') unavail = true;

                        var nClean = cleanText(nameVal);

                        if (config.terminosIncompatibles && config.terminosIncompatibles.length > 0) {
                            var tieneInc = false;
                            for (var k = 0; k < config.terminosIncompatibles.length; k++) {
                                if (contienePalabra(nClean, config.terminosIncompatibles[k])) { tieneInc = true; break; }
                            }
                            if (tieneInc) continue;
                        }

                        if (config.terminosValidos && config.terminosValidos.length > 0) {
                            var coincideCat = config.terminosValidos.some(function(t) { return contienePalabra(nClean, t); });
                            if (!coincideCat) continue;
                        }

                        candidates.push({
                            name: nameVal,
                            price: priceVal,
                            url: urlVal,
                            stock: unavail ? 'SIN STOCK' : 'DISPONIBLE'
                        });
                    }

                    return candidates.length > 0 ? candidates[0] : null;
                }, queryConfig);

                // Fallback de rescate si no encontró productos en primera pasada
                if (!dData) {
                    await page.goto(`https://diaonline.supermercadosdia.com.ar/${prodUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                    await page.waitForSelector('article, [class*="product-summary"], [class*="galleryItem"]', { timeout: 10000 }).catch(() => {});
                    await sleep(1000);
                    await eliminarCookies(page);
                    dData = await page.evaluate((config) => {
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

                        var allCardElements = Array.from(document.querySelectorAll('article, section[class*="product-summary"], [class*="galleryItem"]'));
                        var seenUrls = new Set();
                        var dCards = [];
                        for (var el of allCardElements) {
                            var lEl = el.querySelector('a[href*="/p"]') || el.querySelector('a');
                            if (lEl && lEl.href && !seenUrls.has(lEl.href)) {
                                seenUrls.add(lEl.href);
                                dCards.push(el);
                            }
                        }
                        if (dCards.length === 0) return null;

                        var candidates = [];
                        for (var i = 0; i < dCards.length; i++) {
                            var c = dCards[i];
                            var nEl = c.querySelector('h3, h2, [class*="productBrand"], [class*="nameContainer"], [class*="productName"]');
                            var pEl = c.querySelector('[class*="sellingPriceValue"], [class*="sellingPrice"], [class*="currencyContainer"], [class*="price"]');
                            var lEl = c.querySelector('a[href*="/p"]') || c.querySelector('a');
                            if (!nEl) continue;

                            var nameVal = nEl.innerText.trim();
                            var priceVal = 'N/D';
                            if (pEl && pEl.innerText && pEl.innerText.includes('$')) {
                                priceVal = pEl.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                            } else {
                                var mPrice = (c.innerText || '').match(/\$\s*[\d\.,]+/);
                                if (mPrice) {
                                    priceVal = mPrice[0].trim();
                                } else {
                                    var lines = c.innerText.split('\n').filter(function(s){ return s.trim().length > 0; });
                                    for (var l = 0; l < lines.length; l++) {
                                        if (lines[l].indexOf('$') > -1) { priceVal = lines[l].trim(); break; }
                                    }
                                }
                            }
                            var urlVal = lEl ? lEl.href : window.location.href;
                            var cardText = (c.innerText || '').toLowerCase();
                            var unavail = cardText.indexOf('agotado') > -1 || cardText.indexOf('sin stock') > -1 || cardText.indexOf('no disponible') > -1;
                            if (priceVal === 'N/D' || priceVal === '' || priceVal === '$ 0' || priceVal === '$ 0,00') unavail = true;

                            var nClean = cleanText(nameVal);

                            if (config.terminosIncompatibles && config.terminosIncompatibles.length > 0) {
                                var tieneInc = false;
                                for (var k = 0; k < config.terminosIncompatibles.length; k++) {
                                    if (contienePalabra(nClean, config.terminosIncompatibles[k])) { tieneInc = true; break; }
                                }
                                if (tieneInc) continue;
                            }

                            if (config.terminosValidos && config.terminosValidos.length > 0) {
                                var coincideCat = config.terminosValidos.some(function(t) { return contienePalabra(nClean, t); });
                                if (!coincideCat) continue;
                            }

                            candidates.push({
                                name: nameVal,
                                price: priceVal,
                                url: urlVal,
                                stock: unavail ? 'SIN STOCK' : 'DISPONIBLE'
                            });
                        }

                        return candidates.length > 0 ? candidates[0] : null;
                    }, queryConfig);
                }

                const diaItem = {
                    modo,
                    producto: prodClean,
                    nombre_encontrado: dData ? dData.name : 'No encontrado',
                    precio: dData ? dData.price : 'N/D',
                    supermercado: 'Día %',
                    url: dData ? dData.url : `https://diaonline.supermercadosdia.com.ar/${prodUrl}`,
                    fecha: fechaHoy,
                    stock_status: dData ? dData.stock : 'NO ENCONTRADO',
                    cantidad,
                    unidad
                };

                const rowD = `"${diaItem.modo}","${diaItem.producto}","${diaItem.nombre_encontrado.replace(/"/g, '""')}","${diaItem.precio}","${diaItem.supermercado}","${diaItem.url}","${diaItem.fecha}","${diaItem.stock_status}","${cantidad}","${unidad}"\n`;
                fs.appendFileSync(CSV_PATH, rowD, 'utf8');
                resultadosSesion.push(diaItem);

                if (onStatus) {
                    onStatus({ type: 'log', message: `[SUPERMERCADO 3] Extraído: ${diaItem.nombre_encontrado} | ${diaItem.precio} | ${diaItem.stock_status}` });
                    onStatus({ type: 'log', message: '[SUPERMERCADO 3] Finalizado.' });
                }
            } catch (errD) {
                console.error('Error en Día %:', errD);
                if (onStatus) onStatus({ type: 'log', message: `[SUPERMERCADO 3] Advertencia: ${errD.message}. Continuando...` });
            }
        }

        // Cierre de Ciclo
        if (onStatus) {
            onStatus({ type: 'log', message: '----------------------------------------' });
            onStatus({ type: 'log', message: '[ RPA FINALIZADO ]' });
            onStatus({ type: 'log', message: '3 supermercados procesados.' });
            onStatus({ type: 'log', message: 'Resultados enviados al frontend.' });
            onStatus({ type: 'finished', message: 'Automatización completada con éxito.' });
        }

        await sleep(1500);
        return resultadosSesion;
    } catch (error) {
        if (error.message === 'RPA_ABORTED_BY_USER' || isAborted) {
            console.log('[RPA] Ejecución detenida inmediatamente por el usuario.');
            if (onStatus) onStatus({ type: 'error', message: 'RPA detenido inmediatamente por el usuario.' });
            return resultadosSesion;
        }
        console.error('Error durante la ejecución del RPA:', error);
        if (onStatus) onStatus({ type: 'error', message: error.message });
        throw error;
    } finally {
        activeBrowser = null;
        if (browser && !isAborted) {
            try {
                // En DEMO_MODE, dar 3 segundos al usuario para apreciar el final antes de cerrar
                if (isDemo) await sleep(2500);
                await browser.close();
            } catch (e) {}
        }
    }
}

module.exports = {
    runRPA,
    getChromePath,
    abortCurrentRun,
    CONFIG
};
