// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// catalogo.js - Motor de Catálogo Cerrado Centralizado y Validación Estricta
// ==============================================================================

const fs = require('fs');
const path = require('path');

const CATALOGO_PATH = path.join(__dirname, 'catalogo.json');

let catalogoCache = null;
let itemsPlanosCache = null;

function normalizarTexto(texto) {
    if (!texto || typeof texto !== 'string') return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // elimina tildes
        .replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cargarCatalogo() {
    if (catalogoCache && itemsPlanosCache) {
        return { catalogo: catalogoCache, items: itemsPlanosCache };
    }

    if (!fs.existsSync(CATALOGO_PATH)) {
        throw new Error('No se encontró el archivo catalogo.json en ' + CATALOGO_PATH);
    }

    const raw = fs.readFileSync(CATALOGO_PATH, 'utf8');
    catalogoCache = JSON.parse(raw);

    const items = [];
    for (const cat of Object.keys(catalogoCache)) {
        const prods = catalogoCache[cat];
        for (const item of prods) {
            items.push(Object.assign({}, item, {
                categoria: cat,
                _normMarca: normalizarTexto(item.marca),
                _normProducto: normalizarTexto(item.producto),
                _normVariante: normalizarTexto(item.variante || ''),
                _normCompleto: normalizarTexto(item.nombre_completo || '')
            }));
        }
    }
    itemsPlanosCache = items;
    return { catalogo: catalogoCache, items: itemsPlanosCache };
}

// Normalización matemática dimensional exacta de volumen y peso
function normalizarPresentacion(cantidad, unidad) {
    if (cantidad === undefined || cantidad === null) return null;
    const num = typeof cantidad === 'number' ? cantidad : parseFloat(String(cantidad).replace(',', '.'));
    if (isNaN(num) || num <= 0) return null;

    const uNorm = normalizarTexto(unidad || '');
    if (uNorm.startsWith('l') || uNorm.includes('litro') || uNorm === 'lt' || uNorm === 'lts') {
        return { valorBase: num, tipo: 'litros', unidadBase: 'L' };
    }
    if (uNorm.startsWith('m') || uNorm === 'cc' || uNorm.includes('mili')) {
        return { valorBase: num / 1000, tipo: 'litros', unidadBase: 'L' };
    }
    if (uNorm.startsWith('k') || uNorm.includes('kilo') || uNorm === 'kg' || uNorm === 'kgs') {
        return { valorBase: num, tipo: 'kilos', unidadBase: 'kg' };
    }
    if (uNorm.startsWith('g') || uNorm.includes('gram')) {
        return { valorBase: num / 1000, tipo: 'kilos', unidadBase: 'kg' };
    }
    if (uNorm.includes('un') || uNorm.includes('rollo') || uNorm.includes('u')) {
        return { valorBase: num, tipo: 'unidades', unidadBase: 'un' };
    }

    return { valorBase: num, tipo: 'generico', unidadBase: uNorm };
}

// Compara dos presentaciones exigiendo igualdad dimensional exacta (tolerancia cero a diferencias de tamaño)
function esPresentacionEquivalente(cantA, unidA, cantB, unidB) {
    const pA = normalizarPresentacion(cantA, unidA);
    const pB = normalizarPresentacion(cantB, unidB);
    if (!pA || !pB) return false;
    if (pA.tipo !== pB.tipo) return false;
    return Math.abs(pA.valorBase - pB.valorBase) < 0.001;
}

// Parsea un string que contiene texto y posible presentación (ej: "Coca Cola 2.25L", "Arroz Gallo 1kg")
function parsearStringProducto(str) {
    if (!str || typeof str !== 'string') return { texto: '', cantidad: null, unidad: '' };
    const raw = str.trim();

    // Detectar volumen
    const mVol = raw.match(/(\d+(?:[.,]\d+)?)\s*(litros?|lts?|lt|l|mililitros?|mls?|ml|cc)\b/i);
    if (mVol) {
        const c = parseFloat(mVol[1].replace(',', '.'));
        const u = mVol[2].toLowerCase().startsWith('m') || mVol[2].toLowerCase() === 'cc' ? 'ml' : 'L';
        const texto = raw.replace(mVol[0], '').trim();
        return { texto, cantidad: c, unidad: u };
    }

    // Detectar peso
    const mPeso = raw.match(/(\d+(?:[.,]\d+)?)\s*(kilos?|kilogramos?|kgs?|kg|k|gramos?|grs?|gr|g)\b/i);
    if (mPeso) {
        const c = parseFloat(mPeso[1].replace(',', '.'));
        const u = mPeso[2].toLowerCase().startsWith('g') ? 'g' : 'kg';
        const texto = raw.replace(mPeso[0], '').trim();
        return { texto, cantidad: c, unidad: u };
    }

    // Detectar unidades
    const mUn = raw.match(/(?:pack\s*x?\s*|x\s*)?(\d+)\s*(?:unidades?|unids?|unid|un|rollos?|u)\b/i);
    if (mUn) {
        const c = parseInt(mUn[1], 10);
        const texto = raw.replace(mUn[0], '').trim();
        return { texto, cantidad: c, unidad: 'un' };
    }

    return { texto: raw, cantidad: null, unidad: '' };
}

// Busca un producto estrictamente en el catálogo cerrado
function buscarEnCatalogo(queryOAtributos) {
    const { items } = cargarCatalogo();
    if (!queryOAtributos) return null;

    let targetTexto = '';
    let targetCant = null;
    let targetUnid = '';

    if (typeof queryOAtributos === 'string') {
        const parsed = parsearStringProducto(queryOAtributos);
        targetTexto = normalizarTexto(parsed.texto);
        targetCant = parsed.cantidad;
        targetUnid = parsed.unidad;
    } else if (typeof queryOAtributos === 'object') {
        if (queryOAtributos.id) {
            const byId = items.find(it => it.id === queryOAtributos.id);
            if (byId) return byId;
        }
        const strBase = (queryOAtributos.producto || queryOAtributos.marca || '') + ' ' + (queryOAtributos.variante || '');
        const parsed = parsearStringProducto(strBase);
        targetTexto = normalizarTexto(parsed.texto || strBase);
        targetCant = queryOAtributos.cantidad !== undefined ? queryOAtributos.cantidad : parsed.cantidad;
        targetUnid = queryOAtributos.unidad || parsed.unidad;
    }

    if (!targetTexto) return null;

    // 1. Coincidencia exacta de nombre completo o ID
    for (const item of items) {
        if (item.id === targetTexto || item._normCompleto === targetTexto) {
            if (targetCant !== null && targetUnid) {
                if (!esPresentacionEquivalente(item.cantidad, item.unidad, targetCant, targetUnid)) continue;
            }
            return item;
        }
    }

    // 2. Coincidencia estricta por marca y/o producto con presentación
    const VARIANTES_CONOCIDAS = ['pomelo', 'naranja', 'limon', 'cola', 'manzana', 'frambuesa', 'vainilla', 'chocolate', 'original', 'zero', 'light', 'diet', 'largo fino', 'doble carolina', 'parboil', 'tallarines', 'tirabuzon', 'entera', 'descremada', 'girasol', 'oliva', 'maiz', 'tradicional', 'con palo', 'despalada', 'sin gas', 'con gas', 'restauracion', 'limpieza'];

    for (const item of items) {
        const palabrasTarget = targetTexto.split(' ');
        const tieneMarca = palabrasTarget.includes(item._normMarca) || targetTexto.includes(item._normMarca) || targetTexto.includes(item._normProducto);
        if (!tieneMarca) continue;

        // Si targetTexto menciona alguna variante conocida, debe estar presente en item._normVariante
        let contradiceVariante = false;
        if (item._normVariante) {
            for (const v of VARIANTES_CONOCIDAS) {
                if (item._normMarca.includes(v)) continue;
                if (targetTexto.includes(v) && !item._normVariante.includes(v)) {
                    contradiceVariante = true;
                    break;
                }
            }
        }
        if (contradiceVariante) continue;

        // Si se especificó variante en el objeto de consulta, verificarla
        if (typeof queryOAtributos === 'object' && queryOAtributos.variante) {
            const vBuscada = normalizarTexto(queryOAtributos.variante);
            if (item._normVariante && !item._normVariante.includes(vBuscada) && !vBuscada.includes(item._normVariante)) {
                continue;
            }
        }

        // Si se especificó presentación, debe ser estrictamente equivalente
        if (targetCant !== null && targetUnid) {
            if (esPresentacionEquivalente(item.cantidad, item.unidad, targetCant, targetUnid)) {
                return item;
            }
        } else {
            return item;
        }
    }

    return null;
}

// Valida si una entrada es válida contra el catálogo cerrado
function validarEntrada(entrada) {
    const item = buscarEnCatalogo(entrada);
    if (item) {
        return {
            valido: true,
            item: item,
            motivo: 'Producto perteneciente al catálogo cerrado.'
        };
    }

    const { catalogo, items } = cargarCatalogo();
    const categoriasDisponibles = Object.keys(catalogo);
    const opcionesPermitidas = items.map(it => it.nombre_completo);

    return {
        valido: false,
        item: null,
        motivo: 'El producto ingresado no pertenece al catálogo cerrado.',
        categorias: categoriasDisponibles,
        opciones: opcionesPermitidas
    };
}

// Valida un archivo CSV (ej: input.csv) contra el catálogo
function validarArchivoCSV(filePath) {
    const csvPath = filePath || path.join(__dirname, 'input.csv');
    if (!fs.existsSync(csvPath)) {
        return { valido: false, error: 'Archivo no encontrado: ' + csvPath, filasValidas: [], filasInvalidas: [] };
    }

    const raw = fs.readFileSync(csvPath, 'utf8');
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) {
        return { valido: false, error: 'El archivo CSV está vacío.', filasValidas: [], filasInvalidas: [] };
    }

    const filasValidas = [];
    const filasInvalidas = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(',').map(p => p.trim());
        const prod = parts[0] || '';
        const cant = parts[1] !== undefined ? parts[1] : 1;
        const unid = parts[2] || '';
        const unidades = parts[3] !== undefined ? parseInt(parts[3], 10) : 1;

        const val = validarEntrada({ producto: prod, cantidad: cant, unidad: unid });
        if (val.valido) {
            filasValidas.push({
                fila: i + 1,
                original: line,
                itemCatalogo: val.item,
                unidades: unidades || 1
            });
        } else {
            filasInvalidas.push({
                fila: i + 1,
                original: line,
                producto: prod,
                cantidad: cant,
                unidad: unid,
                motivo: val.motivo
            });
        }
    }

    return {
        valido: filasInvalidas.length === 0,
        totalFilas: lines.length - 1,
        filasValidas,
        filasInvalidas
    };
}

// Lista todas las categorías disponibles
function listarCategorias() {
    const { catalogo } = cargarCatalogo();
    return Object.keys(catalogo);
}

// Lista los productos de una categoría específica
function listarProductos(categoria) {
    const { catalogo } = cargarCatalogo();
    if (!categoria) return [];
    const catNorm = normalizarTexto(categoria);
    return catalogo[catNorm] || [];
}

// Exportación modular y ejecución CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.includes('--listar')) {
        const { catalogo } = cargarCatalogo();
        console.log('======================================================================');
        console.log('            📦 CATÁLOGO CERRADO DE PRODUCTOS DISPONIBLES             ');
        console.log('======================================================================\n');
        for (const cat of Object.keys(catalogo)) {
            console.log(`📂 Categoría: [${cat.toUpperCase()}]`);
            catalogo[cat].forEach(it => {
                console.log(`   • ${it.nombre_completo} (Marca: ${it.marca} | Variante: ${it.variante || 'N/A'})`);
            });
            console.log('');
        }
    } else if (args.includes('--validar-csv')) {
        const file = args[args.indexOf('--validar-csv') + 1] || 'input.csv';
        const res = validarArchivoCSV(file);
        if (res.valido) {
            console.log(`[OK] Todas las filas de ${file} pertenecen válidamente al catálogo cerrado (${res.filasValidas.length} productos).`);
            process.exit(0);
        } else {
            console.error(`[ERROR] Se detectaron productos en ${file} que NO pertenecen al catálogo cerrado:`);
            res.filasInvalidas.forEach(f => {
                console.error(`   - Fila ${f.fila}: "${f.original}" -> ${f.motivo}`);
            });
            process.exit(1);
        }
    } else if (args.includes('--validar')) {
        const prod = args[args.indexOf('--validar') + 1] || '';
        const res = validarEntrada(prod);
        if (res.valido) {
            console.log(`[OK] "${prod}" es válido en el catálogo: ${res.item.nombre_completo}`);
            process.exit(0);
        } else {
            console.error(`[ERROR] "${prod}" NO pertenece al catálogo cerrado.`);
            console.error('Opciones válidas permitidas:');
            res.opciones.slice(0, 10).forEach(op => console.error('   • ' + op));
            console.error('   ... (usa --listar para ver el catálogo completo)');
            process.exit(1);
        }
    } else {
        console.log('Uso: node catalogo.js [--listar] | [--validar "producto"] | [--validar-csv input.csv]');
    }
}

module.exports = {
    normalizarTexto,
    cargarCatalogo,
    normalizarPresentacion,
    esPresentacionEquivalente,
    buscarEnCatalogo,
    validarEntrada,
    validarArchivoCSV,
    listarCategorias,
    listarProductos
};
