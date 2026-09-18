// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// generar_excel.js - Reporte Simplificado y Ejecutivo en Excel (.xlsx)
//
// Estructura simplificada enfocada en comparar precios:
// 1. 🛒 Compra del Mes (Producto | Coto | Carrefour | Día | El ganador es este)
// 2. 🔎 Búsqueda individual (Producto | Coto | Carrefour | Día | El ganador es este)
// ==============================================================================

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const validador = require('./validador.js');

const CSV_PATH = path.join(__dirname, 'resultados.csv');
const XLSX_PATH = path.join(__dirname, 'reporte_supermercados.xlsx');

// Paleta visual limpia y profesional
const COLOR_HEADER_BG = '1F4E79';
const COLOR_HEADER_FG = 'FFFFFF';
const COLOR_GANADOR_BG = 'E2EFDA';
const COLOR_GANADOR_FG = '276A3C';
const COLOR_NODISP_FG = '888888';
const COLOR_BORDE = 'D9D9D9';
const COLOR_ZEBRA = 'F9FAFB';

// Parsea cualquier string de precio a número float válido
function parsearPrecio(precio) {
    if (typeof precio === 'number') return (!isNaN(precio) && precio > 0) ? precio : null;
    if (!precio || typeof precio !== 'string') return null;

    const limpio = precio.replace(/[^0-9,\.]/g, '').trim();
    if (!limpio) return null;

    let normalizado = limpio;
    if (limpio.includes('.') && limpio.includes(',')) {
        normalizado = limpio.replace(/\./g, '').replace(',', '.');
    } else if (limpio.includes(',')) {
        normalizado = limpio.replace(',', '.');
    } else if (limpio.includes('.')) {
        const partes = limpio.split('.');
        if (partes.length === 2 && partes[1].length === 3) {
            normalizado = partes[0] + partes[1];
        }
    }

    const num = parseFloat(normalizado);
    return (!isNaN(num) && num > 0) ? num : null;
}

// Determina el supermercado con el menor precio válido
function calcularGanador(precioCoto, precioCarrefour, precioDia) {
    const candidatos = [];
    if (precioCoto !== null && precioCoto > 0) candidatos.push({ superm: 'Coto', precio: precioCoto });
    if (precioCarrefour !== null && precioCarrefour > 0) candidatos.push({ superm: 'Carrefour', precio: precioCarrefour });
    if (precioDia !== null && precioDia > 0) candidatos.push({ superm: 'Día', precio: precioDia });

    if (candidatos.length === 0) {
        return 'No se pudo determinar un ganador';
    }

    candidatos.sort((a, b) => a.precio - b.precio);
    return candidatos[0].superm;
}

// Agrupa registros del CSV por producto y extrae precios por supermercado
function procesarFilasComparativas(items) {
    const grupos = {};
    const ordenProductos = [];

    items.forEach(it => {
        const prod = (it.producto || it.producto_solicitado || '').trim();
        if (!prod) return;
        const key = prod.toLowerCase();
        if (!grupos[key]) {
            grupos[key] = {
                nombre: prod,
                coto: null,
                carrefour: null,
                dia: null
            };
            ordenProductos.push(key);
        }

        const superm = (it.supermercado || '').toLowerCase();
        const precio = parsearPrecio(it.precio);

        // Guardar el precio si es válido y no es "NO ENCONTRADO" o "SIN STOCK"
        const stockStatus = (it.stock_status || '').toUpperCase();
        const esValido = stockStatus !== 'NO ENCONTRADO' && stockStatus !== 'SIN STOCK' && precio !== null;

        if (superm.includes('coto')) {
            if (esValido) grupos[key].coto = precio;
        } else if (superm.includes('carrefour')) {
            if (esValido) grupos[key].carrefour = precio;
        } else if (superm.includes('dia') || superm.includes('día')) {
            if (esValido) grupos[key].dia = precio;
        }
    });

    return ordenProductos.map(k => {
        const g = grupos[k];
        const ganador = calcularGanador(g.coto, g.carrefour, g.dia);
        return {
            producto: g.nombre,
            coto: g.coto,
            carrefour: g.carrefour,
            dia: g.dia,
            ganador: ganador
        };
    });
}

// Construye una hoja formateada con las 5 columnas requeridas
function construirHojaComparativa(workbook, nombreHoja, filas) {
    const ws = workbook.addWorksheet(nombreHoja, {
        views: [{ showGridLines: true }]
    });

    // Columnas exactas requeridas
    ws.columns = [
        { key: 'producto', width: 38 },
        { key: 'coto', width: 18 },
        { key: 'carrefour', width: 18 },
        { key: 'dia', width: 18 },
        { key: 'ganador', width: 28 }
    ];

    // Fila 1: Cabeceras exactas
    const headers = ['Producto', 'Coto', 'Carrefour', 'Día', 'El ganador es este'];
    const rowHeader = ws.addRow(headers);
    rowHeader.height = 30;
    headers.forEach((h, idx) => {
        const cell = rowHeader.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_HEADER_FG } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
        cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'center' };
        cell.border = {
            top: { style: 'medium', color: { argb: COLOR_HEADER_BG } },
            bottom: { style: 'medium', color: { argb: COLOR_HEADER_BG } },
            left: { style: 'thin', color: { argb: COLOR_BORDE } },
            right: { style: 'thin', color: { argb: COLOR_BORDE } }
        };
    });

    if (filas.length === 0) {
        const rEmpty = ws.addRow(['No hay datos registrados aún.', 'No encontrado', 'No encontrado', 'No encontrado', 'No se pudo determinar un ganador']);
        rEmpty.getCell(1).font = { italic: true, color: { argb: COLOR_NODISP_FG } };
        return ws;
    }

    // Filas de datos
    filas.forEach((f, idx) => {
        const row = ws.addRow([
            f.producto,
            f.coto !== null ? f.coto : 'No encontrado',
            f.carrefour !== null ? f.carrefour : 'No encontrado',
            f.dia !== null ? f.dia : 'No encontrado',
            f.ganador
        ]);
        row.height = 24;

        const isZebra = idx % 2 === 1;

        for (let colIdx = 1; colIdx <= 5; colIdx++) {
            const cell = row.getCell(colIdx);
            cell.font = { name: 'Arial', size: 10 };
            cell.border = {
                top: { style: 'thin', color: { argb: COLOR_BORDE } },
                bottom: { style: 'thin', color: { argb: COLOR_BORDE } },
                left: { style: 'thin', color: { argb: COLOR_BORDE } },
                right: { style: 'thin', color: { argb: COLOR_BORDE } }
            };

            if (isZebra) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA } };
            }

            // Formato de precios (columnas 2, 3, 4)
            if (colIdx >= 2 && colIdx <= 4) {
                if (typeof cell.value === 'number') {
                    cell.numFmt = '"$"#,##0.00';
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                } else {
                    cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: COLOR_NODISP_FG } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                }
            } else if (colIdx === 1) {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                cell.font = { name: 'Arial', size: 10, bold: true };
            } else if (colIdx === 5) {
                // Columna: El ganador es este
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                if (f.ganador && f.ganador !== 'No se pudo determinar un ganador') {
                    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_GANADOR_FG } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GANADOR_BG } };
                } else {
                    cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: '9C6500' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } };
                }
            }
        }
    });

    return ws;
}

async function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.log('[ERROR] No se encontró el archivo resultados.csv');
        return;
    }

    const items = validador.leerResultadosCSV(CSV_PATH);
    if (items.length === 0) {
        console.log('[INFO] El archivo resultados.csv no contiene registros procesables.');
        return;
    }

    const itemsMensual = items.filter(x => x.modo === 'compra_mes');
    const itemsIndividual = items.filter(x => x.modo === 'individual');

    const filasMensual = procesarFilasComparativas(itemsMensual.length > 0 ? itemsMensual : items);
    const filasIndividual = procesarFilasComparativas(itemsIndividual);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RPA Bot - UTN FRCU 2026';
    workbook.created = new Date();

    // 1. Hoja Compra del Mes
    construirHojaComparativa(
        workbook,
        'Compra del Mes',
        filasMensual
    );

    // 2. Hoja Búsqueda Rápida
    construirHojaComparativa(
        workbook,
        'Búsqueda Rápida',
        filasIndividual
    );

    await workbook.xlsx.writeFile(XLSX_PATH);
    console.log(`[OK] Reporte simplificado generado con éxito en: ${XLSX_PATH}`);
}

module.exports = {
    generarReporteExcel: main,
    main,
    parsearPrecio,
    calcularGanador,
    procesarFilasComparativas
};

if (require.main === module) {
    main().catch(err => {
        console.error('Error al generar Excel:', err);
        process.exit(1);
    });
}
