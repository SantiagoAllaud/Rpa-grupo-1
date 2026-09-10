const express = require('express');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const validador = require('./validador.js');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Clientes suscritos a Server-Sent Events (SSE)
const sseClients = new Set();

app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);
    res.write(`event: conectado\ndata: ${JSON.stringify({ message: "Conectado al monitor en tiempo real del RPA" })}\n\n`);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(payload);
        } catch (e) {
            sseClients.delete(client);
        }
    }
}

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

function runTagUIWithEvents(csvFile, isIndividual, productoBuscado = '') {
    return new Promise((resolve) => {
        broadcast('rpa_inicio', {
            modo: isIndividual ? 'individual' : 'compra_mes',
            producto: productoBuscado,
            mensaje: isIndividual ? `Iniciando consulta para: ${productoBuscado}` : 'Iniciando relevamiento de Canasta Mensual...'
        });

        const env = { ...process.env };
        const userProfile = process.env.USERPROFILE || '';
        const taguiPaths = [
            path.join(userProfile, 'tagui', 'src'),
            'C:\\tagui\\src',
            path.join(process.env.LOCALAPPDATA || '', 'tagui', 'src')
        ];
        for (const p of taguiPaths) {
            if (fs.existsSync(path.join(p, 'tagui.cmd'))) {
                env.PATH = `${p};${env.PATH}`;
                break;
            }
        }

        const child = spawn('cmd.exe', ['/c', `tagui supermercados.tag ${csvFile}`], {
            cwd: __dirname,
            env: env,
            shell: true
        });

        let currentProduct = productoBuscado;
        let productsScraped = {};

        child.stdout.on('data', (chunk) => {
            const lines = chunk.toString('utf-8').split('\n');
            lines.forEach((line) => {
                const l = line.trim();
                if (!l) return;
                console.log(`[RPA] ${l}`);

                broadcast('log', { texto: l });

                // Detectar inicio de procesamiento de producto
                const mProd = l.match(/\[INFO\] Procesando producto:\s*(.*?)(?:\s*\(Fila|\s*$)/i);
                if (mProd) {
                    currentProduct = mProd[1].trim();
                    productsScraped[currentProduct] = { Carrefour: null, COTO: null, 'Día %': null };
                    broadcast('producto_inicio', {
                        estado: 'BUSCANDO',
                        producto: currentProduct,
                        mensaje: `Iniciando búsqueda para: ${currentProduct}`
                    });
                }

                // Detectar navegación por supermercado
                const mNav = l.match(/\[(Carrefour|COTO|Día %)\] Navegando a la búsqueda de:\s*(.*)/i);
                if (mNav) {
                    const sup = mNav[1];
                    const prod = mNav[2].trim();
                    broadcast('supermercado_estado', {
                        estado: 'BUSCANDO',
                        supermercado: sup,
                        producto: prod || currentProduct,
                        mensaje: `Buscando en ${sup}...`
                    });
                }

                // Detectar extracción de datos
                const mExt = l.match(/\[(Carrefour|COTO|Día %)\] Extraído:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*)/i);
                if (mExt) {
                    const sup = mExt[1];
                    const nom = mExt[2].trim();
                    const pre = mExt[3].trim();
                    const stk = mExt[4].trim();

                    const validacion = validador.validarCoincidencia(currentProduct, {
                        nombre: nom,
                        precioStr: pre,
                        stockRaw: stk
                    });

                    const parsedPrice = validador.parsePrecio(pre);

                    if (!productsScraped[currentProduct]) {
                        productsScraped[currentProduct] = { Carrefour: null, COTO: null, 'Día %': null };
                    }
                    productsScraped[currentProduct][sup] = {
                        nombre: nom,
                        precioStr: pre,
                        precio: parsedPrice,
                        stock: stk,
                        valido: validacion.valido,
                        estado: validacion.estado,
                        motivo: validacion.motivo
                    };

                    broadcast('supermercado_resultado', {
                        estado: validacion.valido ? 'VALIDANDO' : 'DESCARTANDO PRODUCTOS INVÁLIDOS',
                        supermercado: sup,
                        producto: currentProduct,
                        nombre: nom,
                        precio: pre,
                        precioNum: parsedPrice,
                        stock: stk,
                        validacion: validacion.valido ? '✓ válida' : `❌ ${validacion.estado}`,
                        motivo: validacion.motivo
                    });

                    // Si ya se recopilaron las 3 tiendas para el producto actual, calcular decisión
                    const curData = productsScraped[currentProduct];
                    if (curData && curData['Carrefour'] && curData['COTO'] && curData['Día %']) {
                        const validos = [];
                        ['Carrefour', 'COTO', 'Día %'].forEach((s) => {
                            const item = curData[s];
                            if (item && item.valido && item.precio !== null) {
                                validos.push({ supermercado: s, precio: item.precio, nombre: item.nombre });
                            }
                        });
                        // Ordenar candidatos por precio ascendente
                        validos.sort((a, b) => a.precio - b.precio);

                        const ganador = validos.length > 0 ? validos[0] : null;
                        const motivo = ganador ? 'menor precio válido' : 'ninguna opción válida disponible';

                        broadcast('decision', {
                            estado: 'SELECCIONANDO GANADOR',
                            producto: currentProduct,
                            ganador: ganador ? ganador.supermercado : 'Ninguno',
                            precio: ganador ? validador.formatoMoneda(ganador.precio) : 'N/D',
                            motivo: motivo,
                            ranking: validos.map((v, i) => ({
                                posicion: i + 1,
                                supermercado: v.supermercado,
                                precio: validador.formatoMoneda(v.precio),
                                seleccionado: i === 0
                            }))
                        });
                    }
                }
            });
        });

        child.stderr.on('data', (data) => {
            const err = data.toString('utf-8');
            console.error(`[RPA ERROR] ${err}`);
            broadcast('log', { texto: err, error: true });
        });

        child.on('close', (code) => {
            console.log(`[RPA FIN] Código de salida: ${code}`);
            resolve({ success: code === 0 });
        });
    });
}

// API de Canasta Visual
app.get('/api/canasta', (req, res) => {
    try {
        const items = validador.leerInputCSV();
        res.json({ success: true, items });
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

app.post('/api/canasta', (req, res) => {
    try {
        const productos = req.body.productos || req.body.items;
        if (!Array.isArray(productos)) {
            return res.status(400).json({ success: false, message: "La lista de productos es inválida." });
        }
        const limpios = [];
        for (const p of productos) {
            const nombre = (p.producto || '').trim();
            const cantidad = parseInt(p.cantidad, 10);
            if (!nombre) {
                return res.status(400).json({ success: false, message: "No se permiten nombres de producto vacíos." });
            }
            if (isNaN(cantidad) || cantidad <= 0) {
                return res.status(400).json({ success: false, message: `Cantidad inválida para "${nombre}". Debe ser mayor a 0.` });
            }
            limpios.push({ producto: nombre, cantidad, modo: 'compra_mes' });
        }
        validador.guardarInputCSV(limpios);
        res.json({ success: true, message: "Canasta mensual guardada exitosamente." });
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

// Retrocompatibilidad con /api/input
app.get('/api/input', (req, res) => {
    try {
        if (fs.existsSync('input.csv')) {
            const data = fs.readFileSync('input.csv', 'utf8');
            res.json({ success: true, data });
        } else {
            res.json({ success: true, data: "producto,cantidad,modo\n" });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

app.post('/api/input', (req, res) => {
    try {
        const { contenido } = req.body;
        if (typeof contenido !== 'string') throw new Error("Contenido inválido.");
        fs.writeFileSync('input.csv', contenido, 'utf8');
        res.json({ success: true, message: "Lista mensual actualizada correctamente." });
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

// Disparo de Compra del Mes
app.post('/api/compra-mes', async (req, res) => {
    try {
        console.log("Iniciando compra del mes...");
        await runTagUIWithEvents('input.csv', false);
        console.log("Generando reporte Excel...");
        await runCommand('node generar_excel.js');
        broadcast('completado', {
            estado: 'RESULTADO FINAL',
            mensaje: 'Compra del mes finalizada exitosamente. Reporte generado.'
        });
        res.json({ success: true, message: "Compra del mes finalizada exitosamente. Reporte generado." });
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

// Búsqueda Individual
app.post('/api/buscar-individual', async (req, res) => {
    try {
        const producto = (req.body.producto || '').trim();
        if (!producto) {
            return res.status(400).json({ success: false, message: "No se proporcionó un producto." });
        }

        console.log(`Iniciando búsqueda para: ${producto}`);
        await runCommand('node validador.js --limpiar 2');
        validador.crearTempInput(producto, 1);
        await runTagUIWithEvents('temp_input.csv', true, producto);
        if (fs.existsSync('temp_input.csv')) fs.unlinkSync('temp_input.csv');
        await runCommand(`node validador.js --reporte-individual "${producto}"`);
        await runCommand('node generar_excel.js');

        broadcast('completado', {
            estado: 'RESULTADO FINAL',
            producto: producto,
            mensaje: `Búsqueda para "${producto}" finalizada y reporte actualizado.`
        });

        res.json({ success: true, message: "Búsqueda individual completada. Reporte actualizado." });
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

// Abrir Excel
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

// Limpieza de historial
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

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Servidor RPA iniciado: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
