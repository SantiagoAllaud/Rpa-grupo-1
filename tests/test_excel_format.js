const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { parsearPrecio, calcularGanador, procesarFilasComparativas, main } = require('../generar_excel.js');
const assert = require('assert');

async function testExcelOutput() {
    const dummyItems = [
        { modo: 'individual', producto: 'Coca Cola Original 2.25 L', supermercado: 'Coto', precio: '3500', stock_status: 'DISPONIBLE' },
        { modo: 'individual', producto: 'Coca Cola Original 2.25 L', supermercado: 'Carrefour', precio: '3200', stock_status: 'DISPONIBLE' },
        { modo: 'individual', producto: 'Coca Cola Original 2.25 L', supermercado: 'Día', precio: '3400', stock_status: 'DISPONIBLE' },
        { modo: 'compra_mes', producto: 'Arroz Gallo Largo Fino 1 kg', supermercado: 'Coto', precio: '2100', stock_status: 'DISPONIBLE' },
        { modo: 'compra_mes', producto: 'Arroz Gallo Largo Fino 1 kg', supermercado: 'Carrefour', precio: '2200', stock_status: 'DISPONIBLE' },
        { modo: 'compra_mes', producto: 'Arroz Gallo Largo Fino 1 kg', supermercado: 'Día', precio: '', stock_status: 'NO ENCONTRADO' }
    ];

    const csvPath = path.join(__dirname, '..', 'resultados.csv');
    const origCsv = fs.readFileSync(csvPath, 'utf8');

    const header = 'modo,producto_solicitado,nombre_encontrado,precio,supermercado,url,fecha,stock_status,cantidad,unidad\n';
    const rows = dummyItems.map(it => `${it.modo},${it.producto},${it.producto},${it.precio},${it.supermercado},https://test.com,2026-09-18,${it.stock_status},1,kg`).join('\n');
    fs.writeFileSync(csvPath, header + rows, 'utf8');

    try {
        await main();

        const xlsxPath = path.join(__dirname, '..', 'reporte_supermercados.xlsx');
        assert.ok(fs.existsSync(xlsxPath), 'El archivo reporte_supermercados.xlsx debe existir');

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(xlsxPath);

        assert.strictEqual(wb.worksheets.length, 2, 'Debe tener exactamente 2 hojas');
        const wsMes = wb.getWorksheet('Compra del Mes');
        const wsInd = wb.getWorksheet('Búsqueda Rápida');

        assert.ok(wsMes, 'Debe existir hoja Compra del Mes');
        assert.ok(wsInd, 'Debe existir hoja Búsqueda Rápida');

        const expectedHeaders = ['Producto', 'Coto', 'Carrefour', 'Día', 'El ganador es este'];
        const row1Mes = wsMes.getRow(1).values.slice(1);
        assert.deepStrictEqual(row1Mes, expectedHeaders, 'Cabeceras de Compra del Mes deben ser exactas');

        const row1Ind = wsInd.getRow(1).values.slice(1);
        assert.deepStrictEqual(row1Ind, expectedHeaders, 'Cabeceras de Búsqueda Rápida deben ser exactas');

        // Búsqueda Rápida row 2
        const row2Ind = wsInd.getRow(2).values.slice(1);
        assert.strictEqual(row2Ind[0], 'Coca Cola Original 2.25 L');
        assert.strictEqual(row2Ind[1], 3500);
        assert.strictEqual(row2Ind[2], 3200);
        assert.strictEqual(row2Ind[3], 3400);
        assert.strictEqual(row2Ind[4], 'Carrefour');

        // Compra del Mes row 2
        const row2Mes = wsMes.getRow(2).values.slice(1);
        assert.strictEqual(row2Mes[0], 'Arroz Gallo Largo Fino 1 kg');
        assert.strictEqual(row2Mes[1], 2100);
        assert.strictEqual(row2Mes[2], 2200);
        assert.strictEqual(row2Mes[3], 'No encontrado');
        assert.strictEqual(row2Mes[4], 'Coto');

        console.log('✅ Prueba de formato de Excel superada exitosamente.');
    } finally {
        fs.writeFileSync(csvPath, origCsv, 'utf8');
    }
}

testExcelOutput().catch(err => {
    console.error('❌ Error en prueba de Excel:', err);
    process.exit(1);
});
