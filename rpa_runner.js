// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// rpa_runner.js - Motor de Automatización RPA 100% Visible Paso a Paso
// ==============================================================================

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const validador = require('./validador.js');

const CSV_PATH = path.join(__dirname, 'resultados.csv');
const MOUSE_HELPER_PATH = path.join(__dirname, 'mouse_helper.exe');

// ==============================================================================
// CONSTANTES CENTRALIZADAS DE VELOCIDAD Y TIEMPOS (MODO DEMOSTRACIÓN VISIBLE)
// ==============================================================================
const CONFIG = {
    DEMO_MODE: true,
    TYPING_DELAY: 50,          // 50ms por carácter (tipeo humano visible)
    MOUSE_MOVE_DURATION: 600,  // 600ms de movimiento fluido del cursor
    PAUSE_BEFORE_CLICK: 450,   // Pausa de posicionamiento antes del click
    PAUSE_AFTER_CLICK: 650,    // Pausa posterior al click para asimilar la acción
    PAUSE_AFTER_PAGE_LOAD: 2500, // Pausa tras cargar la página principal
    PAUSE_AFTER_SEARCH: 2500,  // Pausa tras ejecutar la búsqueda
    PAUSE_AFTER_FILTER: 2200,  // Pausa tras aplicar el ordenamiento
    SCROLL_STEP_DELAY: 350     // Pausa entre pasos de scroll progresivo
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

// Pausa asíncrona e interrumpible
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

// Eliminar modales de cookies, banners y filtros oscuros que bloquean interacción
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

// ==============================================================================
// MOTOR VISUAL DEL CURSOR EN PÁGINA (INDICADOR DINÁMICO DE ACCIONES REALES)
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

// Obtener la posición en viewport de un elemento asegurando que esté a la vista
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
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
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

// ==============================================================================
// ACCIONES VISIBLES PRIMARIAS (INTERACCIÓN REAL DE USUARIO)
// ==============================================================================

// 1. Navegación Visible por la Barra de Direcciones de Chrome
async function visibleNavigate(page, targetUrl, typingDelay = CONFIG.TYPING_DELAY) {
    checkAborted();
    // Mover el cursor hacia la parte superior simulando el salto a la barra de direcciones
    await page.evaluate(() => {
        if (window.__rpa_move) {
            window.__rpa_move(window.innerWidth * 0.45, 10, 450);
        }
    }).catch(() => {});
    await sleep(200);

    // Ejecutar con el helper nativo Win32: mueve el mouse físico a la barra de direcciones, hace click y tipea letra por letra
    let navOk = false;
    try {
        if (fs.existsSync(MOUSE_HELPER_PATH)) {
            const res = spawnSync(MOUSE_HELPER_PATH, ['nav', targetUrl, Math.max(typingDelay, 25).toString()], { windowsHide: true });
            if (res.status === 0) navOk = true;
        }
    } catch (e) {}

    // Esperar navegación generada por el Enter en la barra de direcciones
    let arrived = false;
    for (let t = 0; t < 30; t++) {
        await sleep(250);
        const curUrl = page.url();
        if (curUrl.includes(new URL(targetUrl).hostname)) {
            arrived = true;
            break;
        }
    }

    // Si por alguna razón de foco el atajo de SO no redirigió, asegurar la navegación
    if (!arrived) {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
    }

    await sleep(CONFIG.PAUSE_AFTER_PAGE_LOAD);
    await page.bringToFront().catch(() => {});
    await asegurarCursorEnPagina(page);
    await eliminarCookies(page);
}

// 2. Movimiento Visible hacia un Elemento
async function visibleMove(page, selectorOrCoords, durationMs = CONFIG.MOUSE_MOVE_DURATION) {
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

    // Mover cursor visual
    await page.evaluate((tx, ty, dur) => {
        return window.__rpa_move ? window.__rpa_move(tx, ty, dur) : Promise.resolve();
    }, x, y, durationMs);

    // Mover cursor de Puppeteer
    try {
        await page.mouse.move(x, y, { steps: 10 });
    } catch(e) {}

    return true;
}

// 3. Click Real y Visible
async function visibleClick(page, selector, durationMs = CONFIG.MOUSE_MOVE_DURATION) {
    checkAborted();
    try {
        await page.$eval(selector, el => el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' })).catch(() => {});
    } catch(e) {}
    await sleep(150);

    const pos = await getElementViewportPos(page, selector);
    if (pos) {
        await visibleMove(page, pos, durationMs);
        await page.evaluate(() => { if (window.__rpa_pulse) window.__rpa_pulse(); });
        await sleep(CONFIG.PAUSE_BEFORE_CLICK);
        try {
            await page.mouse.click(pos.x, pos.y);
        } catch(e) {}
    } else {
        try {
            const handle = await page.$(selector);
            if (handle) {
                await handle.click().catch(() => {});
            }
        } catch(e) {}
    }

    await sleep(CONFIG.PAUSE_AFTER_CLICK);
    return true;
}

// 4. Escritura Visible Progresiva (Carácter por Carácter con Teclado Real)
async function visibleType(page, selector, text, delayMs = CONFIG.TYPING_DELAY, durationMs = CONFIG.MOUSE_MOVE_DURATION) {
    checkAborted();
    const pos = await getElementViewportPos(page, selector);
    if (pos) {
        // Mover hacia el campo de texto y pulsar el cursor visual
        await visibleMove(page, pos, durationMs);
        await page.evaluate(() => { if (window.__rpa_pulse) window.__rpa_pulse(); });
        await sleep(CONFIG.PAUSE_BEFORE_CLICK);
        try {
            await page.mouse.click(pos.x, pos.y);
        } catch(e) {}
    }

    // Asegurar foco y activación en el input interactivo visible
    await page.evaluate((sel) => {
        const elements = Array.from(document.querySelectorAll(sel));
        const el = elements.find(e => e.offsetWidth > 20 && e.offsetHeight > 10 && e.offsetParent !== null) || elements[0];
        if (el) {
            el.focus();
            try { el.click(); } catch(e) {}
        }
    }, selector);

    await sleep(200);

    // Limpiar campo si contuviera texto previo
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(150);

    // Tipeo progresivo real carácter por carácter con teclado de Puppeteer
    await page.keyboard.type(text, { delay: Math.max(delayMs, 25) });

    await sleep(CONFIG.PAUSE_AFTER_CLICK);
    return true;
}

// 5. Scroll Progresivo y Visible por la Página
async function visibleScroll(page, totalPixels = 500, steps = 3) {
    checkAborted();
    const stepPixels = Math.floor(totalPixels / steps);
    for (let i = 0; i < steps; i++) {
        await page.evaluate((px) => {
            window.scrollBy({ top: px, behavior: 'smooth' });
        }, stepPixels);
        await sleep(CONFIG.SCROLL_STEP_DELAY);
    }
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

// ==============================================================================
// MÓDULOS DE INTERACCIÓN VISIBLE POR SUPERMERCADO
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. CARREFOUR ARGENTINA
// ------------------------------------------------------------------------------
async function searchCarrefour(page, prodClean, options = {}) {
    const { onStatus, typingDelay, mouseDuration } = options;
    checkAborted();

    if (onStatus) {
        onStatus({ type: 'log', message: '[SUPERMERCADO 1] Navegando visualmente a https://www.carrefour.com.ar...' });
    }

    // 1. Navegar por barra de direcciones
    await visibleNavigate(page, 'https://www.carrefour.com.ar', typingDelay);

    // 2. Localizar buscador
    if (onStatus) onStatus({ type: 'log', message: `[SUPERMERCADO 1] Localizando buscador para: "${prodClean}"...` });
    const searchSel = 'input[placeholder*="buscando" i], input.vtex-styleguide-9-x-input';
    await page.waitForSelector(searchSel, { timeout: 10000 }).catch(() => {});

    // Asegurar foco y activación
    await page.evaluate((sel) => {
        const inputs = Array.from(document.querySelectorAll(sel));
        const el = inputs.find(e => e.offsetWidth > 20 && e.offsetHeight > 10 && e.offsetParent !== null) || inputs[0];
        if (el) { el.focus(); el.click(); }
    }, searchSel);

    // 3. Escribir carácter por carácter de forma visible
    await visibleType(page, searchSel, prodClean, typingDelay, mouseDuration);

    // 4. Ejecutar búsqueda con Enter
    await sleep(300);
    await page.keyboard.press('Enter');

    if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 1] Esperando resultados de búsqueda...' });
    for (let w = 0; w < 20; w++) {
        await sleep(500);
        const curU = page.url();
        if (curU.includes(encodeURIComponent(prodClean)) || curU.includes('_q=') || curU.includes('almacen')) {
            break;
        }
        if (w === 3) {
            await page.keyboard.press('Enter');
            await page.evaluate(() => {
                const btn = document.querySelector('button[class*="searchIcon"], button[type="submit"], [class*="search-bar"] button');
                if (btn) btn.click();
            });
        }
    }
    await sleep(CONFIG.PAUSE_AFTER_SEARCH);
    await asegurarCursorEnPagina(page);
    await eliminarCookies(page);

    // 5. Scroll visible por la grilla de resultados
    await visibleScroll(page, 450, 3);
    await sleep(600);

    // 6. Localizar y aplicar filtro de orden "menor a mayor"
    if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 1] Aplicando ordenamiento: Menor precio...' });
    const sortBtnSel = 'button.valtech-carrefourar-search-result-3-x-orderByButton, button[class*="orderByButton"]';
    const sortBtn = await page.$(sortBtnSel);
    if (sortBtn) {
        await visibleMove(page, sortBtnSel, mouseDuration);
        await sleep(300);
        await sortBtn.click().catch(() => {});
        await sleep(800);

        const optionClicked = await page.evaluate(() => {
            const opts = Array.from(document.querySelectorAll('button, div, span, li, a'));
            const opt = opts.find(e => (e.innerText || '').toLowerCase().includes('más bajo') && e.offsetWidth > 0);
            if (opt) { opt.click(); return true; }
            return false;
        });

        if (optionClicked) {
            await sleep(2500);
        }
    }

    // Scroll de inspección sobre los productos ordenados
    await visibleScroll(page, 350, 2);
    await sleep(1500);

    // 7. Extracción interna con validador
    if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 1] Extrayendo datos del producto seleccionado...' });
    const queryConfig = validador.obtenerConfiguracionBusqueda(prodClean);

    const cData = await page.evaluate((config) => {
        function cleanText(s) {
            if (!s) return '';
            return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,;:!¡?¿()[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
        }
        function contienePalabra(texto, palabra) {
            if (!texto || !palabra) return false;
            if (palabra.length <= 4) {
                var rx = new RegExp('(?:^|\\s)' + palabra.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:$|\\s)', 'i');
                return rx.test(texto);
            }
            return texto.indexOf(palabra) > -1;
        }

        const cards = Array.from(document.querySelectorAll('article, [class*="product-summary"], [class*="vtex-search-result-3-x-galleryItem"]'));
        for (const c of cards) {
            const nEl = c.querySelector('h3, h2, [class*="productBrand"], [class*="nameContainer"], [data-testid="product-summary-name"]');
            const pEl = c.querySelector('[class*="sellingPrice"], [class*="currencyContainer"], [class*="price_sellingPrice"]');
            const lEl = c.querySelector('a[href*="/p"]') || c.querySelector('a');
            if (!nEl) continue;

            const nameVal = nEl.innerText.trim();
            if (!nameVal) continue;

            let priceVal = 'N/D';
            if (pEl && pEl.innerText && pEl.innerText.includes('$')) {
                priceVal = pEl.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            } else {
                const m = (c.innerText || '').match(/\$\s*[\d.,]+/g);
                if (m && m.length > 0) priceVal = m[0].trim();
            }
            const urlVal = lEl ? lEl.href : window.location.href;
            const cardText = (c.innerText || '').toLowerCase();
            const unavail = (c.querySelector('[class*="unavailable"], [class*="outOfStock"]') !== null) || cardText.indexOf('agotado') > -1 || cardText.indexOf('sin stock') > -1;

            const nClean = cleanText(nameVal);
            if (config.terminosIncompatibles && config.terminosIncompatibles.length > 0) {
                let inc = false;
                for (let k = 0; k < config.terminosIncompatibles.length; k++) {
                    if (contienePalabra(nClean, config.terminosIncompatibles[k])) { inc = true; break; }
                }
                if (inc) continue;
            }

            let coincideCat = false;
            if (config.terminosValidos && config.terminosValidos.length > 0) {
                coincideCat = config.terminosValidos.some(t => contienePalabra(nClean, t));
            }
            if (!coincideCat && !nClean.includes(config.queryNormalizada)) continue;

            return {
                name: nameVal,
                price: priceVal,
                url: urlVal,
                stock: unavail ? 'SIN STOCK' : 'DISPONIBLE'
            };
        }
        return null;
    }, queryConfig);

    return cData;
}

// ------------------------------------------------------------------------------
// 2. COTO DIGITAL
// ------------------------------------------------------------------------------
async function searchCoto(page, prodClean, options = {}) {
    const { onStatus, typingDelay, mouseDuration } = options;
    checkAborted();

    if (onStatus) {
        onStatus({ type: 'log', message: '[SUPERMERCADO 2] Navegando visualmente a https://www.coto.com.ar...' });
    }

    // 1. Navegar por barra de direcciones
    await visibleNavigate(page, 'https://www.coto.com.ar', typingDelay);

    // 2. Localizar buscador de COTO
    if (onStatus) onStatus({ type: 'log', message: `[SUPERMERCADO 2] Localizando buscador para: "${prodClean}"...` });
    const cotoSearchSel = 'input#cio-autocomplete-0-input, input.cio-input, input[placeholder*="comprar" i], input[type="search"]';
    await page.waitForSelector(cotoSearchSel, { visible: true, timeout: 10000 }).catch(() => {});

    // 3. Tipear carácter por carácter
    const typedOkCt = await visibleType(page, cotoSearchSel, prodClean, typingDelay, mouseDuration);

    // 4. Ejecutar búsqueda
    if (typedOkCt) {
        const cotoBtnSel = 'button.cio-submit-btn, button[type="submit"], .cio-search-submit';
        const clickedBtnCt = await visibleClick(page, cotoBtnSel, mouseDuration);
        if (!clickedBtnCt) {
            await page.keyboard.press('Enter');
        }
    } else {
        await page.keyboard.press('Enter');
    }

    if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 2] Esperando resultados de búsqueda...' });
    await sleep(CONFIG.PAUSE_AFTER_SEARCH);
    await asegurarCursorEnPagina(page);
    await eliminarCookies(page);

    // 5. Scroll visible por los resultados
    await visibleScroll(page, 450, 3);
    await sleep(600);

    // 6. Localizar y aplicar selector de orden "menor a mayor"
    if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 2] Aplicando ordenamiento: Menor precio...' });
    const cotoSortSel = 'select.form-select.w-auto, select[class*="form-select"]';
    const cotoSortFound = await page.$(cotoSortSel);
    if (cotoSortFound) {
        await visibleMove(page, cotoSortSel, mouseDuration);
        await sleep(300);
        await page.select(cotoSortSel, 'price|ascending').catch(() => {});
        await sleep(CONFIG.PAUSE_AFTER_FILTER);
    }

    // Scroll de inspección
    await visibleScroll(page, 350, 2);
    await sleep(800);

    // 7. Extracción interna con validador
    if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 2] Extrayendo datos del producto seleccionado...' });
    const queryConfig = validador.obtenerConfiguracionBusqueda(prodClean);

    const ctData = await page.evaluate((config) => {
        function cleanText(s) {
            if (!s) return '';
            return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,;:!¡?¿()[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
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
            var priceVal = pEl ? pEl.innerText.replace(/\\n/g, ' ').replace(/\\s+/g, ' ').trim() : 'N/D';
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

    return ctData;
}

// 3. DÍA %
// ------------------------------------------------------------------------------
async function searchDia(page, prodClean, options = {}) {
    const { onStatus, typingDelay, mouseDuration } = options;
    checkAborted();

    if (onStatus) {
        onStatus({ type: 'log', message: '[SUPERMERCADO 3] Navegando visualmente a https://diaonline.supermercadosdia.com.ar...' });
    }

    // 1. Navegar por barra de direcciones
    await visibleNavigate(page, 'https://diaonline.supermercadosdia.com.ar', typingDelay);

    // 2. Localizar buscador de Día %
    if (onStatus) onStatus({ type: 'log', message: `[SUPERMERCADO 3] Localizando buscador para: "${prodClean}"...` });
    const diaSearchSel = 'input[placeholder*="busc" i], input.vtex-styleguide-9-x-input';
    await page.waitForSelector(diaSearchSel, { timeout: 10000 }).catch(() => {});

    // Asegurar foco y activación
    await page.evaluate((sel) => {
        const inputs = Array.from(document.querySelectorAll(sel));
        const el = inputs.find(e => e.offsetWidth > 20 && e.offsetHeight > 10 && e.offsetParent !== null) || inputs[0];
        if (el) { el.focus(); el.click(); }
    }, diaSearchSel);

    // 3. Tipear carácter por carácter de forma visible
    await visibleType(page, diaSearchSel, prodClean, typingDelay, mouseDuration);

    // 4. Ejecutar búsqueda con Enter
    await sleep(300);
    await page.keyboard.press('Enter');

    if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 3] Esperando resultados de búsqueda...' });
    for (let w = 0; w < 20; w++) {
        await sleep(500);
        const curU = page.url();
        if (curU.includes(encodeURIComponent(prodClean)) || curU.includes('_q=')) {
            break;
        }
        if (w === 3) {
            await page.keyboard.press('Enter');
            await page.evaluate(() => {
                const btn = document.querySelector('button[class*="searchIcon"], button[type="submit"], [class*="search-bar"] button');
                if (btn) btn.click();
            });
        }
    }
    await sleep(CONFIG.PAUSE_AFTER_SEARCH);
    await asegurarCursorEnPagina(page);
    await eliminarCookies(page);

    // 5. Scroll visible por los resultados
    await visibleScroll(page, 450, 3);
    await sleep(600);

    // 6. Localizar y aplicar filtro de orden "menor a mayor"
    if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 3] Aplicando ordenamiento: Menor precio...' });
    const diaSortBtnSel = 'button.diaio-search-result-0-x-orderByButton, button[class*="orderByButton"]';
    const diaSortBtn = await page.$(diaSortBtnSel);
    if (diaSortBtn) {
        await visibleMove(page, diaSortBtnSel, mouseDuration);
        await sleep(300);
        await diaSortBtn.click().catch(() => {});
        await sleep(800);

        const optionClickedD = await page.evaluate(() => {
            const opts = Array.from(document.querySelectorAll('button, div, span, li, a'));
            const opt = opts.find(e => (e.innerText || '').toLowerCase().includes('más bajo') && e.offsetWidth > 0);
            if (opt) { opt.click(); return true; }
            return false;
        });

        if (optionClickedD) {
            await sleep(2500);
        }
    }

    // Scroll de inspección
    await visibleScroll(page, 350, 2);
    await sleep(1500);

    // 7. Extracción interna con validador
    if (onStatus) onStatus({ type: 'log', message: '[SUPERMERCADO 3] Extrayendo datos del producto seleccionado...' });
    const queryConfig = validador.obtenerConfiguracionBusqueda(prodClean);

    const dData = await page.evaluate((config) => {
        function cleanText(s) {
            if (!s) return '';
            return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,;:!¡?¿()[\]"'\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
        }
        function contienePalabra(texto, palabra) {
            if (!texto || !palabra) return false;
            if (palabra.length <= 4) {
                var rx = new RegExp('(?:^|\\s)' + palabra.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:$|\\s)', 'i');
                return rx.test(texto);
            }
            return texto.indexOf(palabra) > -1;
        }

        const cards = Array.from(document.querySelectorAll('article, section[class*="product-summary"], [class*="galleryItem"]'));
        for (const c of cards) {
            const nEl = c.querySelector('h3, h2, [class*="productBrand"], [class*="nameContainer"], [class*="productName"]');
            const pEl = c.querySelector('[class*="sellingPriceValue"], [class*="sellingPrice"], [class*="currencyContainer"], [class*="price"]');
            const lEl = c.querySelector('a[href*="/p"]') || c.querySelector('a');
            if (!nEl) continue;

            const nameVal = nEl.innerText.trim();
            if (!nameVal) continue;

            let priceVal = 'N/D';
            if (pEl && pEl.innerText && pEl.innerText.includes('$')) {
                priceVal = pEl.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            } else {
                const m = (c.innerText || '').match(/\$\s*[\d.,]+/g);
                if (m && m.length > 0) priceVal = (m[1] || m[0]).trim();
            }
            const urlVal = lEl ? lEl.href : window.location.href;
            const cardText = (c.innerText || '').toLowerCase();
            const unavail = (c.querySelector('[class*="unavailable"], [class*="outOfStock"]') !== null) || cardText.indexOf('agotado') > -1 || cardText.indexOf('sin stock') > -1;

            const nClean = cleanText(nameVal);
            if (config.terminosIncompatibles && config.terminosIncompatibles.length > 0) {
                let inc = false;
                for (let k = 0; k < config.terminosIncompatibles.length; k++) {
                    if (contienePalabra(nClean, config.terminosIncompatibles[k])) { inc = true; break; }
                }
                if (inc) continue;
            }

            let coincideCat = false;
            if (config.terminosValidos && config.terminosValidos.length > 0) {
                coincideCat = config.terminosValidos.some(t => contienePalabra(nClean, t));
            }
            if (!coincideCat && !nClean.includes(config.queryNormalizada)) continue;

            return {
                name: nameVal,
                price: priceVal,
                url: urlVal,
                stock: unavail ? 'SIN STOCK' : 'DISPONIBLE'
            };
        }
        return null;
    }, queryConfig);

    return dData;
}

// ==============================================================================
// FUNCIÓN PRINCIPAL DE EJECUCIÓN RPA (ORQUESTADOR)
// ==============================================================================
async function runRPA({
    modo = 'individual',
    items = [],
    demoMode = CONFIG.DEMO_MODE,
    typingDelay = CONFIG.TYPING_DELAY,
    mouseDuration = CONFIG.MOUSE_MOVE_DURATION,
    onStatus = null
}) {
    isAborted = false;
    asegurarCSV();
    const chromePath = getChromePath();
    const fechaHoy = getFechaHoy();

    const currentTypingDelay = typingDelay || CONFIG.TYPING_DELAY;
    const currentMouseDuration = mouseDuration || CONFIG.MOUSE_MOVE_DURATION;

    if (onStatus) {
        onStatus({
            type: 'init',
            message: 'Iniciando Google Chrome en modo 100% VISIBLE paso a paso...'
        });
    }

    let browser = null;
    const resultadosSesion = [];

    try {
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: false, // 100% VISIBLE en el escritorio del usuario
            defaultViewport: null, // Ventana completa
            args: [
                '--start-maximized',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-blink-features=AutomationControlled',
                '--lang=es-419,es',
                'https://www.google.com'
            ]
        });

        activeBrowser = browser;

        // Kill-switch: abortar inmediatamente si el usuario cierra la ventana de Chrome
        browser.on('disconnected', () => {
            console.log('[RPA] Navegador Chrome cerrado por el usuario.');
            abortCurrentRun();
        });

        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();

        page.on('close', () => {
            console.log('[RPA] Pestaña de Chrome cerrada.');
            abortCurrentRun();
        });

        checkAborted();

        await page.evaluateOnNewDocument(VIRTUAL_CURSOR_SCRIPT);
        await sleep(1000);
        await asegurarCursorEnPagina(page);

        if (onStatus) {
            onStatus({
                type: 'connected',
                message: 'Chrome conectado en Google. Iniciando recorrido visual por los supermercados...'
            });
        }

        await sleep(1500);

        const totalItems = items.length;

        for (let i = 0; i < totalItems; i++) {
            checkAborted();
            const itemObj = items[i];
            const productoOriginal = (typeof itemObj === 'string') ? itemObj : itemObj.producto;
            const cantidad = (itemObj.cantidad && parseInt(itemObj.cantidad, 10) > 0) ? parseInt(itemObj.cantidad, 10) : 1;
            const unidad = determinarUnidadDefault(productoOriginal, itemObj.unidad);
            const prodClean = productoOriginal.replace(/"/g, '').replace(/'/g, '').trim();

            if (onStatus) {
                onStatus({
                    type: 'progress',
                    percent: Math.round((i / totalItems) * 70),
                    message: `[${i + 1}/${totalItems}] Buscando: "${prodClean}" (x${cantidad} ${unidad})`
                });
            }

            const stepOptions = {
                onStatus,
                typingDelay: currentTypingDelay,
                mouseDuration: currentMouseDuration
            };

            // 1. CARREFOUR ARGENTINA
            try {
                checkAborted();
                const cData = await searchCarrefour(page, prodClean, stepOptions);

                const carrefourItem = {
                    modo,
                    producto: prodClean,
                    nombre_encontrado: cData ? cData.name : 'No encontrado',
                    precio: cData ? cData.price : 'N/D',
                    supermercado: 'Carrefour',
                    url: cData ? cData.url : 'https://www.carrefour.com.ar',
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

            // 2. COTO DIGITAL
            try {
                checkAborted();
                const ctData = await searchCoto(page, prodClean, stepOptions);

                const cotoItem = {
                    modo,
                    producto: prodClean,
                    nombre_encontrado: ctData ? ctData.name : 'No encontrado',
                    precio: ctData ? ctData.price : 'N/D',
                    supermercado: 'COTO',
                    url: ctData ? ctData.url : 'https://www.coto.com.ar',
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

            // 3. DÍA %
            try {
                checkAborted();
                const dData = await searchDia(page, prodClean, stepOptions);

                const diaItem = {
                    modo,
                    producto: prodClean,
                    nombre_encontrado: dData ? dData.name : 'No encontrado',
                    precio: dData ? dData.price : 'N/D',
                    supermercado: 'Día %',
                    url: dData ? dData.url : 'https://diaonline.supermercadosdia.com.ar',
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

        // Finalización
        if (onStatus) {
            onStatus({ type: 'log', message: '----------------------------------------' });
            onStatus({ type: 'log', message: '[ RPA FINALIZADO ]' });
            onStatus({ type: 'log', message: '3 supermercados procesados con automatización 100% visible.' });
            onStatus({ type: 'finished', message: 'Automatización completada con éxito.' });
        }

        await sleep(1500);
        return resultadosSesion;
    } catch (error) {
        if (error.message === 'RPA_ABORTED_BY_USER' || isAborted) {
            console.log('[RPA] Ejecución detenida por el usuario.');
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
                await sleep(2000);
                await browser.close();
            } catch (e) {}
        }
    }
}

module.exports = {
    runRPA,
    getChromePath,
    abortCurrentRun,
    searchCarrefour,
    searchCoto,
    searchDia,
    visibleNavigate,
    visibleClick,
    visibleType,
    visibleScroll,
    CONFIG
};
