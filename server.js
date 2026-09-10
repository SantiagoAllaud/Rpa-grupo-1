const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function runCommand(command) {
    return new Promise((resolve, reject) => {
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

app.post('/api/compra-mes', async (req, res) => {
    try {
        console.log("Iniciando compra del mes...");
        await runCommand('tagui supermercados.tag input.csv');
        await runCommand('node generar_excel.js');
        res.json({ success: true, message: "Compra del mes finalizada exitosamente. Reporte generado." });
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
    }
});

app.post('/api/buscar-individual', async (req, res) => {
    try {
        const producto = req.body.producto;
        if (!producto) {
            return res.status(400).json({ success: false, message: "No se proporcionó un producto." });
        }
        
        console.log(`Iniciando búsqueda para: ${producto}`);
        await runCommand('node validador.js --limpiar 2');
        await runCommand(`node validador.js --crear-temp "${producto}"`);
        await runCommand('tagui supermercados.tag temp_input.csv');
        if (fs.existsSync('temp_input.csv')) fs.unlinkSync('temp_input.csv');
        await runCommand(`node validador.js --reporte-individual "${producto}"`);
        await runCommand('node generar_excel.js');
        
        res.json({ success: true, message: "Búsqueda individual completada. Reporte actualizado." });
    } catch (e) {
        res.status(500).json({ success: false, message: e.toString() });
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
    console.log(`Servidor iniciado: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
