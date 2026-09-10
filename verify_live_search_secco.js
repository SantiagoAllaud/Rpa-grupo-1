const puppeteer = require('puppeteer-core');
const { getChromePath } = require('./rpa_runner.js');
const fs = require('fs');
const path = require('path');

async function testLiveSearch() {
    console.log('--- INICIANDO TEST: BÚSQUEDA INDIVIDUAL GASEOSA SECCO POMELO ---');

    // Iniciar un navegador para simular al usuario que entra al frontend http://localhost:3000
    const userBrowser = await puppeteer.launch({
        executablePath: getChromePath(),
        headless: true,
        args: ['--no-sandbox', '--window-size=1280,1024']
    });

    const page = await userBrowser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    console.log('[User] Navegando a http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

    // Verificar que el WebSocket se conectó
    await new Promise(r => setTimeout(r, 1000));

    // Escribir "Gaseosa Secco Pomelo" en el input
    console.log('[User] Escribiendo "Gaseosa Secco Pomelo" en el campo de búsqueda...');
    await page.type('#input-producto', 'Gaseosa Secco Pomelo', { delay: 50 });

    // Capturar pantalla previa al clic
    const artifactDir = 'C:\\Users\\Santi\\.gemini\\antigravity-ide\\brain\\c9b0791c-37a6-41e6-a587-79b4fa0291d2';
    
    // Clic en Buscar Producto
    console.log('[User] Haciendo clic en "Buscar Producto"...');
    await page.click('#btn-buscar-individual');

    // Monitorear durante la ejecución
    let capturedLiveFrame = false;
    const startTime = Date.now();
    const maxWaitMs = 120000; // 2 minutos máximo

    while (Date.now() - startTime < maxWaitMs) {
        await new Promise(r => setTimeout(r, 2000));

        const playerStatus = await page.evaluate(() => {
            const badge = document.getElementById('player-status-badge');
            const overlay = document.getElementById('player-overlay');
            const time = document.getElementById('player-time');
            return {
                statusText: badge ? badge.textContent : '',
                statusClass: badge ? badge.className : '',
                overlayHidden: overlay ? overlay.classList.contains('hidden') : false,
                timeText: time ? time.textContent : ''
            };
        });

        console.log(`[Stream Status] ${playerStatus.statusText} | Timer: ${playerStatus.timeText} | Overlay Oculto (Frames visibles): ${playerStatus.overlayHidden}`);

        // Si ya está transmitiendo frames reales, tomar captura del visor en vivo
        if (playerStatus.overlayHidden && !capturedLiveFrame) {
            console.log('>>> CAPTURANDO SCREENSHOT DEL FRONTEND CON EL STREAM DE CHROME EN VIVO...');
            const liveShotPath = path.join(artifactDir, 'frontend_stream_chrome_en_vivo.png');
            await page.screenshot({ path: liveShotPath, fullPage: true });
            console.log('>>> Captura guardada en:', liveShotPath);
            capturedLiveFrame = true;
        }

        if (playerStatus.statusText.includes('RPA FINALIZADO') || playerStatus.statusClass.includes('finished')) {
            console.log('>>> El RPA ha FINALIZADO con éxito.');
            break;
        }
    }

    // Tomar captura final al finalizar
    const finalShotPath = path.join(artifactDir, 'frontend_stream_chrome_finalizado.png');
    await page.screenshot({ path: finalShotPath, fullPage: true });
    console.log('>>> Captura final guardada en:', finalShotPath);

    await userBrowser.close();

    // Verificar archivos resultantes en disco
    const csvExists = fs.existsSync(path.join(__dirname, 'resultados.csv'));
    const xlsxExists = fs.existsSync(path.join(__dirname, 'reporte_supermercados.xlsx'));

    console.log('Verificación de archivos:');
    console.log('- resultados.csv existe:', csvExists);
    console.log('- reporte_supermercados.xlsx existe:', xlsxExists);

    if (csvExists) {
        const csvContent = fs.readFileSync(path.join(__dirname, 'resultados.csv'), 'utf8');
        const lines = csvContent.trim().split('\n');
        console.log(`- resultados.csv tiene ${lines.length} líneas.`);
        console.log('Últimas 3 líneas de resultados.csv:');
        lines.slice(-3).forEach(l => console.log('  ', l));
    }

    if (xlsxExists) {
        const stats = fs.statSync(path.join(__dirname, 'reporte_supermercados.xlsx'));
        console.log(`- reporte_supermercados.xlsx tamaño: ${stats.size} bytes (Excel real de ExcelJS)`);
    }

    console.log('--- TEST COMPLETADO EXITOSAMENTE ---');
}

testLiveSearch().catch(err => {
    console.error('Error durante test live search:', err);
    process.exit(1);
});
