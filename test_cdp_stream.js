// Prueba aislada de conexión CDP Screencast y recepción de frames en vivo
const puppeteer = require('puppeteer-core');
const { getChromePath } = require('./rpa_runner.js');

async function testCDP() {
    console.log('[Test CDP] Obteniendo ruta de Chrome...');
    const chromePath = getChromePath();
    console.log('[Test CDP] Chrome encontrado en:', chromePath);

    console.log('[Test CDP] Iniciando navegador visible...');
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        defaultViewport: { width: 1280, height: 720 },
        args: ['--window-size=1366,820', '--no-first-run']
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    console.log('[Test CDP] Conectando sesión CDP...');
    const cdpSession = await page.target().createCDPSession();

    let frameCount = 0;
    let lastFrameSize = 0;

    cdpSession.on('Page.screencastFrame', async ({ data, sessionId }) => {
        frameCount++;
        lastFrameSize = data ? data.length : 0;
        try {
            await cdpSession.send('Page.screencastFrameAck', { sessionId });
        } catch (e) {}
    });

    console.log('[Test CDP] Iniciando Page.startScreencast...');
    await cdpSession.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 85,
        maxWidth: 1280,
        maxHeight: 720,
        everyNthFrame: 1
    });

    console.log('[Test CDP] Navegando a https://www.google.com y realizando tipeo...');
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    // Tipear algo para provocar actividad visual y frames
    try {
        const inputSelector = 'textarea[name="q"], input[name="q"]';
        await page.waitForSelector(inputSelector, { timeout: 5000 });
        await page.type(inputSelector, 'RPA Supermercados Test CDP Live', { delay: 60 });
    } catch (e) {
        console.log('[Test CDP] Info:', e.message);
    }

    // Esperar 2 segundos más para acumular frames
    await new Promise(r => setTimeout(r, 2500));

    console.log(`[Test CDP] Frames recibidos: ${frameCount}, tamaño último frame: ${lastFrameSize} bytes`);

    await cdpSession.send('Page.stopScreencast');
    await cdpSession.detach();
    await browser.close();

    if (frameCount > 0 && lastFrameSize > 1000) {
        console.log('>>> TEST CDP EXITOSO: Frames generados y capturados correctamente por el protocolo CDP.');
        process.exit(0);
    } else {
        console.error('>>> TEST CDP FALLIDO: No se recibieron frames suficientes.');
        process.exit(1);
    }
}

testCDP().catch(err => {
    console.error('Error durante test CDP:', err);
    process.exit(1);
});
