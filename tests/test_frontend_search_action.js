const http = require('http');
const express = require('express');
const path = require('path');
async function getPuppeteer() {
    const mod = await import('puppeteer-core');
    return mod.default || mod;
}

async function testFrontend() {
    console.log('--- Iniciando prueba de interacción del Frontend ---');
    
    // Importar el server existente o configurar test server
    const app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '..', 'public')));
    
    // Mock endpoints para probar la UI sin disparar un scrape de 10 minutos
    let searchCalled = false;
    let receivedPayload = null;

    app.get('/api/catalogo', (req, res) => {
        const catalogo = require('../catalogo.js').cargarCatalogo();
        res.json({ success: true, catalogo: catalogo.catalogo, items: catalogo.items });
    });

    app.get('/api/resultados-recientes', (req, res) => {
        res.json({
            success: true,
            individuales: [
                { producto: 'Yerba Mate Playadito 1kg', coto: 4100, carrefour: 3950, dia: 4200 }
            ],
            canastaMes: []
        });
    });

    app.post('/api/buscar-individual', (req, res) => {
        searchCalled = true;
        receivedPayload = req.body;
        console.log('[TestServer] /api/buscar-individual recibido:', req.body);
        res.json({ success: true, message: 'Búsqueda mock iniciada correctamente' });
    });

    const testServer = http.createServer(app);
    await new Promise(resolve => testServer.listen(3344, resolve));
    console.log('[TestServer] Servidor de prueba escuchando en http://localhost:3344');

    const puppeteer = await getPuppeteer();
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--window-size=1280,1024']
    });

    const page = await browser.newPage();
    const consoleLogs = [];
    const pageErrors = [];

    page.on('console', msg => consoleLogs.push(msg.text()));
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto('http://localhost:3344', { waitUntil: 'networkidle0' });

    // 1. Verificar carga de categorías en el select
    const catOptionsCount = await page.$$eval('#select-categoria option', opts => opts.length);
    console.log(`[Test] Opciones de categoría cargadas: ${catOptionsCount}`);
    if (catOptionsCount <= 1) {
        throw new Error('Las categorías del catálogo no se cargaron en el select.');
    }

    // 2. Verificar que el input de búsqueda rápida tenga un valor por defecto o acepte texto
    await page.waitForSelector('#input-busqueda-rapida');
    const initialQuery = await page.$eval('#input-busqueda-rapida', el => el.value);
    console.log(`[Test] Valor inicial en input búsqueda: "${initialQuery}"`);

    // 3. Hacer click en el botón "Comparar en 3 Super"
    console.log('[Test] Haciendo click en #btn-buscar-rapido...');
    await page.click('#btn-buscar-rapido');

    // Esperar un momento a que se complete la llamada fetch
    await new Promise(r => setTimeout(r, 1000));

    // 4. Verificar errores JS en la consola del navegador
    console.log(`[Test] Errores capturados en la página: ${pageErrors.length}`);
    if (pageErrors.length > 0) {
        console.error('[Test] Errores encontrados:', pageErrors);
        throw new Error(`Se encontraron errores de ejecución en el frontend: ${pageErrors.join(' | ')}`);
    }

    // 5. Verificar que la llamada a la API haya ocurrido con los parámetros correctos
    console.log(`[Test] Llamada a /api/buscar-individual realizada: ${searchCalled}`);
    if (!searchCalled) {
        throw new Error('La llamada a /api/buscar-individual no fue ejecutada al hacer click.');
    }

    console.log('[Test] Payload recibido:', receivedPayload);
    if (!receivedPayload.producto) {
        throw new Error('El payload recibido no contiene la propiedad "producto".');
    }

    // 6. Verificar que NO tenga headless: true
    if (receivedPayload.headless === true) {
        throw new Error('El payload no debe forzar headless: true; el RPA debe ser 100% visible.');
    }

    // 7. Verificar que la tabla de resultados recientes se renderizó con las 5 columnas
    const filas = await page.$$eval('#tbody-busqueda-rapida tr', trs => trs.length);
    console.log(`[Test] Filas renderizadas en tabla búsqueda rápida: ${filas}`);
    if (filas === 0) {
        throw new Error('No se renderizaron las filas de la tabla comparativa.');
    }

    // 8. Probar botón Compra del Mes
    let compraMesCalled = false;
    app.post('/api/compra-mes', (req, res) => {
        compraMesCalled = true;
        console.log('[TestServer] /api/compra-mes recibido:', req.body);
        res.json({ success: true, message: 'Compra del mes mock iniciada' });
    });

    console.log('[Test] Haciendo click en #btn-compra-mes...');
    await page.click('#btn-compra-mes');
    await new Promise(r => setTimeout(r, 1000));

    console.log(`[Test] Llamada a /api/compra-mes realizada: ${compraMesCalled}`);
    if (!compraMesCalled) {
        throw new Error('La llamada a /api/compra-mes no fue ejecutada al hacer click.');
    }

    if (pageErrors.length > 0) {
        throw new Error(`Se encontraron errores tras click en compra del mes: ${pageErrors.join(' | ')}`);
    }

    await browser.close();
    await new Promise(resolve => testServer.close(resolve));

    console.log('✅ TODAS LAS VERIFICACIONES DEL FRONTEND Y EJECUCIÓN DE BÚSQUEDA PASARON CON ÉXITO.');
}

testFrontend().catch(err => {
    console.error('❌ Error en prueba del frontend:', err);
    process.exit(1);
});
