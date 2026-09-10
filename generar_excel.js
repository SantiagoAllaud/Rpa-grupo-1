// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// generar_excel.js - Generador de Reporte Avanzado en Excel (.xlsx)
//
// Exactamente 4 Hojas Estilizadas:
// 1. 🏆 Conclusiones (Costo total con cantidades, ganador, compra combinada, sección ⚠ PRODUCTOS CON PROBLEMAS)
// 2. 🛒 Canasta Mensual (Matriz comparativa con Cantidad, Subtotales por súper y ganador)
// 3. 🔎 Consultas Individuales (Historial de búsquedas unitarias con validación independiente)
// 4. ⚠️ Disponibilidad y Stock (Detalle técnico de auditoría: sin stock, no encontrados o no válidos)
// ==============================================================================

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const validador = require('./validador.js');

const CSV_PATH = path.join(__dirname, 'resultados.csv');
const XLSX_PATH = path.join(__dirname, 'reporte_supermercados.xlsx');

// Paleta corporativa armónica
const COLOR_AZUL_OSCURO = '1F4E79';
const COLOR_AZUL_TITULO = '2F5597';
const COLOR_AZUL_CLARO = 'D9E1F2';
const COLOR_VERDE_PASTEL = 'E2EFDA';
const COLOR_VERDE_TEXTO = '276A3C';
const COLOR_ROJO_PASTEL = 'FCE4D6';
const COLOR_ROJO_TEXTO = 'C00000';
const COLOR_AMARILLO_PASTEL = 'FFF2CC';
const COLOR_AMARILLO_TEXTO = '9C6500';
const COLOR_GRIS_FONDO = 'F2F4F7';
const COLOR_BORDE = 'D9D9D9';

function aplicarBordes(ws, cIni, fIni, cFin, fFin) {
    var cols = [];
    for (var c = cIni.charCodeAt(0); c <= cFin.charCodeAt(0); c++) {
        cols.push(String.fromCharCode(c));
    }
    cols.forEach(function(col) {
        for (var r = fIni; r <= fFin; r++) {
            var cell = ws.getCell(col + r);
            cell.border = {
                top: { style: 'thin', color: { argb: COLOR_BORDE } },
                bottom: { style: 'thin', color: { argb: COLOR_BORDE } },
                left: { style: 'thin', color: { argb: COLOR_BORDE } },
                right: { style: 'thin', color: { argb: COLOR_BORDE } }
            };
        }
    });
}

async function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.log('[ERROR] No se encontró el archivo resultados.csv');
        return;
    }

    var items = validador.leerResultadosCSV(CSV_PATH);
    if (items.length === 0) {
        console.log('[INFO] El archivo resultados.csv no contiene registros procesables.');
        return;
    }

    // Validar cada elemento con el motor inteligente
    items.forEach(function(it) {
        var v = validador.validarCoincidencia(it.producto, it);
        it.estado = v.estado;
        it.valido = v.valido;
        it.motivo = v.motivo;
        it.intencion = v.intencion;
    });

    // Mapeo de cantidades desde input.csv para canasta mensual
    var inputsCanasta = validador.leerInputCSV();
    var mapCantidades = {};
    inputsCanasta.forEach(function(inp) {
        mapCantidades[inp.producto.toLowerCase().trim()] = inp.cantidad || 1;
    });

    var itemsMensual = items.filter(function(x) { return x.modo === 'compra_mes'; });
    var itemsIndividual = items.filter(function(x) { return x.modo === 'individual'; });

    if (itemsMensual.length === 0 && itemsIndividual.length === 0) {
        itemsMensual = items;
    }

    var workbook = new ExcelJS.Workbook();
    workbook.creator = 'RPA Bot - UTN FRCU';
    workbook.created = new Date();

    // ==============================================================================
    // 1. ANÁLISIS DE LA CANASTA MENSUAL (CON CANTIDADES REALES)
    // ==============================================================================
    var productosMensualUnicos = [];
    var grupoMensual = {};

    itemsMensual.forEach(function(it) {
        var p = it.producto.toLowerCase().trim();
        if (!grupoMensual[p]) {
            grupoMensual[p] = [];
            productosMensualUnicos.push(p);
        }
        grupoMensual[p].push(it);
    });

    var supersList = ['Carrefour', 'COTO', 'Día %'];
    var totalesCanasta = { 'Carrefour': 0, 'COTO': 0, 'Día %': 0 };
    var conteoDisponibles = { 'Carrefour': 0, 'COTO': 0, 'Día %': 0 };
    var conteoProblemas = { 'Carrefour': 0, 'COTO': 0, 'Día %': 0 };
    var conteoGanados = { 'Carrefour': 0, 'COTO': 0, 'Día %': 0 };

    var filasCanasta = [];
    var costoOptimoCombinado = 0;
    var totalUnidadesCanasta = 0;

    // Métricas de incidencias para Conclusiones
    var incidenciasPorProducto = [];
    var totalCasosNoEncontrado = 0;
    var totalCasosSinStock = 0;
    var totalCasosNoValida = 0;

    productosMensualUnicos.forEach(function(prod) {
        var cant = mapCantidades[prod] || 1;
        totalUnidadesCanasta += cant;

        var itemsDelProd = grupoMensual[prod];
        var preciosPorSuper = {};
        var subtotalesPorSuper = {};
        var itemsPorSuper = {};
        var estadosPorSuper = {};

        supersList.forEach(function(s) {
            var found = itemsDelProd.filter(function(x) { return x.supermercado === s; }).pop();
            itemsPorSuper[s] = found || null;
            if (found && found.valido && found.precio !== null) {
                preciosPorSuper[s] = found.precio;
                var subtotal = found.precio * cant;
                subtotalesPorSuper[s] = subtotal;
                totalesCanasta[s] += subtotal;
                conteoDisponibles[s]++;
                estadosPorSuper[s] = 'DISPONIBLE';
            } else {
                preciosPorSuper[s] = null;
                subtotalesPorSuper[s] = null;
                conteoProblemas[s]++;
                var est = found ? found.estado : 'NO ENCONTRADO';
                estadosPorSuper[s] = est;
                if (est === 'NO ENCONTRADO') totalCasosNoEncontrado++;
                else if (est === 'SIN STOCK') totalCasosSinStock++;
                else if (est === 'COINCIDENCIA NO VÁLIDA') totalCasosNoValida++;
            }
        });

        // Encontrar opción más barata para este producto considerando cantidad
        var validos = [];
        supersList.forEach(function(s) {
            if (preciosPorSuper[s] !== null) {
                validos.push({
                    superm: s,
                    precioUnitario: preciosPorSuper[s],
                    subtotal: subtotalesPorSuper[s],
                    item: itemsPorSuper[s]
                });
            }
        });
        // Ordenar candidatos válidos por precio/subtotal ascendente: MENOR PRECIO VÁLIDO GANA
        validos.sort(function(a, b) { return a.subtotal - b.subtotal; });

        var ganadorProd = validos.length > 0 ? validos[0] : null;
        var masCaroProd = validos.length > 1 ? validos[validos.length - 1] : null;
        var ahorroProd = (ganadorProd && masCaroProd) ? (masCaroProd.subtotal - ganadorProd.subtotal) : 0;

        if (ganadorProd) {
            costoOptimoCombinado += ganadorProd.subtotal;
            conteoGanados[ganadorProd.superm]++;
        }

        // Evaluar si tuvo incidencias en algún súper
        var tieneIncidencia = (estadosPorSuper['Carrefour'] !== 'DISPONIBLE' ||
                               estadosPorSuper['COTO'] !== 'DISPONIBLE' ||
                               estadosPorSuper['Día %'] !== 'DISPONIBLE');

        if (tieneIncidencia) {
            incidenciasPorProducto.push({
                producto: prod,
                cantidad: cant,
                carrefour: estadosPorSuper['Carrefour'],
                coto: estadosPorSuper['COTO'],
                dia: estadosPorSuper['Día %']
            });
        }

        filasCanasta.push({
            producto: prod,
            cantidad: cant,
            carrefour: itemsPorSuper['Carrefour'],
            coto: itemsPorSuper['COTO'],
            dia: itemsPorSuper['Día %'],
            precios: preciosPorSuper,
            subtotales: subtotalesPorSuper,
            estados: estadosPorSuper,
            ganador: ganadorProd,
            masCaro: masCaroProd,
            ahorro: ahorroProd
        });
    });

    // Determinar Supermercado Recomendado para toda la canasta (menor costo total válido)
    var superRecomendado = 'N/D';
    var menorCostoCanasta = Infinity;
    supersList.forEach(function(s) {
        if (totalesCanasta[s] > 0 && totalesCanasta[s] < menorCostoCanasta) {
            menorCostoCanasta = totalesCanasta[s];
            superRecomendado = s;
        }
    });

    var mayorCostoCanasta = 0;
    supersList.forEach(function(s) {
        if (totalesCanasta[s] > mayorCostoCanasta) {
            mayorCostoCanasta = totalesCanasta[s];
        }
    });

    var ahorroCanastaRecomendada = mayorCostoCanasta > menorCostoCanasta ? (mayorCostoCanasta - menorCostoCanasta) : 0;
    var ahorroCombinadoMaximo = mayorCostoCanasta > costoOptimoCombinado ? (mayorCostoCanasta - costoOptimoCombinado) : 0;

    var totalSolicitados = productosMensualUnicos.length;
    var totalCompletamenteDisponibles = totalSolicitados - incidenciasPorProducto.length;
    var totalConProblemas = incidenciasPorProducto.length;


    // ==============================================================================
    // HOJA 1: 🏆 CONCLUSIONES Y DECISIÓN DE COMPRA
    // ==============================================================================
    var ws1 = workbook.addWorksheet('🏆 Conclusiones', { views: [{ showGridLines: true }] });

    // Título Principal
    ws1.mergeCells('B2:H2');
    var tCell = ws1.getCell('B2');
    tCell.value = '🛒 REPORTE RPA: COMPARADOR DE PRECIOS Y CANASTA INTELIGENTE';
    tCell.font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    tCell.alignment = { vertical: 'middle', horizontal: 'center' };
    tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_OSCURO } };
    ws1.getRow(2).height = 36;

    // Subtítulo
    ws1.mergeCells('B3:H3');
    var stCell = ws1.getCell('B3');
    stCell.value = 'Relevamiento en tiempo real en Carrefour, COTO y Día % • Canasta con cantidades y optimización de costos • ' + new Date().toLocaleDateString('es-AR');
    stCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF555555' } };
    stCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(3).height = 20;

    // KPI Cards Fila 5-6
    // Card 1: Supermercado Recomendado Canasta
    ws1.mergeCells('B5:C5');
    ws1.getCell('B5').value = '🏆 SÚPER RECOMENDADO (CANASTA)';
    ws1.getCell('B5').font = { size: 9, bold: true, color: { argb: 'FF555555' } };
    ws1.getCell('B5').alignment = { horizontal: 'center' };
    ws1.mergeCells('B6:C6');
    ws1.getCell('B6').value = superRecomendado;
    ws1.getCell('B6').font = { size: 14, bold: true, color: { argb: COLOR_VERDE_TEXTO } };
    ws1.getCell('B6').alignment = { horizontal: 'center' };

    // Card 2: Costo Total Canasta Ganadora
    ws1.mergeCells('D5:E5');
    ws1.getCell('D5').value = '💰 COSTO CANASTA RECOMENDADA';
    ws1.getCell('D5').font = { size: 9, bold: true, color: { argb: 'FF555555' } };
    ws1.getCell('D5').alignment = { horizontal: 'center' };
    ws1.mergeCells('D6:E6');
    ws1.getCell('D6').value = menorCostoCanasta !== Infinity ? menorCostoCanasta : 0;
    ws1.getCell('D6').numFmt = '"$"#,##0.00';
    ws1.getCell('D6').font = { size: 14, bold: true, color: { argb: COLOR_AZUL_TITULO } };
    ws1.getCell('D6').alignment = { horizontal: 'center' };

    // Card 3: Compra Combinada Óptima
    ws1.mergeCells('F5:G5');
    ws1.getCell('F5').value = '⚡ COMPRA COMBINADA ÓPTIMA';
    ws1.getCell('F5').font = { size: 9, bold: true, color: { argb: 'FF555555' } };
    ws1.getCell('F5').alignment = { horizontal: 'center' };
    ws1.mergeCells('F6:G6');
    ws1.getCell('F6').value = costoOptimoCombinado;
    ws1.getCell('F6').numFmt = '"$"#,##0.00';
    ws1.getCell('F6').font = { size: 14, bold: true, color: { argb: COLOR_VERDE_TEXTO } };
    ws1.getCell('F6').alignment = { horizontal: 'center' };

    // Card 4: Ahorro Máximo Potencial
    ws1.getCell('H5').value = '💸 AHORRO MÁXIMO';
    ws1.getCell('H5').font = { size: 9, bold: true, color: { argb: 'FF555555' } };
    ws1.getCell('H5').alignment = { horizontal: 'center' };
    ws1.getCell('H6').value = ahorroCombinadoMaximo;
    ws1.getCell('H6').numFmt = '"$"#,##0.00';
    ws1.getCell('H6').font = { size: 14, bold: true, color: { argb: COLOR_VERDE_TEXTO } };
    ws1.getCell('H6').alignment = { horizontal: 'center' };

    ['B5','C5','D5','E5','F5','G5','H5','B6','C6','D6','E6','F6','G6','H6'].forEach(function(pos) {
        ws1.getCell(pos).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GRIS_FONDO } };
    });
    aplicarBordes(ws1, 'B', 5, 'H', 6);
    ws1.getRow(5).height = 18;
    ws1.getRow(6).height = 28;

    // Tabla 1: Costo Total por Supermercado (Fila 8)
    ws1.mergeCells('B8:H8');
    var secTitle1 = ws1.getCell('B8');
    secTitle1.value = '📊 EVALUACIÓN COMPARATIVA: COSTO TOTAL DE LA CANASTA COMPLETA (CON CANTIDADES)';
    secTitle1.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    secTitle1.alignment = { vertical: 'middle', horizontal: 'left' };
    secTitle1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_TITULO } };
    ws1.getRow(8).height = 24;

    var hT1 = [
        { col: 'B', text: 'Supermercado' },
        { col: 'C', text: 'Costo Canasta Total' },
        { col: 'D', text: 'Artículos Disponibles' },
        { col: 'E', text: 'Artículos con Problema' },
        { col: 'F', text: 'Precios Más Bajos Ganados' },
        { col: 'G', text: 'Diferencia vs Mejor' },
        { col: 'H', text: 'Estado / Recomendación' }
    ];
    ws1.getRow(9).height = 22;
    hT1.forEach(function(h) {
        var cell = ws1.getCell(h.col + '9');
        cell.value = h.text;
        cell.font = { size: 10, bold: true, color: { argb: COLOR_AZUL_OSCURO } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_CLARO } };
    });

    var rT1 = 10;
    supersList.forEach(function(s) {
        ws1.getRow(rT1).height = 22;
        var esGanador = (s === superRecomendado);

        ws1.getCell('B' + rT1).value = s;
        ws1.getCell('B' + rT1).font = { bold: true };
        ws1.getCell('B' + rT1).alignment = { vertical: 'middle', horizontal: 'left' };

        var cCosto = ws1.getCell('C' + rT1);
        cCosto.value = totalesCanasta[s] > 0 ? totalesCanasta[s] : 0;
        cCosto.numFmt = '"$"#,##0.00';
        cCosto.font = { bold: true, color: { argb: esGanador ? COLOR_VERDE_TEXTO : 'FF333333' } };
        cCosto.alignment = { vertical: 'middle', horizontal: 'right' };
        if (esGanador) cCosto.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };

        ws1.getCell('D' + rT1).value = conteoDisponibles[s] + ' de ' + totalSolicitados;
        ws1.getCell('D' + rT1).alignment = { vertical: 'middle', horizontal: 'center' };

        ws1.getCell('E' + rT1).value = conteoProblemas[s];
        ws1.getCell('E' + rT1).alignment = { vertical: 'middle', horizontal: 'center' };
        if (conteoProblemas[s] > 0) {
            ws1.getCell('E' + rT1).font = { bold: true, color: { argb: COLOR_ROJO_TEXTO } };
        }

        ws1.getCell('F' + rT1).value = conteoGanados[s] + ' productos';
        ws1.getCell('F' + rT1).alignment = { vertical: 'middle', horizontal: 'center' };

        var dif = totalesCanasta[s] - menorCostoCanasta;
        ws1.getCell('G' + rT1).value = dif > 0 ? ('+$' + dif.toLocaleString('es-AR', { minimumFractionDigits: 2 })) : 'Mejor opción';
        ws1.getCell('G' + rT1).font = { bold: esGanador, color: { argb: esGanador ? COLOR_VERDE_TEXTO : 'FF666666' } };
        ws1.getCell('G' + rT1).alignment = { vertical: 'middle', horizontal: 'center' };

        var cRec = ws1.getCell('H' + rT1);
        cRec.value = esGanador ? '🏆 RECOMENDADO' : (dif > 0 ? 'Más costoso' : 'Sin datos');
        cRec.font = { bold: esGanador, color: { argb: esGanador ? COLOR_VERDE_TEXTO : 'FF777777' } };
        cRec.alignment = { vertical: 'middle', horizontal: 'center' };
        if (esGanador) cRec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };

        rT1++;
    });
    aplicarBordes(ws1, 'B', 9, 'H', rT1 - 1);

    // Tabla 2: Resumen del Producto Ganador por Categoría (con Cantidad y Subtotal)
    var rT2 = rT1 + 1;
    ws1.mergeCells('B' + rT2 + ':H' + rT2);
    var secTitle2 = ws1.getCell('B' + rT2);
    secTitle2.value = '🛒 PRODUCTO GANADOR POR ARTÍCULO (MEJOR PRECIO Y COMPRA COMBINADA)';
    secTitle2.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    secTitle2.alignment = { vertical: 'middle', horizontal: 'left' };
    secTitle2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_TITULO } };
    ws1.getRow(rT2).height = 24;

    var hT2 = [
        { col: 'B', text: 'Artículo Solicitado' },
        { col: 'C', text: 'Cant.' },
        { col: 'D', text: '🏆 Súper Más Barato' },
        { col: 'E', text: 'Producto Encontrado' },
        { col: 'F', text: 'Subtotal Elegido' },
        { col: 'G', text: 'Ahorro Posible' },
        { col: 'H', text: 'Enlace Directo' }
    ];
    rT2++;
    ws1.getRow(rT2).height = 22;
    hT2.forEach(function(h) {
        var cell = ws1.getCell(h.col + rT2);
        cell.value = h.text;
        cell.font = { size: 10, bold: true, color: { argb: COLOR_AZUL_OSCURO } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_CLARO } };
    });

    var rDataT2Start = rT2 + 1;
    filasCanasta.forEach(function(f) {
        rT2++;
        ws1.getRow(rT2).height = 22;

        ws1.getCell('B' + rT2).value = f.producto.toUpperCase();
        ws1.getCell('B' + rT2).font = { bold: true, size: 9 };
        ws1.getCell('B' + rT2).alignment = { vertical: 'middle', horizontal: 'left' };

        ws1.getCell('C' + rT2).value = f.cantidad;
        ws1.getCell('C' + rT2).font = { bold: true, size: 9 };
        ws1.getCell('C' + rT2).alignment = { vertical: 'middle', horizontal: 'center' };

        var cSupG = ws1.getCell('D' + rT2);
        cSupG.value = f.ganador ? ('🏆 ' + f.ganador.superm) : 'Sin opción válida';
        cSupG.font = { bold: true, color: { argb: f.ganador ? COLOR_VERDE_TEXTO : COLOR_ROJO_TEXTO }, size: 9 };
        cSupG.alignment = { vertical: 'middle', horizontal: 'center' };
        if (f.ganador) cSupG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };

        ws1.getCell('E' + rT2).value = f.ganador && f.ganador.item ? f.ganador.item.nombre : 'No encontrado';
        ws1.getCell('E' + rT2).alignment = { vertical: 'middle', horizontal: 'left' };
        ws1.getCell('E' + rT2).font = { size: 9 };

        var cSubt = ws1.getCell('F' + rT2);
        if (f.ganador) {
            cSubt.value = f.ganador.subtotal;
            cSubt.numFmt = '"$"#,##0.00';
            cSubt.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
            cSubt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
        } else {
            cSubt.value = 'N/D';
        }
        cSubt.alignment = { vertical: 'middle', horizontal: 'right' };

        var cAho = ws1.getCell('G' + rT2);
        cAho.value = f.ahorro > 0 ? ('-$' + f.ahorro.toLocaleString('es-AR', { minimumFractionDigits: 0 })) : 'Mismo valor';
        cAho.font = { bold: f.ahorro > 0, color: { argb: f.ahorro > 0 ? COLOR_VERDE_TEXTO : 'FF666666' }, size: 9 };
        cAho.alignment = { vertical: 'middle', horizontal: 'center' };

        var cLnk = ws1.getCell('H' + rT2);
        if (f.ganador && f.ganador.item && f.ganador.item.url && f.ganador.item.url.startsWith('http')) {
            cLnk.value = { text: '🔗 Ver en Tienda', hyperlink: f.ganador.item.url };
            cLnk.font = { color: { argb: 'FF0563C1' }, underline: true, size: 9 };
        } else {
            cLnk.value = '-';
        }
        cLnk.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    aplicarBordes(ws1, 'B', rDataT2Start - 1, 'H', rT2);


    // ==============================================================================
    // TABLA 3 EN CONCLUSIONES: ⚠️ PRODUCTOS CON PROBLEMAS O FALTANTES
    // ==============================================================================
    var rT3 = rT2 + 2;
    ws1.mergeCells('B' + rT3 + ':H' + rT3);
    var secTitle3 = ws1.getCell('B' + rT3);
    secTitle3.value = '⚠️ PRODUCTOS CON PROBLEMAS (DISPONIBILIDAD Y VALIDACIÓN EN CANASTA)';
    secTitle3.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    secTitle3.alignment = { vertical: 'middle', horizontal: 'left' };
    secTitle3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB25E00' } };
    ws1.getRow(rT3).height = 24;

    var hT3 = [
        { col: 'B', text: 'Producto Solicitado' },
        { col: 'C', text: 'Cant.' },
        { col: 'D', text: 'Carrefour' },
        { col: 'E', text: 'COTO' },
        { col: 'F', text: 'Día %' },
        { col: 'G', text: 'Diagnóstico' },
        { col: 'H', text: 'Impacto' }
    ];
    rT3++;
    ws1.getRow(rT3).height = 22;
    hT3.forEach(function(h) {
        var cell = ws1.getCell(h.col + rT3);
        cell.value = h.text;
        cell.font = { size: 10, bold: true, color: { argb: COLOR_AZUL_OSCURO } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AMARILLO_PASTEL } };
    });

    var rDataT3Start = rT3 + 1;
    if (incidenciasPorProducto.length === 0) {
        rT3++;
        ws1.getRow(rT3).height = 24;
        ws1.mergeCells('B' + rT3 + ':H' + rT3);
        var cellClean = ws1.getCell('B' + rT3);
        cellClean.value = '🎉 ¡Excelente! Todos los productos solicitados están 100% disponibles y validados en los 3 supermercados.';
        cellClean.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
        cellClean.alignment = { vertical: 'middle', horizontal: 'center' };
        cellClean.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
        aplicarBordes(ws1, 'B', rDataT3Start - 1, 'H', rT3);
    } else {
        incidenciasPorProducto.forEach(function(inc) {
            rT3++;
            ws1.getRow(rT3).height = 22;

            ws1.getCell('B' + rT3).value = inc.producto.toUpperCase();
            ws1.getCell('B' + rT3).font = { bold: true, size: 9 };
            ws1.getCell('B' + rT3).alignment = { vertical: 'middle', horizontal: 'left' };

            ws1.getCell('C' + rT3).value = inc.cantidad;
            ws1.getCell('C' + rT3).alignment = { vertical: 'middle', horizontal: 'center' };
            ws1.getCell('C' + rT3).font = { size: 9 };

            // Columnas de supermercados con coloreado inteligente
            var colsSuperm = [
                { col: 'D', val: inc.carrefour },
                { col: 'E', val: inc.coto },
                { col: 'F', val: inc.dia }
            ];

            colsSuperm.forEach(function(cs) {
                var cCell = ws1.getCell(cs.col + rT3);
                cCell.value = cs.val;
                cCell.alignment = { vertical: 'middle', horizontal: 'center' };
                cCell.font = { size: 9, bold: true };
                if (cs.val === 'DISPONIBLE') {
                    cCell.font = { size: 9, bold: true, color: { argb: COLOR_VERDE_TEXTO } };
                    cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
                } else if (cs.val === 'SIN STOCK') {
                    cCell.font = { size: 9, bold: true, color: { argb: COLOR_AMARILLO_TEXTO } };
                    cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AMARILLO_PASTEL } };
                } else if (cs.val === 'NO ENCONTRADO') {
                    cCell.font = { size: 9, bold: true, color: { argb: 'FF555555' } };
                    cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GRIS_FONDO } };
                } else {
                    cCell.font = { size: 9, bold: true, color: { argb: COLOR_ROJO_TEXTO } };
                    cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ROJO_PASTEL } };
                }
            });

            // Diagnóstico y advertencia
            var faltantesCount = [inc.carrefour, inc.coto, inc.dia].filter(function(x) { return x !== 'DISPONIBLE'; }).length;
            var cDiag = ws1.getCell('G' + rT3);
            cDiag.value = faltantesCount === 3 ? 'Inexistente en todas' : (faltantesCount + ' faltante(s)');
            cDiag.font = { size: 9, bold: true, color: { argb: faltantesCount === 3 ? COLOR_ROJO_TEXTO : 'FF777777' } };
            cDiag.alignment = { vertical: 'middle', horizontal: 'center' };

            var cImp = ws1.getCell('H' + rT3);
            cImp.value = faltantesCount === 3 ? 'Afecta canasta completa' : 'Compra en supermercado con stock';
            cImp.font = { size: 8.5, italic: true, color: { argb: 'FF555555' } };
            cImp.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        aplicarBordes(ws1, 'B', rDataT3Start - 1, 'H', rT3);
    }

    // Resumen Estadístico de Disponibilidad
    rT3 += 2;
    ws1.mergeCells('B' + rT3 + ':H' + (rT3 + 3));
    var resEstCell = ws1.getCell('B' + rT3);
    resEstCell.value = '📋 RESUMEN DE DISPONIBILIDAD Y AUDITORÍA:\n' +
        '• Productos solicitados en canasta: ' + totalSolicitados + ' (' + totalUnidadesCanasta + ' unidades totales requeridas)\n' +
        '• Productos completamente disponibles en los 3 supermercados: ' + totalCompletamenteDisponibles + '\n' +
        '• Productos con algún problema o faltante: ' + totalConProblemas + '\n' +
        '• Desglose de incidencias: ' + totalCasosSinStock + ' sin stock, ' + totalCasosNoEncontrado + ' no encontrados y ' + totalCasosNoValida + ' coincidencias no válidas (rechazadas por motor estricto).';
    resEstCell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1F4E79' } };
    resEstCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1F5' } };
    resEstCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    aplicarBordes(ws1, 'B', rT3, 'H', rT3 + 3);

    // Conclusión Narrativa
    rT3 += 5;
    ws1.mergeCells('B' + rT3 + ':H' + (rT3 + 3));
    var concNarrativa = ws1.getCell('B' + rT3);
    concNarrativa.value = '💡 CONCLUSIÓN Y ESTRATEGIA RECOMENDADA POR EL BOT RPA:\n' +
        '1. Si realizás toda la compra mensual en un único lugar: El supermercado más conveniente es ' + superRecomendado + ' con un costo total de $' + menorCostoCanasta.toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '.\n' +
        '2. Si realizás una compra combinada (comprando cada producto en su supermercado ganador): Pagás solo $' + costoOptimoCombinado.toLocaleString('es-AR', { minimumFractionDigits: 2 }) + ', ahorrando un total de $' + ahorroCombinadoMaximo.toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '.\n' +
        '3. Podés verificar el detalle histórico de productos descartados en la pestaña "⚠️ Disponibilidad y Stock".';
    concNarrativa.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1F4E79' } };
    concNarrativa.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1F5' } };
    concNarrativa.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    aplicarBordes(ws1, 'B', rT3, 'H', rT3 + 3);

    ws1.getColumn('A').width = 4;
    ws1.getColumn('B').width = 24;
    ws1.getColumn('C').width = 10;
    ws1.getColumn('D').width = 24;
    ws1.getColumn('E').width = 38;
    ws1.getColumn('F').width = 20;
    ws1.getColumn('G').width = 20;
    ws1.getColumn('H').width = 24;


    // ==============================================================================
    // HOJA 2: 🛒 CANASTA MENSUAL (COMPARATIVA HORIZONTAL CON CANTIDAD)
    // ==============================================================================
    var ws2 = workbook.addWorksheet('🛒 Canasta Mensual', { views: [{ showGridLines: true }] });

    ws2.mergeCells('B2:I2');
    var tWs2 = ws2.getCell('B2');
    tWs2.value = '🛒 CANASTA MENSUAL: COMPARATIVA DETALLADA DE PRECIOS Y SUBDETERMINACIÓN POR CANTIDAD';
    tWs2.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    tWs2.alignment = { vertical: 'middle', horizontal: 'center' };
    tWs2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_OSCURO } };
    ws2.getRow(2).height = 34;

    ws2.mergeCells('B3:I3');
    var stWs2 = ws2.getCell('B3');
    stWs2.value = 'Valores calculados como: Precio Unitario x Cantidad Solicitada. Las celdas en verde destacan el supermercado ganador por artículo.';
    stWs2.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
    stWs2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(3).height = 18;

    var hWs2 = [
        { col: 'B', text: 'Artículo Solicitado' },
        { col: 'C', text: 'Cant.' },
        { col: 'D', text: 'Carrefour' },
        { col: 'E', text: 'COTO' },
        { col: 'F', text: 'Día %' },
        { col: 'G', text: '🥇 Más Barato' },
        { col: 'H', text: 'Subtotal Elegido' },
        { col: 'I', text: 'Ahorro Posible' }
    ];
    ws2.getRow(5).height = 22;
    hWs2.forEach(function(h) {
        var cell = ws2.getCell(h.col + '5');
        cell.value = h.text;
        cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_TITULO } };
    });

    var rWs2 = 6;
    filasCanasta.forEach(function(f) {
        ws2.getRow(rWs2).height = 22;

        ws2.getCell('B' + rWs2).value = f.producto.toUpperCase();
        ws2.getCell('B' + rWs2).font = { bold: true };
        ws2.getCell('B' + rWs2).alignment = { vertical: 'middle', horizontal: 'left' };

        ws2.getCell('C' + rWs2).value = f.cantidad;
        ws2.getCell('C' + rWs2).alignment = { vertical: 'middle', horizontal: 'center' };
        ws2.getCell('C' + rWs2).font = { bold: true };

        // Carrefour, COTO, Día % (Subtotal con cantidad)
        var mapeo = [
            { col: 'D', superm: 'Carrefour', obj: f.carrefour, subtot: f.subtotales['Carrefour'] },
            { col: 'E', superm: 'COTO', obj: f.coto, subtot: f.subtotales['COTO'] },
            { col: 'F', superm: 'Día %', obj: f.dia, subtot: f.subtotales['Día %'] }
        ];

        mapeo.forEach(function(m) {
            var cCell = ws2.getCell(m.col + rWs2);
            if (!m.obj || !m.obj.valido || m.subtot === null) {
                var tag = m.obj ? (m.obj.estado === 'SIN STOCK' ? 'Sin Stock' : (m.obj.estado === 'COINCIDENCIA NO VÁLIDA' ? 'No válida' : 'No encontrado')) : 'N/D';
                cCell.value = tag;
                cCell.font = { size: 9, color: { argb: 'FF888888' }, italic: true };
                cCell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                cCell.value = m.subtot;
                cCell.numFmt = '"$"#,##0.00';
                cCell.alignment = { vertical: 'middle', horizontal: 'right' };
                var esElGanador = f.ganador && f.ganador.superm === m.superm;
                if (esElGanador) {
                    cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
                    cCell.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
                }
            }
        });

        // Ganador
        var gCell = ws2.getCell('G' + rWs2);
        gCell.value = f.ganador ? ('🏆 ' + f.ganador.superm) : 'Ninguno';
        gCell.font = { bold: true, color: { argb: f.ganador ? COLOR_VERDE_TEXTO : COLOR_ROJO_TEXTO } };
        gCell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (f.ganador) gCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };

        // Subtotal elegido
        var pMinCell = ws2.getCell('H' + rWs2);
        if (f.ganador) {
            pMinCell.value = f.ganador.subtotal;
            pMinCell.numFmt = '"$"#,##0.00';
            pMinCell.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
        } else {
            pMinCell.value = 'N/D';
        }
        pMinCell.alignment = { vertical: 'middle', horizontal: 'right' };

        // Ahorro
        var ahCell = ws2.getCell('I' + rWs2);
        ahCell.value = f.ahorro > 0 ? ('-$' + f.ahorro.toLocaleString('es-AR', { minimumFractionDigits: 2 })) : 'Mismo precio';
        ahCell.font = { bold: f.ahorro > 0, color: { argb: f.ahorro > 0 ? COLOR_VERDE_TEXTO : 'FF666666' } };
        ahCell.alignment = { vertical: 'middle', horizontal: 'center' };

        rWs2++;
    });

    // Fila Total de Canasta al pie
    ws2.getRow(rWs2).height = 24;
    ws2.getCell('B' + rWs2).value = 'TOTAL CANASTA';
    ws2.getCell('B' + rWs2).font = { bold: true, size: 10 };
    ws2.getCell('B' + rWs2).alignment = { vertical: 'middle', horizontal: 'left' };

    ws2.getCell('C' + rWs2).value = totalUnidadesCanasta + ' u.';
    ws2.getCell('C' + rWs2).font = { bold: true, size: 10 };
    ws2.getCell('C' + rWs2).alignment = { vertical: 'middle', horizontal: 'center' };

    ['D', 'E', 'F'].forEach(function(col, idx) {
        var s = supersList[idx];
        var cell = ws2.getCell(col + rWs2);
        cell.value = totalesCanasta[s] > 0 ? totalesCanasta[s] : 0;
        cell.numFmt = '"$"#,##0.00';
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (s === superRecomendado) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
            cell.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
        }
    });

    ws2.getCell('G' + rWs2).value = 'Óptima Combinada';
    ws2.getCell('G' + rWs2).font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
    ws2.getCell('G' + rWs2).alignment = { vertical: 'middle', horizontal: 'center' };

    var optCell = ws2.getCell('H' + rWs2);
    optCell.value = costoOptimoCombinado;
    optCell.numFmt = '"$"#,##0.00';
    optCell.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
    optCell.alignment = { vertical: 'middle', horizontal: 'right' };
    optCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };

    var totAhoCell = ws2.getCell('I' + rWs2);
    totAhoCell.value = ahorroCombinadoMaximo > 0 ? ('-$' + ahorroCombinadoMaximo.toLocaleString('es-AR', { minimumFractionDigits: 2 })) : '-';
    totAhoCell.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
    totAhoCell.alignment = { vertical: 'middle', horizontal: 'center' };

    aplicarBordes(ws2, 'B', 5, 'I', rWs2);

    ws2.getColumn('A').width = 4;
    ws2.getColumn('B').width = 22;
    ws2.getColumn('C').width = 10;
    ws2.getColumn('D').width = 18;
    ws2.getColumn('E').width = 18;
    ws2.getColumn('F').width = 18;
    ws2.getColumn('G').width = 20;
    ws2.getColumn('H').width = 18;
    ws2.getColumn('I').width = 18;


    // ==============================================================================
    // HOJA 3: 🔎 CONSULTAS INDIVIDUALES (HISTORIAL Y ÚLTIMA BÚSQUEDA)
    // ==============================================================================
    var ws3 = workbook.addWorksheet('🔎 Consultas Individuales', { views: [{ showGridLines: true }] });

    ws3.mergeCells('B2:G2');
    var tWs3 = ws3.getCell('B2');
    tWs3.value = '🎯 CONSULTA INDIVIDUAL: ¿DÓNDE TE CONVIENE COMPRAR?';
    tWs3.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    tWs3.alignment = { vertical: 'middle', horizontal: 'center' };
    tWs3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_OSCURO } };
    ws3.getRow(2).height = 34;

    if (itemsIndividual.length === 0) {
        ws3.mergeCells('B4:G4');
        var vacioCell = ws3.getCell('B4');
        vacioCell.value = 'No se registraron consultas individuales aún. Realiza una búsqueda rápida desde la interfaz web o el comando individual.';
        vacioCell.font = { italic: true, color: { argb: 'FF777777' }, size: 10 };
        vacioCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws3.getRow(4).height = 30;
    } else {
        var ultimoItem = itemsIndividual[itemsIndividual.length - 1];
        var ultimoProducto = ultimoItem.producto;
        var ultimaFecha = ultimoItem.fecha;

        var itemsUltimaConsulta = [];
        for (var i = itemsIndividual.length - 1; i >= 0; i--) {
            if (itemsIndividual[i].producto.toLowerCase().trim() === ultimoProducto.toLowerCase().trim()) {
                itemsUltimaConsulta.unshift(itemsIndividual[i]);
                if (itemsUltimaConsulta.length === 3) break;
            } else {
                break;
            }
        }

        var validosUltima = itemsUltimaConsulta.filter(function(x) { return x.valido && x.precio !== null && x.precio > 0; });
        validosUltima.sort(function(a, b) { return a.precio - b.precio; });

        var ganadorUltima = validosUltima.length > 0 ? validosUltima[0] : null;
        var masCaroUltima = validosUltima.length > 1 ? validosUltima[validosUltima.length - 1] : null;
        var ahorroUltima = (ganadorUltima && masCaroUltima) ? (masCaroUltima.precio - ganadorUltima.precio) : 0;
        var ahorroUltimaPct = (masCaroUltima && masCaroUltima.precio > 0) ? ((ahorroUltima / masCaroUltima.precio) * 100) : 0;

        var intencion = validador.detectarIntencion(ultimoProducto);
        var intencionTexto = intencion.tipo + (intencion.marca ? ' (Marca: ' + intencion.marca.toUpperCase() + ')' : '');

        // 1. Tarjeta Destacada del Producto Consultado
        ws3.mergeCells('B4:G4');
        var prodCell = ws3.getCell('B4');
        prodCell.value = '🔎 PRODUCTO CONSULTADO:  "' + ultimoProducto.toUpperCase() + '"';
        prodCell.font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
        prodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_TITULO } };
        prodCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws3.getRow(4).height = 36;

        // Subtítulo con metadata técnica
        ws3.mergeCells('B5:G5');
        var stWs3 = ws3.getCell('B5');
        stWs3.value = 'Intención detectada: ' + intencionTexto + '  │  Fecha: ' + ultimaFecha + '  │  Supermercados relevados: Carrefour, COTO y Día %';
        stWs3.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF555555' } };
        stWs3.alignment = { vertical: 'middle', horizontal: 'center' };
        ws3.getRow(5).height = 20;
        aplicarBordes(ws3, 'B', 4, 'G', 5);

        // 2. Banner de Veredicto Destacado
        ws3.mergeCells('B7:G8');
        var bannerCell = ws3.getCell('B7');
        if (ganadorUltima) {
            bannerCell.value = '🏆 TE CONVIENE COMPRAR EN: ' + ganadorUltima.supermercado + ' (' + validador.formatoMoneda(ganadorUltima.precio) + ')\n' +
                (ahorroUltima > 0
                    ? '💰 AHORRO POTENCIAL: ' + validador.formatoMoneda(ahorroUltima) + ' (' + ahorroUltimaPct.toFixed(0) + '% menos que en ' + masCaroUltima.supermercado + ')'
                    : 'ℹ️ Solo ' + ganadorUltima.supermercado + ' tuvo el producto con coincidencia válida disponible.'
                );
            bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
            bannerCell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: COLOR_VERDE_TEXTO } };
        } else {
            bannerCell.value = '⚠️ NINGÚN SUPERMERCADO ARROJÓ UNA COINCIDENCIA VÁLIDA DISPONIBLE\nEl motor evitó sustituir con productos erróneos (marcas ajenas, frutas o artículos de limpieza).';
            bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ROJO_PASTEL } };
            bannerCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: COLOR_ROJO_TEXTO } };
        }
        bannerCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        ws3.getRow(7).height = 26;
        ws3.getRow(8).height = 26;
        aplicarBordes(ws3, 'B', 7, 'G', 8);

        // 3. Cabecera de la tabla comparativa activa
        ws3.getRow(10).height = 26;
        var hUlt = [
            { col: 'B', text: 'Supermercado' },
            { col: 'C', text: 'Precio Vigente' },
            { col: 'D', text: 'Estado / Validación' },
            { col: 'E', text: 'Producto Encontrado en Góndola' },
            { col: 'F', text: 'Motivo / Regla Aplicada' },
            { col: 'G', text: 'Enlace Web Directo' }
        ];
        hUlt.forEach(function(h) {
            var cell = ws3.getCell(h.col + '10');
            cell.value = h.text;
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_TITULO } };
        });

        var rWs3 = 11;
        itemsUltimaConsulta.forEach(function(it) {
            ws3.getRow(rWs3).height = 26;
            var esGanador = ganadorUltima && (it.supermercado === ganadorUltima.supermercado) && it.valido;

            var supCell = ws3.getCell('B' + rWs3);
            supCell.value = it.supermercado;
            supCell.alignment = { vertical: 'middle', horizontal: 'center' };
            supCell.font = { name: 'Segoe UI', bold: true, size: 9.5 };

            var preCell = ws3.getCell('C' + rWs3);
            if (it.precio !== null && it.precio > 0) {
                preCell.value = it.precio;
                preCell.numFmt = '"$"#,##0.00';
            } else {
                preCell.value = it.precioStr || 'N/D';
            }
            preCell.alignment = { vertical: 'middle', horizontal: 'right' };

            var estCell = ws3.getCell('D' + rWs3);
            estCell.alignment = { vertical: 'middle', horizontal: 'center' };

            if (esGanador) {
                preCell.font = { name: 'Segoe UI', bold: true, size: 10, color: { argb: COLOR_VERDE_TEXTO } };
                estCell.value = '🏆 GANADOR';
                estCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
                estCell.font = { name: 'Segoe UI', bold: true, size: 9.5, color: { argb: COLOR_VERDE_TEXTO } };
            } else if (it.valido) {
                preCell.font = { name: 'Segoe UI', bold: true, size: 9.5, color: { argb: 'FF333333' } };
                estCell.value = ' VALIDADA';
                estCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_CLARO } };
                estCell.font = { name: 'Segoe UI', bold: true, size: 9.5, color: { argb: COLOR_AZUL_TITULO } };
            } else {
                preCell.font = { name: 'Segoe UI', strike: true, italic: true, size: 9.5, color: { argb: 'FF888888' } };
                preCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9EAE1' } };
                estCell.value = '❌ ' + it.estado;
                estCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ROJO_PASTEL } };
                estCell.font = { name: 'Segoe UI', bold: true, size: 9, color: { argb: COLOR_ROJO_TEXTO } };
            }

            var nomCell = ws3.getCell('E' + rWs3);
            nomCell.value = it.nombre;
            nomCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            nomCell.font = { name: 'Segoe UI', size: 9.5, bold: esGanador };

            var motCell = ws3.getCell('F' + rWs3);
            motCell.value = it.motivo || (it.valido ? 'Coincidencia validada correctamente' : '-');
            motCell.font = { name: 'Segoe UI', size: 8.5, color: { argb: it.valido ? 'FF444444' : COLOR_ROJO_TEXTO } };
            motCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

            var lnkCell = ws3.getCell('G' + rWs3);
            if (it.url && it.url.startsWith('http')) {
                lnkCell.value = { text: '🔗 Ver en ' + it.supermercado, hyperlink: it.url };
                lnkCell.font = { name: 'Segoe UI', color: { argb: 'FF0563C1' }, underline: true, size: 9 };
            } else {
                lnkCell.value = '-';
            }
            lnkCell.alignment = { vertical: 'middle', horizontal: 'center' };

            if (esGanador) {
                supCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
                preCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
                nomCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
                motCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
                lnkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
            }

            rWs3++;
        });
        aplicarBordes(ws3, 'B', 10, 'G', rWs3 - 1);

        var rTip = rWs3 + 1;
        ws3.mergeCells('B' + rTip + ':G' + rTip);
        var tipCell = ws3.getCell('B' + rTip);
        tipCell.value = '💡 Tip: Esta hoja muestra exclusivamente la consulta activa. Al realizar una nueva consulta, se actualiza automáticamente.';
        tipCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF666666' } };
        tipCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws3.getRow(rTip).height = 22;
    }

    ws3.getColumn('A').width = 4;
    ws3.getColumn('B').width = 18;
    ws3.getColumn('C').width = 18;
    ws3.getColumn('D').width = 26;
    ws3.getColumn('E').width = 46;
    ws3.getColumn('F').width = 46;
    ws3.getColumn('G').width = 22;


    // ==============================================================================
    // HOJA 4: ⚠️ DISPONIBILIDAD Y STOCK (PROBLEMAS Y RECHAZOS TÉCNICOS)
    // ==============================================================================
    var ws4 = workbook.addWorksheet('⚠️ Disponibilidad y Stock', { views: [{ showGridLines: true }] });

    ws4.mergeCells('B2:H2');
    var tWs4 = ws4.getCell('B2');
    tWs4.value = '⚠️ REPORTE DE DISPONIBILIDAD: AUDITORÍA DE ARTÍCULOS SIN STOCK O RECHAZADOS';
    tWs4.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    tWs4.alignment = { vertical: 'middle', horizontal: 'center' };
    tWs4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB25E00' } };
    ws4.getRow(2).height = 34;

    ws4.mergeCells('B3:H3');
    var stWs4 = ws4.getCell('B3');
    stWs4.value = 'Diferenciación técnica entre SIN STOCK (agotado), NO ENCONTRADO (inexistente) y COINCIDENCIA NO VÁLIDA (sustitución rechazada).';
    stWs4.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
    stWs4.alignment = { vertical: 'middle', horizontal: 'center' };
    ws4.getRow(3).height = 18;

    var hWs4 = [
        { col: 'B', text: 'Fecha' },
        { col: 'C', text: 'Modo' },
        { col: 'D', text: 'Supermercado' },
        { col: 'E', text: 'Producto Solicitado' },
        { col: 'F', text: 'Nombre Devuelto' },
        { col: 'G', text: 'Tipo de Incidencia' },
        { col: 'H', text: 'Motivo del Rechazo / Estado' }
    ];
    ws4.getRow(5).height = 22;
    hWs4.forEach(function(h) {
        var cell = ws4.getCell(h.col + '5');
        cell.value = h.text;
        cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_TITULO } };
    });

    var itemsConProblemas = items.filter(function(x) { return !x.valido || x.estado !== 'VALIDADA'; });
    var rWs4 = 6;

    if (itemsConProblemas.length === 0) {
        ws4.mergeCells('B6:H6');
        var cleanCell = ws4.getCell('B6');
        cleanCell.value = '🎉 Excelente: Todos los productos relevados tuvieron stock disponible y coincidencias válidas.';
        cleanCell.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
        cleanCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws4.getRow(6).height = 24;
        rWs4 = 7;
    } else {
        itemsConProblemas.forEach(function(it) {
            ws4.getRow(rWs4).height = 22;

            ws4.getCell('B' + rWs4).value = it.fecha;
            ws4.getCell('B' + rWs4).alignment = { vertical: 'middle', horizontal: 'center' };
            ws4.getCell('B' + rWs4).font = { size: 9 };

            ws4.getCell('C' + rWs4).value = (it.modo === 'compra_mes') ? 'Canasta' : 'Individual';
            ws4.getCell('C' + rWs4).alignment = { vertical: 'middle', horizontal: 'center' };
            ws4.getCell('C' + rWs4).font = { size: 8 };

            ws4.getCell('D' + rWs4).value = it.supermercado;
            ws4.getCell('D' + rWs4).alignment = { vertical: 'middle', horizontal: 'center' };
            ws4.getCell('D' + rWs4).font = { bold: true, size: 9 };

            ws4.getCell('E' + rWs4).value = it.producto;
            ws4.getCell('E' + rWs4).font = { bold: true, size: 9 };
            ws4.getCell('E' + rWs4).alignment = { vertical: 'middle', horizontal: 'left' };

            ws4.getCell('F' + rWs4).value = it.nombre;
            ws4.getCell('F' + rWs4).alignment = { vertical: 'middle', horizontal: 'left' };
            ws4.getCell('F' + rWs4).font = { size: 9 };

            var tipoCell = ws4.getCell('G' + rWs4);
            tipoCell.value = it.estado;
            tipoCell.alignment = { vertical: 'middle', horizontal: 'center' };
            tipoCell.font = { bold: true, size: 9 };
            if (it.estado === 'SIN STOCK') {
                tipoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AMARILLO_PASTEL } };
                tipoCell.font = { bold: true, color: { argb: COLOR_AMARILLO_TEXTO } };
            } else if (it.estado === 'COINCIDENCIA NO VÁLIDA') {
                tipoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ROJO_PASTEL } };
                tipoCell.font = { bold: true, color: { argb: COLOR_ROJO_TEXTO } };
            } else {
                tipoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GRIS_FONDO } };
                tipoCell.font = { color: { argb: 'FF777777' } };
            }

            var motCell = ws4.getCell('H' + rWs4);
            motCell.value = it.motivo || 'No disponible';
            motCell.font = { size: 8, color: { argb: 'FF444444' } };
            motCell.alignment = { vertical: 'middle', horizontal: 'left' };

            rWs4++;
        });
    }
    aplicarBordes(ws4, 'B', 5, 'H', rWs4 - 1);

    ws4.getColumn('A').width = 4;
    ws4.getColumn('B').width = 14;
    ws4.getColumn('C').width = 14;
    ws4.getColumn('D').width = 16;
    ws4.getColumn('E').width = 22;
    ws4.getColumn('F').width = 40;
    ws4.getColumn('G').width = 24;
    ws4.getColumn('H').width = 50;

    // Guardar el libro consolidado con control de archivo bloqueado
    try {
        await workbook.xlsx.writeFile(XLSX_PATH);
        console.log('[OK] Reporte Excel con exactamente 4 hojas generado exitosamente en: ' + XLSX_PATH);
    } catch (err) {
        if (err.code === 'EBUSY') {
            console.error('\n[ERROR] El archivo reporte_supermercados.xlsx está abierto en Microsoft Excel.');
            console.error('Por favor cierre el archivo en Excel y vuelva a intentarlo para permitir su actualización.\n');
            process.exit(2);
        } else {
            console.error('[ERROR] No se pudo guardar el archivo Excel:', err.message);
            process.exit(1);
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    main: main
};
