// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// Generador de Reporte Visual en Excel (.xlsx)
//
// Procesa resultados.csv y genera un Excel con diseño profesional,
// análisis del producto más barato, conclusiones y ranking ordenado.
// ==============================================================================

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const CSV_PATH = path.join(__dirname, 'resultados.csv');
const XLSX_PATH = path.join(__dirname, 'reporte_supermercados.xlsx');

// Función para parsear precios argentinos (ej: "$ 5.209,00 c/u" -> 5209.00)
function parsePrecio(str) {
    if (!str || typeof str !== 'string' || str === 'N/D') return null;
    var match = str.match(/[\d.]+(?:,\d+)?/);
    if (!match) return null;
    var raw = match[0].replace(/\./g, '').replace(',', '.');
    var val = parseFloat(raw);
    return isNaN(val) ? null : val;
}

// Función para adivinar el grupo/término de búsqueda a partir de la URL o nombre
function identificarGrupo(item) {
    var url = (item.url || '').toLowerCase();
    var nom = (item.nombre || '').toLowerCase();
    
    // Lista de términos conocidos
    var palabras = ['yerba', 'leche serenisima', 'leche', 'arroz', 'fideos', 'aceite', 'galletitas oreo', 'oreo', 'cafe', 'azucar', 'shampoo', 'pomelo'];
    for (var i = 0; i < palabras.length; i++) {
        var p = palabras[i];
        if (url.indexOf(encodeURIComponent(p)) > -1 || url.indexOf(p.replace(/ /g, '%20')) > -1 || url.indexOf(p.replace(/ /g, '-')) > -1 || nom.indexOf(p) > -1) {
            return p.charAt(0).toUpperCase() + p.slice(1);
        }
    }
    // Si no coincide, extrae las dos primeras palabras del nombre
    var words = item.nombre.split(/\s+/).slice(0, 2).join(' ');
    return words || 'Otros';
}

async function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.log('[ERROR] No se encontró el archivo resultados.csv');
        return;
    }

    var csvRaw = fs.readFileSync(CSV_PATH, 'utf-8');
    var lines = csvRaw.split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
    if (lines.length <= 1) {
        console.log('[INFO] El archivo resultados.csv está vacío o solo contiene encabezados.');
        return;
    }

    // Saltar encabezado
    var items = [];
    for (var i = 1; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('sep=')) continue;
        
        // Parsear fila CSV respetando comillas
        var match = line.match(/(?:^|,)(?:"([^"]*)"|([^,]*))/g);
        if (!match || match.length < 4) continue;
        var cols = match.map(function(c) {
            c = c.replace(/^,/, '').trim();
            if (c.startsWith('"') && c.endsWith('"')) c = c.slice(1, -1);
            return c;
        });

        var nombre = cols[0] || 'N/D';
        var precioStr = cols[1] || 'N/D';
        var superm = cols[2] || 'N/D';
        var url = cols[3] || '';
        var fecha = cols[4] || '';
        var precioNum = parsePrecio(precioStr);

        items.push({
            nombre: nombre,
            precioStr: precioStr,
            precio: precioNum,
            supermercado: superm,
            url: url,
            fecha: fecha
        });
    }

    if (items.length === 0) {
        console.log('[INFO] No hay registros para procesar.');
        return;
    }

    // Agrupar por término / categoría
    var grupos = {};
    items.forEach(function(item) {
        var grp = identificarGrupo(item);
        if (!grupos[grp]) grupos[grp] = [];
        grupos[grp].push(item);
    });

    // Crear Libro de Excel
    var workbook = new ExcelJS.Workbook();
    workbook.creator = 'RPA Bot - UTN FRCU';
    workbook.created = new Date();

    // Paletas de Color
    var COLOR_AZUL_OSCURO = '1F4E79';
    var COLOR_AZUL_TITULO = '2F5597';
    var COLOR_VERDE_PASTEL = 'E2EFDA';
    var COLOR_VERDE_TEXTO = '276A3C';
    var COLOR_ROJO_PASTEL = 'FCE4D6';
    var COLOR_ROJO_TEXTO = 'C00000';
    var COLOR_AMARILLO_PASTEL = 'FFF2CC';
    var COLOR_GRIS_FONDO = 'F2F4F7';
    var COLOR_BORDE = 'D9D9D9';

    // ==============================================================================
    // HOJA 1: 🏆 CONCLUSIÓN Y ELECCIÓN DEL MÁS BARATO
    // ==============================================================================
    var ws1 = workbook.addWorksheet('🏆 Conclusiones y Ganadores', {
        views: [{ showGridLines: true }]
    });

    // Título Principal
    ws1.mergeCells('B2:H2');
    var titleCell = ws1.getCell('B2');
    titleCell.value = '🛒 REPORTE RPA: COMPARADOR DE PRECIOS Y MEJORES OFERTAS';
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_OSCURO } };
    ws1.getRow(2).height = 36;

    // Subtítulo
    ws1.mergeCells('B3:H3');
    var subCell = ws1.getCell('B3');
    subCell.value = 'Relevamiento automático en tiempo real en Carrefour, COTO y Día % • Generado el ' + new Date().toLocaleDateString('es-AR');
    subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF555555' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(3).height = 20;

    // Métricas y Ganadores
    var totalGrupos = Object.keys(grupos).length;
    var victorias = { 'Carrefour': 0, 'COTO': 0, 'Día %': 0 };
    var ahorroTotalEstimado = 0;
    var resumenGanadores = [];

    Object.keys(grupos).forEach(function(grp) {
        var lista = grupos[grp].filter(function(x) { return x.precio !== null; });
        if (lista.length === 0) return;

        // Ordenar por precio ascendente (más barato primero)
        lista.sort(function(a, b) { return a.precio - b.precio; });

        var ganador = lista[0];
        var masCaro = lista[lista.length - 1];
        var ahorro = masCaro.precio - ganador.precio;
        var ahorroPct = masCaro.precio > 0 ? ((ahorro / masCaro.precio) * 100) : 0;

        if (victorias[ganador.supermercado] !== undefined) {
            victorias[ganador.supermercado]++;
        }
        ahorroTotalEstimado += ahorro;

        resumenGanadores.push({
            grupo: grp,
            ganadorSuper: ganador.supermercado,
            ganadorNombre: ganador.nombre,
            ganadorPrecio: ganador.precio,
            caroSuper: masCaro.supermercado,
            caroPrecio: masCaro.precio,
            ahorro: ahorro,
            ahorroPct: ahorroPct,
            url: ganador.url
        });
    });

    // Determinar supermercado líder en ofertas
    var liderSuper = 'Varios';
    var maxV = -1;
    Object.keys(victorias).forEach(function(s) {
        if (victorias[s] > maxV) {
            maxV = victorias[s];
            liderSuper = s;
        }
    });

    // Bloque KPI Cards (Fila 5)
    ws1.mergeCells('B5:C5');
    ws1.getCell('B5').value = '📦 PRODUCTOS EVALUADOS';
    ws1.getCell('B5').font = { size: 9, bold: true, color: { argb: 'FF555555' } };
    ws1.getCell('B5').alignment = { horizontal: 'center' };
    ws1.mergeCells('B6:C6');
    ws1.getCell('B6').value = totalGrupos + ' Categorías';
    ws1.getCell('B6').font = { size: 14, bold: true, color: { argb: COLOR_AZUL_TITULO } };
    ws1.getCell('B6').alignment = { horizontal: 'center' };

    ws1.mergeCells('D5:E5');
    ws1.getCell('D5').value = '🏆 SÚPER MÁS ECONÓMICO';
    ws1.getCell('D5').font = { size: 9, bold: true, color: { argb: 'FF555555' } };
    ws1.getCell('D5').alignment = { horizontal: 'center' };
    ws1.mergeCells('D6:E6');
    ws1.getCell('D6').value = liderSuper + ' (' + maxV + ' mejores precios)';
    ws1.getCell('D6').font = { size: 14, bold: true, color: { argb: COLOR_VERDE_TEXTO } };
    ws1.getCell('D6').alignment = { horizontal: 'center' };

    ws1.mergeCells('F5:H5');
    ws1.getCell('F5').value = '💰 AHORRO TOTAL COMBINADO';
    ws1.getCell('F5').font = { size: 9, bold: true, color: { argb: 'FF555555' } };
    ws1.getCell('F5').alignment = { horizontal: 'center' };
    ws1.mergeCells('F6:H6');
    ws1.getCell('F6').value = ahorroTotalEstimado;
    ws1.getCell('F6').numFmt = '"$"#,##0.00';
    ws1.getCell('F6').font = { size: 14, bold: true, color: { argb: COLOR_VERDE_TEXTO } };
    ws1.getCell('F6').alignment = { horizontal: 'center' };

    // Estilos de las KPI cards
    ['B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'B6', 'C6', 'D6', 'E6', 'F6', 'G6', 'H6'].forEach(function(pos) {
        ws1.getCell(pos).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GRIS_FONDO } };
        ws1.getCell(pos).border = {
            top: { style: 'thin', color: { argb: COLOR_BORDE } },
            bottom: { style: 'thin', color: { argb: COLOR_BORDE } },
            left: { style: 'thin', color: { argb: COLOR_BORDE } },
            right: { style: 'thin', color: { argb: COLOR_BORDE } }
        };
    });
    ws1.getRow(5).height = 18;
    ws1.getRow(6).height = 28;

    // Encabezado de la Tabla de Elección de Más Baratos (Fila 8)
    var headers1 = [
        { col: 'B', text: 'Categoría / Búsqueda' },
        { col: 'C', text: '🥇 Elección Más Barata' },
        { col: 'D', text: 'Producto Recomendado' },
        { col: 'E', text: 'Mejor Precio' },
        { col: 'F', text: 'Opción Más Cara' },
        { col: 'G', text: 'Te Ahorrás' },
        { col: 'H', text: 'Enlace Directo' }
    ];

    ws1.getRow(8).height = 26;
    headers1.forEach(function(h) {
        var cell = ws1.getCell(h.col + '8');
        cell.value = h.text;
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_TITULO } };
        cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
    });

    // Filas de Ganadores
    var curRow = 9;
    resumenGanadores.forEach(function(res) {
        ws1.getRow(curRow).height = 24;

        // Categoría
        var cCat = ws1.getCell('B' + curRow);
        cCat.value = res.grupo;
        cCat.font = { bold: true };
        cCat.alignment = { vertical: 'middle', horizontal: 'left' };

        // Super Ganador
        var cSup = ws1.getCell('C' + curRow);
        cSup.value = '🏆 ' + res.ganadorSuper;
        cSup.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
        cSup.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
        cSup.alignment = { vertical: 'middle', horizontal: 'center' };

        // Nombre
        var cNom = ws1.getCell('D' + curRow);
        cNom.value = res.ganadorNombre;
        cNom.alignment = { vertical: 'middle', horizontal: 'left' };

        // Mejor Precio
        var cPre = ws1.getCell('E' + curRow);
        cPre.value = res.ganadorPrecio;
        cPre.numFmt = '"$"#,##0.00';
        cPre.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
        cPre.alignment = { vertical: 'middle', horizontal: 'right' };
        cPre.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };

        // Más Caro
        var cCaro = ws1.getCell('F' + curRow);
        cCaro.value = res.caroSuper + ' ($ ' + res.caroPrecio.toLocaleString('es-AR', { minimumFractionDigits: 2 }) + ')';
        cCaro.font = { color: { argb: 'FF888888' }, size: 9 };
        cCaro.alignment = { vertical: 'middle', horizontal: 'center' };

        // Ahorro
        var cAho = ws1.getCell('G' + curRow);
        cAho.value = res.ahorro > 0 ? ('-$' + res.ahorro.toLocaleString('es-AR', { minimumFractionDigits: 0 }) + ' (' + res.ahorroPct.toFixed(0) + '%)') : 'Mismo precio';
        cAho.font = { bold: true, color: { argb: res.ahorro > 0 ? COLOR_VERDE_TEXTO : 'FF555555' } };
        cAho.alignment = { vertical: 'middle', horizontal: 'center' };

        // Link
        var cLnk = ws1.getCell('H' + curRow);
        if (res.url && res.url.startsWith('http')) {
            cLnk.value = { text: '🔗 Ver Oferta', hyperlink: res.url };
            cLnk.font = { color: { argb: 'FF0563C1' }, underline: true };
        } else {
            cLnk.value = 'N/D';
        }
        cLnk.alignment = { vertical: 'middle', horizontal: 'center' };

        ['B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function(col) {
            ws1.getCell(col + curRow).border = {
                bottom: { style: 'thin', color: { argb: COLOR_BORDE } },
                left: { style: 'thin', color: { argb: COLOR_BORDE } },
                right: { style: 'thin', color: { argb: COLOR_BORDE } }
            };
        });

        curRow++;
    });

    // Bloque Conclusión Narrativa
    curRow += 2;
    ws1.mergeCells('B' + curRow + ':H' + (curRow + 3));
    var concCell = ws1.getCell('B' + curRow);
    concCell.value = '💡 CONCLUSIÓN DEL BOT RPA:\n' +
        '• En este relevamiento, el supermercado con mayor cantidad de precios más bajos fue ' + liderSuper + '.\n' +
        '• Si comprás cada producto en el supermercado ganador correspondiente, lográs un ahorro total estimado de $' + ahorroTotalEstimado.toLocaleString('es-AR', { minimumFractionDigits: 2 }) + ' en tu compra.\n' +
        '• Podés hacer clic en cualquiera de los enlaces para validar o comprar directamente en la tienda online.';
    concCell.font = { name: 'Segoe UI', size: 10, italic: false, color: { argb: 'FF1F4E79' } };
    concCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1F5' } };
    concCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    ['B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function(col) {
        for (var r = curRow; r <= curRow + 3; r++) {
            ws1.getCell(col + r).border = {
                top: { style: 'thin', color: { argb: COLOR_AZUL_TITULO } },
                bottom: { style: 'thin', color: { argb: COLOR_AZUL_TITULO } },
                left: { style: 'thin', color: { argb: COLOR_AZUL_TITULO } },
                right: { style: 'thin', color: { argb: COLOR_AZUL_TITULO } }
            };
        }
    });

    // Auto-ajuste de ancho de columnas Hoja 1
    ws1.getColumn('A').width = 4;
    ws1.getColumn('B').width = 22;
    ws1.getColumn('C').width = 24;
    ws1.getColumn('D').width = 45;
    ws1.getColumn('E').width = 16;
    ws1.getColumn('F').width = 26;
    ws1.getColumn('G').width = 20;
    ws1.getColumn('H').width = 18;


    // ==============================================================================
    // HOJA 2: 📊 RANKING DE MENOR A MAYOR PRECIO (TODOS LOS PRODUCTOS)
    // ==============================================================================
    var ws2 = workbook.addWorksheet('📊 Ranking Menor a Mayor', {
        views: [{ showGridLines: true }]
    });

    // Título Hoja 2
    ws2.mergeCells('B2:G2');
    var t2 = ws2.getCell('B2');
    t2.value = '📊 RANKING GENERAL: DE MENOR A MAYOR PRECIO';
    t2.font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    t2.alignment = { vertical: 'middle', horizontal: 'center' };
    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_OSCURO } };
    ws2.getRow(2).height = 34;

    ws2.mergeCells('B3:G3');
    var st2 = ws2.getCell('B3');
    st2.value = 'Listado consolidado de todos los artículos encontrados, ordenados estrictamente por precio ascendente.';
    st2.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
    st2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(3).height = 18;

    // Encabezados Hoja 2 (Fila 5)
    var headers2 = [
        { col: 'B', text: 'Posición / Medalla' },
        { col: 'C', text: 'Supermercado' },
        { col: 'D', text: 'Nombre del Producto Extraído' },
        { col: 'E', text: 'Precio' },
        { col: 'F', text: 'Fecha' },
        { col: 'G', text: 'Enlace a la Web' }
    ];

    ws2.getRow(5).height = 24;
    headers2.forEach(function(h) {
        var cell = ws2.getCell(h.col + '5');
        cell.value = h.text;
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AZUL_TITULO } };
        cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
    });

    // Ordenar TODOS los productos de menor a mayor
    var itemsOrdenados = items.slice().filter(function(x) { return x.precio !== null; });
    itemsOrdenados.sort(function(a, b) { return a.precio - b.precio; });

    var rIdx = 6;
    itemsOrdenados.forEach(function(item, idx) {
        ws2.getRow(rIdx).height = 22;

        // Medalla / Posición
        var posCell = ws2.getCell('B' + rIdx);
        var medal = (idx === 0) ? '🥇 1° MÁS BARATO' : (idx === 1 ? '🥈 2° Lugar' : (idx === 2 ? '🥉 3° Lugar' : '#' + (idx + 1)));
        posCell.value = medal;
        posCell.alignment = { vertical: 'middle', horizontal: 'center' };
        posCell.font = { bold: idx < 3, size: 9 };
        if (idx === 0) {
            posCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VERDE_PASTEL } };
            posCell.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
        } else if (idx === 1 || idx === 2) {
            posCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_AMARILLO_PASTEL } };
        }

        // Supermercado con color
        var supCell = ws2.getCell('C' + rIdx);
        supCell.value = item.supermercado;
        supCell.alignment = { vertical: 'middle', horizontal: 'center' };
        supCell.font = { bold: true, size: 10 };
        if (item.supermercado === 'Carrefour') {
            supCell.font = { bold: true, color: { argb: 'FF0B4EA2' } };
        } else if (item.supermercado === 'COTO') {
            supCell.font = { bold: true, color: { argb: 'FFE20025' } };
        } else if (item.supermercado.indexOf('Día') > -1 || item.supermercado.indexOf('Dia') > -1) {
            supCell.font = { bold: true, color: { argb: 'FFB01B1B' } };
        }

        // Nombre
        var nomCell = ws2.getCell('D' + rIdx);
        nomCell.value = item.nombre;
        nomCell.alignment = { vertical: 'middle', horizontal: 'left' };

        // Precio
        var preCell = ws2.getCell('E' + rIdx);
        preCell.value = item.precio;
        preCell.numFmt = '"$"#,##0.00';
        preCell.alignment = { vertical: 'middle', horizontal: 'right' };
        preCell.font = { bold: true };
        if (idx < 3) {
            preCell.font = { bold: true, color: { argb: COLOR_VERDE_TEXTO } };
        }

        // Fecha
        var fecCell = ws2.getCell('F' + rIdx);
        fecCell.value = item.fecha;
        fecCell.alignment = { vertical: 'middle', horizontal: 'center' };
        fecCell.font = { size: 9, color: { argb: 'FF666666' } };

        // Link
        var urlCell = ws2.getCell('G' + rIdx);
        if (item.url && item.url.startsWith('http')) {
            urlCell.value = { text: '🔗 Ver Producto', hyperlink: item.url };
            urlCell.font = { color: { argb: 'FF0563C1' }, underline: true };
        } else {
            urlCell.value = 'N/D';
        }
        urlCell.alignment = { vertical: 'middle', horizontal: 'center' };

        ['B', 'C', 'D', 'E', 'F', 'G'].forEach(function(col) {
            ws2.getCell(col + rIdx).border = {
                bottom: { style: 'thin', color: { argb: COLOR_BORDE } },
                left: { style: 'thin', color: { argb: COLOR_BORDE } },
                right: { style: 'thin', color: { argb: COLOR_BORDE } }
            };
        });

        rIdx++;
    });

    // Auto-ajuste columnas Hoja 2
    ws2.getColumn('A').width = 4;
    ws2.getColumn('B').width = 20;
    ws2.getColumn('C').width = 18;
    ws2.getColumn('D').width = 50;
    ws2.getColumn('E').width = 16;
    ws2.getColumn('F').width = 14;
    ws2.getColumn('G').width = 18;

    // Guardar el archivo Excel
    await workbook.xlsx.writeFile(XLSX_PATH);
    console.log('[OK] Reporte Excel profesional generado exitosamente en: ' + XLSX_PATH);
}

main().catch(console.error);
