// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// generar_excel.js - Reporte Simplificado y Ejecutivo en Excel (.xlsx)
//
// Estructura simplificada con las 5 columnas requeridas:
// 1. 🛒 Compra del Mes (Producto | Coto | Carrefour | Día | El ganador es este)
// 2. 🔎 Búsqueda Individual (Producto | Coto | Carrefour | Día | El ganador es este)
// ==============================================================================

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const validador = require('./validador.js');

const CSV_PATH = path.join(__dirname, 'resultados.csv');
const XLSX_PATH = path.join(__dirname, 'reporte_supermercados.xlsx');

// Paleta corporativa armónica
const COLOR_AZUL_HEADER = '1F4E79';
const COLOR_TEXTO_HEADER = 'FFFFFF';
const COLOR_VERDE_GANADOR = 'E2EFDA';
const COLOR_VERDE_TEXTO = '276A3C';
const COLOR_GRIS_NODISP = '888888';
const COLOR_BORDE = 'D9D9D9';
const COLOR_FILA_PAR = 'F8FAFC';
const COLOR_TOTAL_BG = 'EDF2F7';

/**
 * Parsea cualquier formato de precio de supermercado a número float válido
 */
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

/**
 * Determina el supermercado ganador según el menor precio válido
 */
function calcularGanador(precioCoto, precioCarrefour, precioDia) {
    const candidatos = [];
    if (precioCoto !== null && precioCoto > 0) candidatos.push({ superm: 'COTO', precio: precioCoto });
    if (precioCarrefour !== null && precioCarrefour > 0) candidatos.push({ superm: 'Carrefour', precio: precioCarrefour });
    if (precioDia !== null && precioDia > 0) candidatos.push({ superm: 'Día %', precio: precioDia });

    if (candidatos.length === 0) {
        return 'No se pudo determinar un ganador';
    }

    candidatos.sort((a, b) => a.precio - b.precio);
    return candidatos[0].superm;
}

/**
 * Normaliza el nombre del supermercado
 */
function normalizarSupermercado(superm) {
    if (!superm) return '';
    const s = superm.toLowerCase();
    if (s.includes('coto')) return 'coto';
    if (s.includes('carrefour')) return 'carrefour';
    if (s.includes('dia') || s.includes('día')) return 'dia';
    return '';
}

/**
 * Agrupa los registros por producto y extrae los precios por supermercado
 */
function agruparPorProducto(items) {
    const grupos = {};
    const orden = [];

    items.forEach(it => {
        const prod = (it.producto || it.producto_solicitado || '').trim();
        if (!prod) return;

        const key = prod.toLowerCase();
        if (!grupos[key]) {
            grupos[key] = {
                nombre: prod,
                coto: null,
                cotoTexto: 'No encontrado',
                carrefour: null,
                carrefourTexto: 'No encontrado',
                dia: null,
                diaTexto: 'No encontrado'
            };
            orden.push(key);
        }

        const superNorm = normalizarSupermercado(it.supermercado);
        const precioNum = parsearPrecio(it.precio);
        const tieneStock = it.stock_status ? (it.stock_status.toUpperCase() === 'DISPONIBLE') : true;

        if (superNorm === 'coto') {
            if (tieneStock && precioNum !== null) {
                grupos[key].coto = precioNum;
                grupos[key].cotoTexto = precioNum;
            } else if (!tieneStock) {
                grupos[key].cotoTexto = 'Sin stock';
            }
        } else if (superNorm === 'carrefour') {
            if (tieneStock && precioNum !== null) {
                grupos[key].carrefour = precioNum;
                grupos[key].carrefourTexto = precioNum;
            } else if (!tieneStock) {
                grupos[key].carrefourTexto = 'Sin stock';
            }
        } else if (superNorm === 'dia') {
            if (tieneStock && precioNum !== null) {
                grupos[key].dia = precioNum;
                grupos[key].diaTexto = precioNum;
            } else if (!tieneStock) {
                grupos[key].diaTexto = 'Sin stock';
            }
        }
    });

    return orden.map(key => {
        const g = grupos[key];
        const ganador = calcularGanador(g.coto, g.carrefour, g.dia);
        return {
            producto: g.nombre,
            coto: g.coto,
            cotoTexto: g.cotoTexto,
            carrefour: g.carrefour,
            carrefourTexto: g.carrefourTexto,
            dia: g.dia,
            diaTexto: g.diaTexto,
            ganador
        };
    });
}

/**
 * Aplica estilos y bordes a una fila
 */
function estilarFila(row, esPar, esTotal = false) {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
            top: { style: 'thin', color: { argb: COLOR_BORDE } },
            bottom: { style: 'thin', color: { argb: COLOR_BORDE } },
            left: { style: 'thin', color: { argb: COLOR_BORDE } },
            right: { style: 'thin', color: { argb: COLOR_BORDE } }
        };

        if (esTotal) {
            cell.font = { name: 'Calibri', size: 11, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
        } else {
            cell.font = { name: 'Calibri', size: 10 };
            if (esPar) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_FILA_PAR } };
            }
        }

        // Formato para columnas de precio (2, 3, 4)
        if (colNumber >= 2 && colNumber <= 4) {
            if (typeof cell.value === 'number') {
                cell.numFmt = '"$"#,##0.00';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLOR_GRIS_NODISP } };
            }
        }

        // Formato para columna Ganador (5)
        if (colNumber === 5) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (cell.value && cell.value !== 'No se pudo determinar un ganador') {
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR_VERDE_TEXTO } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_GANADOR } };
            } else {
                cell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLOR_GRIS_NODISP } };
            }
        }
    });
}

/**
 * Construye una hoja comparativa con las 5 columnas requeridas
 */
function construirHojaComparativa(workbook, sheetName, titulo, filas, esCanasta = false) {
    const ws = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }]
    });

    // Ancho de columnas
    ws.columns = [
        { key: 'producto', width: 38 },
        { key: 'coto', width: 18 },
        { key: 'carrefour', width: 18 },
        { key: 'dia', width: 18 },
        { key: 'ganador', width: 24 }
    ];

    // Fila 1: Título general
    ws.mergeCells('A1:E1');
    const titleCell = ws.getCell('A1');
    titleCell.value = titulo.toUpperCase();
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLOR_TEXTO_HEADER } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_HEADER } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    // Fila 2: Subtítulo de fecha
    ws.mergeCells('A2:E2');
    const subtitleCell = ws.getCell('A2');
    const fechaHoy = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    subtitleCell.value = `Generado el ${fechaHoy} • UTN FRCU - Tecnologías para la Automatización 2026`;
    subtitleCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '555555' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 20;

    // Fila 3: Espacio en blanco
    ws.getRow(3).height = 10;

    // Fila 4: Encabezados de tabla EXACTOS
    const headerRow = ws.getRow(4);
    headerRow.values = ['Producto', 'Coto', 'Carrefour', 'Día', 'El ganador es este'];
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_TEXTO_HEADER } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_HEADER } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'medium', color: { argb: COLOR_AZUL_HEADER } },
            bottom: { style: 'medium', color: { argb: COLOR_AZUL_HEADER } },
            left: { style: 'thin', color: { argb: 'FFFFFF' } },
            right: { style: 'thin', color: { argb: 'FFFFFF' } }
        };
    });

    // Filas de datos
    let rowIndex = 5;
    let totalCoto = 0, countCoto = 0;
    let totalCarrefour = 0, countCarrefour = 0;
    let totalDia = 0, countDia = 0;

    filas.forEach((item, idx) => {
        const row = ws.getRow(rowIndex);
        row.values = [
            item.producto,
            item.cotoTexto,
            item.carrefourTexto,
            item.diaTexto,
            item.ganador
        ];
        row.height = 22;
        estilarFila(row, idx % 2 === 1, false);

        if (item.coto !== null) { totalCoto += item.coto; countCoto++; }
        if (item.carrefour !== null) { totalCarrefour += item.carrefour; countCarrefour++; }
        if (item.dia !== null) { totalDia += item.dia; countDia++; }

        rowIndex++;
    });

    // Fila de Total para Canasta Mensual
    if (esCanasta && filas.length > 0) {
        const totalRow = ws.getRow(rowIndex);
        const valCoto = countCoto > 0 ? totalCoto : null;
        const valCarrefour = countCarrefour > 0 ? totalCarrefour : null;
        const valDia = countDia > 0 ? totalDia : null;
        const ganadorTotal = calcularGanador(valCoto, valCarrefour, valDia);

        totalRow.values = [
            'TOTAL ESTIMADO CANASTA',
            valCoto !== null ? valCoto : 'Incompleto',
            valCarrefour !== null ? valCarrefour : 'Incompleto',
            valDia !== null ? valDia : 'Incompleto',
            ganadorTotal
        ];
        totalRow.height = 28;
        estilarFila(totalRow, false, true);
    }
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

    const filasMensual = agruparPorProducto(itemsMensual.length > 0 ? itemsMensual : items);
    const filasIndividual = agruparPorProducto(itemsIndividual);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RPA Bot - UTN FRCU 2026';
    workbook.created = new Date();

    // 1. Hoja de Compra del Mes
    construirHojaComparativa(
        workbook,
        '🛒 Compra del Mes',
        'Canasta Mensual — Comparación de Precios',
        filasMensual,
        true
    );

    // 2. Hoja de Búsqueda Individual
    construirHojaComparativa(
        workbook,
        '🔎 Búsqueda Individual',
        'Búsqueda Rápida — Comparación de Precios',
        filasIndividual,
        false
    );

    await workbook.xlsx.writeFile(XLSX_PATH);
    console.log(`[OK] Reporte Excel simplificado generado exitosamente: ${XLSX_PATH}`);
}

if (require.main === module) {
    main().catch(err => {
        console.error('[ERROR] al generar reporte Excel:', err);
        process.exit(1);
    });
}

module.exports = {
    main,
    parsearPrecio,
    calcularGanador,
    agruparPorProducto
};
