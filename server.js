const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
function getValidador() {
    try {
        delete require.cache[require.resolve('./validador.js')];
    } catch(e) {}
    return require('./validador.js');
}

function getCatalogo() {
    try {
        delete require.cache[require.resolve('./catalogo.js')];
    } catch(e) {}
    return require('./catalogo.js');
}

function getRpaRunner() {
    try {
        delete require.cache[require.resolve('./rpa_runner.js')];
    } catch(e) {}
    return require('./rpa_runner.js');
}

process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]:', reason);
});

const app = express();
const server = http.createServer(app);
const PORT = 3000;

server.on('error', (err) => {
    console.error('[HTTP SERVER ERROR]:', err);
});

// Servidor WebSocket integrado en /ws/rpa-stream
const wss = new WebSocketServer({ server, path: '/ws/rpa-stream' });
const wsClients = new Set();

wss.on('error', (err) => {
    console.error('[WSS ERROR]:', err);
});

// Control de concurrencia: máximo 1 ejecución simultánea
let isRpaRunning = false;
let ultimoProcesoData = null;

wss.on('connection', (ws) => {
    wsClients.add(ws);
    // Enviar estado actual al cliente que recién se conecta
    if (isRpaRunning) {
        ws.send(JSON.stringify({ type: 'status', state: 'live', message: 'Navegador RPA conectado' }));
    } else {
        ws.send(JSON.stringify({ type: 'status', state: 'idle', message: 'RPA en espera' }));
    }

    ws.on('close', () => {
        wsClients.delete(ws);
        // Si el usuario cierra la pestaña o ventana del frontend mientras corre el RPA, abortar de inmediato
        if (wsClients.size === 0 && isRpaRunning) {
            console.log('[WS] Frontend desconectado. Abortando RPA inmediatamente...');
            try {
                getRpaRunner().abortCurrentRun();
            } catch (e) {}
            isRpaRunning = false;
        }
    });

    ws.on('error', () => {
        wsClients.delete(ws);
    });
});

function broadcast(msgObj) {
    const payload = JSON.stringify(msgObj);
    for (const ws of wsClients) {
        if (ws.readyState === ws.OPEN) {
            try {
                ws.send(payload);
            } catch (e) {}
        }
    }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function runCommand(command) {
    return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error ejecutando: ${command}`);
                console.error(stderr);
                resolve({ success: false, output: stdout, error: stderr });
            } else {
                resolve({ success: true, output: stdout });
            }
        });
    });
}

// Endpoint para obtener último proceso (usado por visor-proceso.html si no hay query param)
app.get('/api/ultimo-proceso', (req, res) => {
    res.json({ success: true, data: ultimoProcesoData });
});

// Endpoint para obtener todos los datos procesados para el mini-navegador interactivo
app.get('/api/datos-completos', (req, res) => {
    try {
        const csvPath = path.join(__dirname, 'resultados.csv');
        if (!fs.existsSync(csvPath)) {
            return res.json({ success: true, items: [], ultimoProceso: ultimoProcesoData });
        }
        const vEngine = getValidador();
        const items = vEngine.leerResultadosCSV(csvPath);
        items.forEach(it => {
            const v = vEngine.validarCoincidencia(it.producto, it);
            it.estado = v.estado;
            it.valido = v.valido;
            it.motivo = v.motivo;
            it.intencion = v.intencion;
        });
        res.json({ success: true, items, ultimoProceso: ultimoProcesoData });
    } catch(e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Endpoint para obtener resultados estructurados para tablas comparativas
app.get('/api/resultados-recientes', (req, res) => {
    try {
        const csvPath = path.join(__dirname, 'resultados.csv');
        if (!fs.existsSync(csvPath)) {
            return res.json({ success: true, individual: [], compra_mes: [], individuales: [], canastaMes: [] });
        }
        const vEngine = getValidador();
        const items = vEngine.leerResultadosCSV(csvPath);
        items.forEach(it => {
            const v = vEngine.validarCoincidencia(it.producto, it);
            it.estado = v.estado;
            it.valido = v.valido;
            it.motivo = v.motivo;
        });
        const individual = items.filter(x => x.modo === 'individual');
        const compra_mes = items.filter(x => x.modo === 'compra_mes');

        function agruparPorProducto(lista) {
            const mapa = new Map();
            lista.forEach(it => {
                const prod = (it.producto || '').trim();
                if (!prod) return;
                if (!mapa.has(prod)) {
                    mapa.set(prod, { producto: prod, coto: null, carrefour: null, dia: null });
                }
                const entry = mapa.get(prod);
                const precio = parseFloat(it.precio);
                const sLower = (it.supermercado || '').toLowerCase();
                const esValido = it.valido !== false && !isNaN(precio) && precio > 0;
                if (esValido) {
                    if (sLower.includes('coto')) entry.coto = precio;
                    else if (sLower.includes('carrefour')) entry.carrefour = precio;
                    else if (sLower.includes('dia') || sLower.includes('día')) entry.dia = precio;
                }
            });
            return Array.from(mapa.values());
        }

        const individuales = agruparPorProducto(individual).reverse();
        const canastaMes = agruparPorProducto(compra_mes);

        res.json({ success: true, individual, compra_mes, individuales, canastaMes });
    } catch(e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Endpoint para obtener el catálogo cerrado estructurado
app.get('/api/catalogo', (req, res) => {
    try {
        const catEngine = getCatalogo();
        const { catalogo: catData, items } = catEngine.cargarCatalogo();
        const categorias = catEngine.listarCategorias();
        res.json({ success: true, catalogo: catData, items, categorias });
    } catch(e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Endpoint para descargar reporte_supermercados.xlsx
app.get('/api/descargar-excel', (req, res) => {
    const file = path.join(__dirname, 'reporte_supermercados.xlsx');
    if (fs.existsSync(file)) {
        res.download(file, 'reporte_supermercados.xlsx');
    } else {
        res.status(404).send('Reporte no encontrado');
    }
});

// Endpoint para descargar resultados.csv
app.get('/api/descargar-csv', (req, res) => {
    const file = path.join(__dirname, 'resultados.csv');
    if (fs.existsSync(file)) {
        res.download(file, 'resultados.csv');
    } else {
        res.status(404).send('Archivo CSV no encontrado');
    }
});

// Endpoint para leer contenido de resultados.csv
app.get('/api/csv-raw', (req, res) => {
    try {
        const file = path.join(__dirname, 'resultados.csv');
        if (fs.existsSync(file)) {
            const data = fs.readFileSync(file, 'utf8');
            res.json({ success: true, csv: data });
        } else {
            res.json({ success: true, csv: '' });
        }
    } catch(e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Endpoint para Compra del Mes
app.post('/api/compra-mes', async (req, res) => {
    if (isRpaRunning) {
        return res.status(409).json({ success: false, message: "El RPA ya está ejecutándose." });
    }

    // Validación estricta previa contra el catálogo cerrado
    const catEngine = getCatalogo();
    const valCsv = catEngine.validarArchivoCSV('input.csv');
    if (!valCsv.valido) {
        return res.status(400).json({
            success: false,
            message: 'El archivo input.csv contiene productos que no pertenecen al catálogo cerrado.',
            filasInvalidas: valCsv.filasInvalidas
        });
    }

    isRpaRunning = true;
    broadcast({ type: 'status', state: 'connecting', message: 'Conectando con el navegador...' });

    try {
        // Cerrar Excel obligatoriamente si el usuario lo tiene abierto para evitar bloqueos EBUSY
        try {
            execSync('taskkill /F /IM EXCEL.EXE', { windowsHide: true, stdio: 'ignore' });
        } catch (eKill) {}

        // Limpiar registros de compra del mes anteriores para iniciar con datos frescos
        getValidador().limpiarResultados('1');

        console.log("Iniciando compra del mes...");
        
        // Leer input.csv validado
        let itemsCanasta = [];
        if (fs.existsSync('input.csv')) {
            const lines = fs.readFileSync('input.csv', 'utf8').split('\n');
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const parts = line.split(',');
                    const prod = parts[0] ? parts[0].trim() : '';
                    const cant = parts[1] ? (parseFloat(parts[1]) || 1) : 1;
                    const unid = parts[2] ? parts[2].trim() : '';
                    const unidades = parts[3] ? (parseInt(parts[3], 10) || 1) : 1;
                    if (prod) itemsCanasta.push({ producto: prod, cantidad: cant, unidad: unid, unidades });
                }
            }
        }

        if (itemsCanasta.length === 0) {
            itemsCanasta = [
                { producto: 'leche', cantidad: 1, unidad: '1L' },
                { producto: 'arroz', cantidad: 1, unidad: '1kg' },
                { producto: 'fideos', cantidad: 1, unidad: '500g' },
                { producto: 'aceite', cantidad: 1, unidad: '1.5L' }
            ];
        }

        broadcast({ type: 'log', message: `Iniciando compra mensual para ${itemsCanasta.length} productos...` });

        const { demoMode = true, typingDelay = 20, mouseDuration = 250 } = req.body || {};

        const resultados = await getRpaRunner().runRPA({
            modo: 'compra_mes',
            items: itemsCanasta,
            demoMode,
            typingDelay,
            mouseDuration,
            onStatus: (st) => {
                if (st.type === 'log') {
                    broadcast({ type: 'log', message: st.message });
                } else if (st.type === 'progress') {
                    broadcast({ type: 'progress', percent: st.percent, message: st.message });
                    broadcast({ type: 'log', message: st.message });
                } else if (st.type === 'connected') {
                    broadcast({ type: 'status', state: 'live', message: st.message });
                } else if (st.type === 'finished') {
                    broadcast({ type: 'status', state: 'finished', message: st.message });
                } else if (st.type === 'nav') {
                    broadcast(st);
                } else if (st.type === 'error') {
                    broadcast({ type: 'status', state: st.state || 'error', message: st.message });
                    broadcast({ type: 'log', message: st.message });
                }
            }
        });

        ultimoProcesoData = {
            producto: 'Compra del Mes',
            cantidad: itemsCanasta.length,
            unidad: 'ítems',
            items: resultados
        };

        // Generar Excel consolidado
        await runCommand('node generar_excel.js');

        // Abrir automáticamente el archivo Excel con los resultados al terminar la búsqueda
        try {
            await runCommand('start "" "reporte_supermercados.xlsx"');
        } catch (errOpen) {
            console.warn("Aviso al abrir Excel automáticamente:", errOpen.message);
        }

        if (!res.headersSent && !res.destroyed) {
            res.json({
                success: true,
                message: "Compra del mes finalizada exitosamente. Reporte Excel abierto.",
                data: ultimoProcesoData
            });
        }
    } catch (e) {
        console.error("Error en compra del mes:", e);
        const isFailsafe = e.message && e.message.includes('USER_MOUSE_INTERVENTION');
        const isAborted = e.message && e.message.includes('RPA_ABORTED_BY_USER');

        let errMsg = 'RPA FINALIZADO CON ERROR: ' + e.message;
        let state = 'error';

        if (isFailsafe) {
            errMsg = '🛑 Regla estricta activada: Se detectó movimiento manual del mouse. El proceso de automatización se ha detenido de inmediato.';
            state = 'aborted';
        } else if (isAborted) {
            errMsg = 'RPA detenido inmediatamente por el usuario.';
            state = 'aborted';
        }

        broadcast({ type: 'status', state, message: errMsg });
        broadcast({ type: 'log', message: errMsg });
        if (!res.headersSent && !res.destroyed) {
            res.status(isFailsafe || isAborted ? 400 : 500).json({ success: false, message: errMsg });
        }
    } finally {
        isRpaRunning = false;
        setTimeout(() => {
            broadcast({ type: 'status', state: 'idle', message: 'RPA en espera' });
        }, 5000);
    }
});

// Endpoint para Búsqueda Individual
app.post('/api/buscar-individual', async (req, res) => {
    if (isRpaRunning) {
        return res.status(409).json({ success: false, message: "El RPA ya está ejecutándose." });
    }

    const { producto, terminoBusqueda, cantidad = 1, unidad = '', demoMode = true, typingDelay = 20, mouseDuration = 250 } = req.body || {};
    if (!producto || !producto.trim()) {
        return res.status(400).json({ success: false, message: "No se proporcionó un producto." });
    }

    const cantNum = parseFloat(cantidad) > 0 ? parseFloat(cantidad) : 1;

    // Verificar si coincide con el catálogo cerrado para enriquecer variante y presentación
    const catEngine = getCatalogo();
    let prodOficial = producto.trim();
    let cantOficial = cantNum;
    let unidOficial = (unidad || '').trim();
    let termOficial = terminoBusqueda || producto.trim();

    try {
        const valCat = catEngine.validarEntrada({ producto: producto.trim(), cantidad: cantNum, unidad: unidOficial });
        if (valCat && valCat.valido && valCat.item) {
            prodOficial = valCat.item.producto;
            cantOficial = valCat.item.cantidad;
            unidOficial = valCat.item.unidad;
            termOficial = terminoBusqueda || valCat.item.termino_busqueda || producto.trim();
        }
    } catch (eCat) {
        // En caso de cualquier error en validación de catálogo, se continúa con búsqueda libre
    }

    isRpaRunning = true;
    broadcast({ type: 'status', state: 'connecting', message: 'Conectando con el navegador...' });

    try {
        // Cerrar Excel obligatoriamente si el usuario lo tiene abierto para evitar bloqueos EBUSY
        try {
            execSync('taskkill /F /IM EXCEL.EXE', { windowsHide: true, stdio: 'ignore' });
        } catch (eKill) {}

        console.log(`Iniciando búsqueda para: ${prodOficial} (x${cantOficial} ${unidOficial}) [Demo: ${demoMode}]`);
        broadcast({ type: 'log', message: `Búsqueda individual: "${prodOficial}" (Cantidad: ${cantOficial}, Unidad: ${unidOficial || 'Automática'})` });

        // Limpieza de consulta previa
        getValidador().limpiarResultados('2');

        const resultados = await getRpaRunner().runRPA({
            modo: 'individual',
            items: [{
                producto: prodOficial,
                terminoBusqueda: termOficial,
                cantidad: cantOficial,
                unidad: unidOficial
            }],
            demoMode,
            typingDelay,
            mouseDuration,
            onStatus: (st) => {
                if (st.type === 'log') {
                    broadcast({ type: 'log', message: st.message });
                } else if (st.type === 'progress') {
                    broadcast({ type: 'progress', percent: st.percent, message: st.message });
                    broadcast({ type: 'log', message: st.message });
                } else if (st.type === 'connected') {
                    broadcast({ type: 'status', state: 'live', message: st.message });
                } else if (st.type === 'finished') {
                    broadcast({ type: 'status', state: 'finished', message: st.message });
                } else if (st.type === 'nav') {
                    broadcast(st);
                } else if (st.type === 'error') {
                    broadcast({ type: 'status', state: st.state || 'error', message: st.message });
                    broadcast({ type: 'log', message: st.message });
                }
            }
        });

        ultimoProcesoData = {
            producto: producto.trim(),
            cantidad: cantNum,
            unidad: (unidad || '').trim(),
            items: resultados
        };

        // Reporte en consola y actualización de Excel
        await runCommand(`node validador.js --reporte-individual "${producto}"`);
        await runCommand('node generar_excel.js');

        // Abrir automáticamente el archivo Excel con los resultados al terminar la búsqueda
        try {
            await runCommand('start "" "reporte_supermercados.xlsx"');
        } catch (errOpen) {
            console.warn("Aviso al abrir Excel automáticamente:", errOpen.message);
        }

        if (!res.headersSent && !res.destroyed) {
            res.json({
                success: true,
                message: `Búsqueda de "${producto}" completada. Reporte Excel abierto.`,
                data: ultimoProcesoData,
                resultados: resultados || (ultimoProcesoData ? ultimoProcesoData.items : [])
            });
        }
    } catch (e) {
        console.error("Error en búsqueda individual:", e);
        const isFailsafe = e.message && e.message.includes('USER_MOUSE_INTERVENTION');
        const isAborted = e.message && e.message.includes('RPA_ABORTED_BY_USER');

        let errMsg = 'RPA FINALIZADO CON ERROR: ' + e.message;
        let state = 'error';

        if (isFailsafe) {
            errMsg = '🛑 Regla estricta activada: Se detectó movimiento manual del mouse. El proceso de automatización se ha detenido de inmediato.';
            state = 'aborted';
        } else if (isAborted) {
            errMsg = 'RPA detenido inmediatamente por el usuario.';
            state = 'aborted';
        }

        broadcast({ type: 'status', state, message: errMsg });
        broadcast({ type: 'log', message: errMsg });
        if (!res.headersSent && !res.destroyed) {
            res.status(isFailsafe || isAborted ? 400 : 500).json({ success: false, message: errMsg });
        }
    } finally {
        isRpaRunning = false;
        setTimeout(() => {
            broadcast({ type: 'status', state: 'idle', message: 'RPA en espera' });
        }, 5000);
    }
});

app.post('/api/abrir-excel', async (req, res) => {
    try {
        const file = 'reporte_supermercados.xlsx';
        if (fs.existsSync(file)) {
            await runCommand(`start "" "${file}"`);
            res.json({ success: true, message: "Abriendo Excel..." });
        } else {
            res.json({ success: false, message: "Aún no se ha generado el reporte." });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

// Endpoint Kill-Switch para abortar la búsqueda inmediatamente
app.all('/api/abort', (req, res) => {
    console.log('[API] Solicitud de abortar RPA recibida.');
    try {
        getRpaRunner().abortCurrentRun();
    } catch (e) {}
    isRpaRunning = false;
    broadcast({ type: 'status', state: 'idle', message: 'RPA detenido inmediatamente por el usuario.' });
    res.json({ success: true, message: 'RPA abortado exitosamente.' });
});

app.post('/api/limpiar', async (req, res) => {
    try {
        const tipo = req.body.tipo; // 1, 2 o 3
        await runCommand(`node validador.js --limpiar ${tipo}`);
        await runCommand('node generar_excel.js');
        res.json({ success: true, message: "Limpieza completada y Excel actualizado." });
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

app.get('/api/input', (req, res) => {
    try {
        if (fs.existsSync('input.csv')) {
            const data = fs.readFileSync('input.csv', 'utf8');
            res.json({ success: true, data });
        } else {
            res.json({ success: true, data: "producto,modo\n" });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

app.post('/api/input', (req, res) => {
    try {
        const { contenido } = req.body;
        if (typeof contenido !== 'string') throw new Error("Contenido inválido.");

        // Validar cada línea propuesta contra el catálogo
        const catEngine = getCatalogo();
        const lines = contenido.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const invalidas = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.trim());
            const val = catEngine.validarEntrada({ producto: parts[0], cantidad: parts[1], unidad: parts[2] });
            if (!val.valido) {
                invalidas.push({ fila: i + 1, texto: lines[i], motivo: val.motivo });
            }
        }
        if (invalidas.length > 0) {
            return res.status(400).json({
                success: false,
                message: "No se puede guardar: contiene productos fuera del catálogo cerrado.",
                filasInvalidas: invalidas
            });
        }

        fs.writeFileSync('input.csv', contenido, 'utf8');
        res.json({ success: true, message: "Lista mensual actualizada correctamente y validada con el catálogo." });
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Servidor iniciado: http://localhost:${PORT}`);
    console.log(`WebSocket Stream: ws://localhost:${PORT}/ws/rpa-stream`);
    console.log(`=========================================`);
});
