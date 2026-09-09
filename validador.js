// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// validador.js - Motor de Validación Estricta y Detección de Intención
// ==============================================================================

// Normaliza texto: minúsculas, sin diacríticos, espacios limpios
function normalizar(texto) {
    if (!texto || typeof texto !== 'string') return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // elimina tildes
        .replace(/[\.,;:!¡?¿\(\)\[\]"'\-_/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Lista de marcas comunes reconocidas en supermercados argentinos
const MARCAS_CONOCIDAS = [
    // Bebidas y Gaseosas
    'secco', 'coca cola', 'coca-cola', 'coca', 'pepsi', 'fanta', 'sprite', 'manaos',
    '7up', 'seven up', 'aquarius', 'levite', 'villavicencio', 'eco de los andes',
    'kin', 'ivess', 'pritty', 'terma', 'quilmes', 'brahma', 'stella artois',
    'heineken', 'corona', 'andes origen', 'andes', 'ser',
    // Lácteos
    'la serenisima', 'serenisima', 'sancor', 'tregar', 'las tres ninas', 'tres ninas',
    'ilolay', 'veronica', 'milkaut', 'manfrey', 'danette', 'danonino', 'actacol',
    // Almacén / Infusiones
    'playadito', 'taragui', 'amanda', 'chamigo', 'nobleza gaucha', 'la merced',
    'cruz de malta', 'union', 'cbse', 'rosamonte', 'canuelas', 'natura', 'cocinero',
    'marolio', 'lira', 'pureza', 'blancaflor', 'favorita', 'morixe', 'lucchetti',
    'luchetti', 'matarazzo', 'knorr', 'maggi', 'arcor', 'gallo', 'gallo oro',
    'ala', 'molinos ala', 'maximo', 'dos hermanos', 'ledesma', 'chango', 'nescafe',
    'dolca', 'arlistan', 'la virginia', 'cabrales', 'hellmanns', 'danica', 'fanacoa',
    'la campagnola', 'salsati', 'marolio', 'maruchan', 'carrefour', 'coto', 'dia',
    // Galletitas / Snacks
    'oreo', 'pepitos', 'chocolinas', 'terrabusi', 'sonrisas', 'rumba', 'melba',
    'amor', 'don satur', '9 de oro', 'criollitas', 'express', 'club social',
    'lays', 'doritos', 'cheetos',
    // Higiene y Limpieza
    'dove', 'sedal', 'pantene', 'head & shoulders', 'elvive', 'plusbelle',
    'colgate', 'oral-b', 'gillette', 'rexona', 'axe', 'nivea', 'higienol',
    'elegante', 'campanita', 'felpita', 'scott', 'elite', 'ariel', 'skip',
    'drive', 'magistral', 'cif', 'ayudin', 'poett', 'procensol'
];

// Categorías / Tipos de producto para evitar cruces absurdos (ej: bebida vs fruta vs shampoo)
const CATEGORIAS_PRODUCTO = {
    gaseosa: ['gaseosa', 'cola', 'soda', 'bebida con gas', 'refresco'],
    bebida: ['bebida', 'jugo', 'gaseosa', 'agua', 'saborizada'],
    leche: ['leche', 'lactea', 'descremada', 'entera', 'proteina', 'uht'],
    fideos: ['fideos', 'tallarin', 'spaghetti', 'tirabuzon', 'mostachol', 'guisero', 'pasta'],
    arroz: ['arroz', 'parboil', 'largo fino', 'doble carolina'],
    aceite: ['aceite', 'girasol', 'oliva', 'maiz', 'mezcla'],
    yerba: ['yerba', 'yerba mate', 'mate'],
    galletitas: ['galletitas', 'galletas', 'biscotti', 'dulces'],
    shampoo: ['shampoo', 'champu', 'acondicionador', 'enjuague', 'capilar'],
    limpieza: ['jabon', 'detergente', 'lavandina', 'desodorante', 'limpiador']
};

// Palabras que expresamente indican búsqueda genérica
const PALABRAS_GENERICAS = [
    'barato', 'barata', 'baratos', 'baratas',
    'economico', 'economica', 'economicos', 'economicas',
    'generico', 'generica', 'alternativa', 'comun', 'cualquiera'
];

// Extraer unidad y valor numérico de presentación (ej: "2.25L" -> { valor: 2.25, tipo: 'l', raw: '2.25l' })
function extraerPresentacion(texto) {
    if (!texto || typeof texto !== 'string') return null;
    var raw = texto.toLowerCase();
    // Litros / Mililitros: 2.25l, 2,25 lts, 1.5 l, 500 ml, etc.
    var mVol = raw.match(/(\d+(?:[.,]\d+)?)\s*(litros?|lts?|lt|l|mililitros?|mls?|ml|cc)\b/);
    if (mVol) {
        var num = parseFloat(mVol[1].replace(',', '.'));
        var u = mVol[2].startsWith('m') || mVol[2] === 'cc' ? 'ml' : 'l';
        var valorLitros = u === 'ml' ? num / 1000 : num;
        return { valor: valorLitros, tipo: 'l', raw: mVol[0].trim() };
    }
    // Kilogramos / Gramos: 1kg, 1.5 kgs, 500g, 500 grs
    var mPeso = raw.match(/(\d+(?:[.,]\d+)?)\s*(kilos?|kilogramos?|kgs?|kg|k|gramos?|grs?|gr|g)\b/);
    if (mPeso) {
        var numP = parseFloat(mPeso[1].replace(',', '.'));
        var uP = mPeso[2].startsWith('g') ? 'g' : 'kg';
        var valorKg = uP === 'g' ? numP / 1000 : numP;
        return { valor: valorKg, tipo: 'kg', raw: mPeso[0].trim() };
    }
    return null;
}

// Detecta la intención de búsqueda: ESPECÍFICA o GENÉRICA
function detectarIntencion(queryOriginal) {
    var queryNorm = normalizar(queryOriginal);
    if (!queryNorm) {
        return { tipo: 'GENERICA', marca: null, presentacion: null, categoria: null, palabras: [] };
    }

    // 1. Detectar si contiene palabras explícitamente genéricas ("arroz barato", "leche economica")
    var tienePalabraGenerica = PALABRAS_GENERICAS.some(function(pg) {
        return queryNorm.includes(pg);
    });

    // 2. Detectar si contiene alguna marca conocida
    var marcaEncontrada = null;
    // Ordenamos marcas por longitud descendente para que 'la serenisima' gane a 'serenisima'
    var marcasOrdenadas = MARCAS_CONOCIDAS.slice().sort(function(a, b) { return b.length - a.length; });
    for (var i = 0; i < marcasOrdenadas.length; i++) {
        var m = marcasOrdenadas[i];
        // Buscamos coincidencia como palabra completa
        var regex = new RegExp('(?:^|\\s)' + m.replace('-', '[-\\s]') + '(?:$|\\s)', 'i');
        if (regex.test(queryNorm)) {
            marcaEncontrada = m;
            break;
        }
    }

    // 3. Extraer presentación si existe
    var pres = extraerPresentacion(queryOriginal);

    // 4. Identificar categoría
    var catEncontrada = null;
    var keys = Object.keys(CATEGORIAS_PRODUCTO);
    for (var j = 0; j < keys.length; j++) {
        var cat = keys[j];
        var palabrasCat = CATEGORIAS_PRODUCTO[cat];
        if (palabrasCat.some(function(p) { return queryNorm.includes(p); })) {
            catEncontrada = cat;
            break;
        }
    }

    // Clasificación de intención:
    // Es ESPECÍFICA si tiene una marca detectada, o si tiene presentación exacta, o si tiene al menos 3 palabras específicas
    var palabras = queryNorm.split(/\s+/);
    var esEspecifica = false;

    if (marcaEncontrada && !tienePalabraGenerica) {
        esEspecifica = true;
    } else if (tienePalabraGenerica) {
        esEspecifica = false;
    } else if (palabras.length === 1 && !marcaEncontrada) {
        // Un solo término general (ej: "yerba", "leche", "arroz") es genérico
        esEspecifica = false;
    } else if (palabras.length >= 2) {
        // Consultas compuestas: si no es puramente descriptiva de categoría
        // Ej: "bebida de naranja" -> no tiene marca -> genérica
        // Ej: "gaseosa secco pomelo" -> tiene 'secco' -> específica
        // Ej: "yerba playadito" -> tiene 'playadito' -> específica
        if (marcaEncontrada) {
            esEspecifica = true;
        } else {
            // Sin marca: si es "bebida de naranja", "fideos tirabuzon", "arroz largo fino" -> genérica
            esEspecifica = false;
        }
    }

    return {
        tipo: esEspecifica ? 'ESPECIFICA' : 'GENERICA',
        marca: marcaEncontrada,
        presentacion: pres,
        categoria: catEncontrada,
        palabras: palabras,
        queryNormalizada: queryNorm
    };
}

// Valida si un producto extraído coincide con la consulta solicitada
function validarCoincidencia(queryOriginal, resultado) {
    var intencion = detectarIntencion(queryOriginal);
    var nombreEncontrado = resultado.nombre || '';
    var nombreNorm = normalizar(nombreEncontrado);
    var precioStr = resultado.precioStr || '';
    var stockRaw = normalizar(resultado.stockRaw || '');

    // 1. Detección de "No encontrado"
    if (!nombreEncontrado ||
        nombreNorm.includes('no encontrado') ||
        nombreNorm.includes('sin resultados') ||
        nombreNorm === 'n/d' ||
        resultado.precio === null && !nombreNorm) {
        return {
            estado: 'NO ENCONTRADO',
            valido: false,
            motivo: 'El producto no fue encontrado en el catálogo del supermercado.',
            intencion: intencion.tipo,
            marca: intencion.marca
        };
    }

    // 2. Detección de "Sin stock"
    if (stockRaw.includes('sin stock') ||
        stockRaw.includes('agotado') ||
        nombreNorm.includes('sin stock') ||
        nombreNorm.includes('agotado') ||
        precioStr.toLowerCase().includes('sin stock') ||
        precioStr.toLowerCase().includes('agotado')) {
        return {
            estado: 'SIN STOCK',
            valido: false,
            motivo: 'El producto existe en el catálogo pero se encuentra agotado / sin stock.',
            intencion: intencion.tipo,
            marca: intencion.marca
        };
    }

    // 3. Validación de BÚSQUEDA GENÉRICA
    if (intencion.tipo === 'GENERICA') {
        // En búsqueda genérica, el producto devuelto debe al menos pertenecer a la categoría o tener alguna palabra clave
        // Ej: si buscó "bebida de naranja", no puede devolver "arroz" o "shampoo"
        if (intencion.categoria) {
            var terminosValidos = CATEGORIAS_PRODUCTO[intencion.categoria] || [];
            var coincideCategoria = terminosValidos.some(function(t) {
                return nombreNorm.includes(t);
            });

            // Si además buscó un sabor/ingrediente como "naranja", "pomelo", "manzana", verificar que esté presente
            var saboresComunes = ['naranja', 'pomelo', 'manzana', 'limon', 'cola', 'pera', 'uva', 'frutilla', 'durazno'];
            var saborBuscado = saboresComunes.find(function(s) { return intencion.queryNormalizada.includes(s); });
            if (saborBuscado && !nombreNorm.includes(saborBuscado)) {
                return {
                    estado: 'COINCIDENCIA NO VÁLIDA',
                    valido: false,
                    motivo: 'Se solicitó sabor ' + saborBuscado + ' pero el producto devuelto (' + nombreEncontrado + ') no lo incluye.',
                    intencion: intencion.tipo,
                    marca: null
                };
            }

            if (!coincideCategoria && intencion.palabras.length > 0) {
                // Verificar si al menos una palabra clave de la categoría está
                var algunaPalabra = intencion.palabras.some(function(p) {
                    return p.length > 3 && nombreNorm.includes(p);
                });
                if (!algunaPalabra) {
                    return {
                        estado: 'COINCIDENCIA NO VÁLIDA',
                        valido: false,
                        motivo: 'El producto (' + nombreEncontrado + ') no corresponde a la categoría solicitada.',
                        intencion: intencion.tipo,
                        marca: null
                    };
                }
            }
        }

        return {
            estado: 'VALIDADA',
            valido: true,
            motivo: 'Coincidencia genérica validada (alternativa comercial aceptable).',
            intencion: intencion.tipo,
            marca: null
        };
    }

    // 4. Validación de BÚSQUEDA ESPECÍFICA
    // A) Validación ESTRICTA de MARCA: si se indicó marca, DEBE estar en el nombre extraído
    if (intencion.marca) {
        var marcaBuscada = intencion.marca;
        // Tratamiento de variantes equivalentes
        var regexMarca = new RegExp('(?:^|\\s)' + marcaBuscada.replace('-', '[-\\s]') + '(?:$|\\s)', 'i');
        if (!regexMarca.test(nombreNorm)) {
            return {
                estado: 'COINCIDENCIA NO VÁLIDA',
                valido: false,
                motivo: 'Marca requerida "' + marcaBuscada.toUpperCase() + '" no coincide con el producto devuelto ("' + nombreEncontrado + '").',
                intencion: intencion.tipo,
                marca: intencion.marca
            };
        }
    }

    // B) Validación de Tipo / Categoría: evitar cruce de gaseosa con fruta o shampoo
    if (intencion.categoria) {
        // Chequeos de exclusión cruzada comunes
        if (intencion.categoria === 'gaseosa' || intencion.categoria === 'bebida') {
            if (nombreNorm.includes('shampoo') || nombreNorm.includes('jabon') || nombreNorm.includes('arroz') || nombreNorm.includes('fideos') || nombreNorm.includes('aceite')) {
                return {
                    estado: 'COINCIDENCIA NO VÁLIDA',
                    valido: false,
                    motivo: 'El resultado devuelto pertenece a una categoría ajena a bebidas.',
                    intencion: intencion.tipo,
                    marca: intencion.marca
                };
            }
            // Si el nombre dice "xkg" o fruta pura sin gaseosa
            if (nombreNorm.includes('xkg') || nombreNorm.includes('por kg') && !nombreNorm.includes('gaseosa') && !nombreNorm.includes('bebida')) {
                return {
                    estado: 'COINCIDENCIA NO VÁLIDA',
                    valido: false,
                    motivo: 'El resultado corresponde a fruta/verdura y no a la bebida solicitada.',
                    intencion: intencion.tipo,
                    marca: intencion.marca
                };
            }
        }
    }

    // C) Validación de Sabor o Variante específica
    var variantes = ['pomelo', 'naranja', 'limon', 'cola', 'zero', 'diet', 'light', 'sin azucar', 'clasica', 'original'];
    for (var v = 0; v < variantes.length; v++) {
        var varItem = variantes[v];
        if (intencion.queryNormalizada.includes(varItem)) {
            if (!nombreNorm.includes(varItem)) {
                return {
                    estado: 'COINCIDENCIA NO VÁLIDA',
                    valido: false,
                    motivo: 'Variante/sabor "' + varItem + '" no presente en el resultado encontrado.',
                    intencion: intencion.tipo,
                    marca: intencion.marca
                };
            }
        }
    }

    // D) Validación de Presentación / Tamaño si se especificó
    if (intencion.presentacion) {
        var presEncontrada = extraerPresentacion(nombreEncontrado);
        if (presEncontrada && presEncontrada.tipo === intencion.presentacion.tipo) {
            // Tolerancia de tamaño: si pidió 2.25L y viene 500ml (ratio > 1.5 o < 0.6)
            var ratio = presEncontrada.valor / intencion.presentacion.valor;
            if (ratio > 1.4 || ratio < 0.7) {
                return {
                    estado: 'COINCIDENCIA NO VÁLIDA',
                    valido: false,
                    motivo: 'Presentación incompatible: solicitada ' + intencion.presentacion.raw + ' vs encontrada ' + presEncontrada.raw + '.',
                    intencion: intencion.tipo,
                    marca: intencion.marca
                };
            }
        }
    }

    return {
        estado: 'VALIDADA',
        valido: true,
        motivo: 'Coincidencia específica validada (marca, categoría y atributos conformes).',
        intencion: intencion.tipo,
        marca: intencion.marca
    };
}

// Parsea cadenas de precios argentinos (ej: "$ 5.209,00 c/u" -> 5209.00)
function parsePrecio(str) {
    if (!str || typeof str !== 'string' || str === 'N/D' || str === 'null') return null;
    var match = str.match(/[\d.]+(?:,\d+)?/);
    if (!match) return null;
    var raw = match[0].replace(/\./g, '').replace(',', '.');
    var val = parseFloat(raw);
    return isNaN(val) || val <= 0 ? null : val;
}

// Formatea número como moneda argentina ($ 1.234,56)
function formatoMoneda(num) {
    if (num === null || num === undefined || isNaN(num)) return 'N/D';
    return '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Lee resultados.csv reconociendo formatos de 8 o 5 columnas
function leerResultadosCSV(filePath) {
    const fs = require('fs');
    const path = require('path');
    var csvFile = filePath || path.join(__dirname, 'resultados.csv');
    if (!fs.existsSync(csvFile)) return [];

    var raw = fs.readFileSync(csvFile, 'utf-8');
    var lines = raw.split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
    if (lines.length <= 1) return [];

    var items = [];
    for (var i = 1; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('sep=')) continue;

        // Parsear fila CSV respetando comillas
        var match = line.match(/(?:^|,)(?:"([^"]*)"|([^,]*))/g);
        if (!match) continue;
        var cols = match.map(function(c) {
            c = c.replace(/^,/, '').trim();
            if (c.startsWith('"') && c.endsWith('"')) c = c.slice(1, -1);
            return c;
        });

        if (cols.length >= 8) {
            // Formato nuevo de 8 columnas:
            // modo, producto_solicitado, nombre_encontrado, precio, supermercado, url, fecha, stock_status
            items.push({
                modo: cols[0] || 'compra_mes',
                producto: cols[1] || 'producto',
                nombre: cols[2] || 'N/D',
                precioStr: cols[3] || 'N/D',
                precio: parsePrecio(cols[3]),
                supermercado: cols[4] || 'N/D',
                url: cols[5] || '',
                fecha: cols[6] || '',
                stockRaw: cols[7] || 'DISPONIBLE'
            });
        } else if (cols.length >= 5) {
            // Formato antiguo de 5 columnas: Nombre, Precio, Supermercado, URL, Fecha
            var nombre = cols[0] || 'N/D';
            var precioStr = cols[1] || 'N/D';
            var superm = cols[2] || 'N/D';
            var url = cols[3] || '';
            var fecha = cols[4] || '';

            items.push({
                modo: 'compra_mes',
                producto: nombre.split(/\s+/).slice(0, 2).join(' '),
                nombre: nombre,
                precioStr: precioStr,
                precio: parsePrecio(precioStr),
                supermercado: superm,
                url: url,
                fecha: fecha,
                stockRaw: 'DISPONIBLE'
            });
        }
    }
    return items;
}

// Genera y muestra en consola el reporte para Búsqueda Individual
function mostrarReporteIndividual(productoBuscado) {
    const path = require('path');
    var items = leerResultadosCSV(path.join(__dirname, 'resultados.csv'));
    if (items.length === 0) {
        console.log('[ERROR] No se encontraron resultados registrados en resultados.csv');
        return;
    }

    // Filtrar por modo individual o tomar los últimos registros
    var individuales = items.filter(function(x) { return x.modo === 'individual'; });
    var grupo = [];

    if (productoBuscado) {
        var pNorm = normalizar(productoBuscado);
        grupo = individuales.filter(function(x) { return normalizar(x.producto) === pNorm; });
        if (grupo.length === 0) {
            // Si no coincide exactamente por modo individual, buscar en los últimos items
            grupo = items.filter(function(x) { return normalizar(x.producto) === pNorm; });
        }
    }

    // Si aún no hay grupo, tomar los últimos 3 registros
    if (grupo.length === 0) {
        grupo = items.slice(-3);
    } else if (grupo.length > 3) {
        // Tomar los últimos 3 de esa búsqueda
        grupo = grupo.slice(-3);
    }

    var queryFinal = productoBuscado || (grupo[0] ? grupo[0].producto : 'Producto');
    var intencion = detectarIntencion(queryFinal);

    // Validar cada resultado del grupo
    var evaluados = grupo.map(function(item) {
        var v = validarCoincidencia(queryFinal, item);
        return {
            supermercado: item.supermercado,
            nombre: item.nombre,
            precio: item.precio,
            precioStr: item.precioStr,
            estado: v.estado,
            valido: v.valido,
            motivo: v.motivo,
            url: item.url
        };
    });

    // Encontrar opciones válidas con precio disponible
    var validos = evaluados.filter(function(e) { return e.valido && e.precio !== null; });
    validos.sort(function(a, b) { return a.precio - b.precio; });

    var ganador = validos.length > 0 ? validos[0] : null;
    var masCaro = validos.length > 1 ? validos[validos.length - 1] : null;
    var ahorro = (ganador && masCaro && masCaro.precio > ganador.precio) ? (masCaro.precio - ganador.precio) : 0;
    var ahorroPct = (masCaro && masCaro.precio > 0) ? ((ahorro / masCaro.precio) * 100) : 0;

    // Impresión en consola con formato prolijo
    console.log('\n================================================================================');
    console.log('       🔍 REPORTE DE BÚSQUEDA INDIVIDUAL - VALIDACIÓN INTELIGENTE');
    console.log('================================================================================');
    console.log(' Producto Solicitado : "' + queryFinal + '"');
    console.log(' Intención Detectada : ' + intencion.tipo + (intencion.marca ? ' (Marca: ' + intencion.marca.toUpperCase() + ')' : '') + (intencion.categoria ? ' [Categoría: ' + intencion.categoria + ']' : ''));
    console.log(' Regla Aplicada      : ' + (intencion.tipo === 'ESPECIFICA' ? 'Validación ESTRICTA de marca y tipo (rechaza sustitutos)' : 'Comparación abierta de alternativas de mercado'));
    console.log('--------------------------------------------------------------------------------');
    console.log(
        ' SUPERMERCADO'.padEnd(15) + '│ ' +
        'PRECIO'.padEnd(14) + '│ ' +
        'ESTADO'.padEnd(23) + '│ ' +
        'PRODUCTO ENCONTRADO'
    );
    console.log('─'.repeat(15) + '┼─' + '─'.repeat(13) + '┼─' + '─'.repeat(22) + '┼─' + '─'.repeat(25));

    evaluados.forEach(function(e) {
        var esGanador = ganador && e.supermercado === ganador.supermercado && e.valido;
        var tagEstado = esGanador ? '🏆 GANADOR' : (e.valido ? ' VALIDADA' : '❌ ' + e.estado);
        var precioTexto = e.precio !== null ? formatoMoneda(e.precio) : (e.precioStr || 'N/D');
        var nombreTexto = e.nombre.length > 45 ? e.nombre.slice(0, 42) + '...' : e.nombre;

        console.log(
            (' ' + e.supermercado).padEnd(15) + '│ ' +
            precioTexto.padEnd(14) + '│ ' +
            tagEstado.padEnd(23) + '│ ' +
            nombreTexto
        );
        if (!e.valido && e.motivo) {
            console.log(' '.repeat(15) + '│ ' + ' '.repeat(13) + '│ ' + ('   └─ Motivo: ' + e.motivo).slice(0, 60));
        }
    });

    console.log('--------------------------------------------------------------------------------');
    if (ganador) {
        console.log(' 🏆 MEJOR OPCIÓN     : ' + ganador.supermercado + ' (' + formatoMoneda(ganador.precio) + ')');
        if (ahorro > 0) {
            console.log(' 💰 AHORRO POTENCIAL : ' + formatoMoneda(ahorro) + ' (' + ahorroPct.toFixed(0) + '% menos que ' + masCaro.supermercado + ')');
        } else if (validos.length === 1) {
            console.log(' ℹ️  DISPONIBILIDAD   : Solo ' + ganador.supermercado + ' tuvo el producto con coincidencia válida.');
        } else {
            console.log(' ℹ️  PRECIOS         : Mismo valor en las opciones validadas.');
        }
    } else {
        console.log(' ⚠️  ALERTA: Ningún supermercado arrojó una coincidencia válida disponible.');
        console.log('     El sistema evitó sustituir con productos erróneos (marcas ajenas, frutas o shampoo).');
    }
    console.log('================================================================================\n');
}

// Limpia resultados según la opción seleccionada sin tocar input.csv
function limpiarResultados(opcion) {
    const fs = require('fs');
    const path = require('path');
    var csvFile = path.join(__dirname, 'resultados.csv');
    var header = 'modo,producto_solicitado,nombre_encontrado,precio,supermercado,url,fecha,stock_status\n';

    if (!fs.existsSync(csvFile)) {
        fs.writeFileSync(csvFile, header, 'utf-8');
        console.log('[OK] Archivo resultados.csv inicializado.');
        return;
    }

    var items = leerResultadosCSV(csvFile);

    if (opcion === '1') {
        // Limpiar solo compra del mes actual, conservar búsquedas individuales
        var restantes = items.filter(function(x) { return x.modo === 'individual'; });
        var contenido = header;
        restantes.forEach(function(r) {
            var nomEsc = r.nombre.includes(',') ? '"' + r.nombre + '"' : r.nombre;
            var preEsc = r.precioStr.includes(',') ? '"' + r.precioStr + '"' : r.precioStr;
            contenido += [r.modo, r.producto, nomEsc, preEsc, r.supermercado, r.url, r.fecha, r.stockRaw].join(',') + '\n';
        });
        fs.writeFileSync(csvFile, contenido, 'utf-8');
        console.log('[OK] Se eliminaron los registros de "Compra del mes". Se conservó el historial de consultas individuales.');
    } else if (opcion === '2') {
        // Limpiar solo historial de consultas individuales, conservar compra del mes
        var restantesM = items.filter(function(x) { return x.modo !== 'individual'; });
        var contenidoM = header;
        restantesM.forEach(function(r) {
            var nomEscM = r.nombre.includes(',') ? '"' + r.nombre + '"' : r.nombre;
            var preEscM = r.precioStr.includes(',') ? '"' + r.precioStr + '"' : r.precioStr;
            contenidoM += [r.modo, r.producto, nomEscM, preEscM, r.supermercado, r.url, r.fecha, r.stockRaw].join(',') + '\n';
        });
        fs.writeFileSync(csvFile, contenidoM, 'utf-8');
        console.log('[OK] Se limpió el historial de búsquedas individuales. Se conservó la compra del mes.');
    } else if (opcion === '3') {
        // Limpiar todo
        fs.writeFileSync(csvFile, header, 'utf-8');
        console.log('[OK] Todo el archivo resultados.csv ha sido reiniciado con cabeceras limpias.');
    } else {
        console.log('[INFO] Operación de limpieza cancelada.');
    }
}

// Genera temp_input.csv de forma 100% segura respetando RFC-4180
function crearTempInput(producto) {
    const fs = require('fs');
    const path = require('path');

    // Limpiar consultas individuales previas para que cada búsqueda sea limpia y actualice a la nueva
    limpiarResultados('2');

    var tempFile = path.join(__dirname, 'temp_input.csv');
    var q = (producto || '').trim();
    var esc = '"' + q.replace(/"/g, '""') + '"';
    fs.writeFileSync(tempFile, 'producto,modo\r\n' + esc + ',individual\r\n', 'utf8');
    console.log('[OK] temp_input.csv generado de forma segura para: ' + q);
}

// Ejecución como script CLI
if (require.main === module) {
    var args = process.argv.slice(2);
    if (args[0] === '--crear-temp') {
        var prodArg = args.slice(1).join(' ').trim();
        crearTempInput(prodArg);
    } else if (args[0] === '--reporte-individual') {
        var queryArg = args.slice(1).join(' ').trim();
        mostrarReporteIndividual(queryArg || null);
    } else if (args[0] === '--limpiar') {
        limpiarResultados(args[1] || '3');
    } else if (args[0] === '--test') {
        console.log('======================================================================');
        console.log('       🧪 BATERÍA DE PRUEBAS UNITARIAS: validador.js');
        console.log('======================================================================');
        var errores = 0;

        function assertEq(desc, real, esperado) {
            if (real === esperado) {
                console.log(' [OK] ' + desc + ' -> ' + real);
            } else {
                console.log(' [FAIL] ' + desc + ' -> Esperado: ' + esperado + ', Obtenido: ' + real);
                errores++;
            }
        }

        // Test 1: Rechazo de Manaos para Secco específico
        var r1 = validarCoincidencia('Gaseosa Secco Pomelo', { nombre: 'Gaseosa Manaos Pomelo 2.25L', precio: 1000 });
        assertEq('Rechazo de Manaos para consulta Secco', r1.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 2: Rechazo de Pepsi para Secco específico
        var r2 = validarCoincidencia('Gaseosa Secco Pomelo', { nombre: 'Gaseosa Pepsi Pomelo 1.5L', precio: 1200 });
        assertEq('Rechazo de Pepsi para consulta Secco', r2.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 3: Rechazo de Fanta para Secco específico
        var r3 = validarCoincidencia('Gaseosa Secco Pomelo', { nombre: 'Gaseosa Fanta Pomelo 2L', precio: 1500 });
        assertEq('Rechazo de Fanta para consulta Secco', r3.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 4: Rechazo de fruta por kg para bebida
        var r4 = validarCoincidencia('Gaseosa Secco Pomelo', { nombre: 'Pomelo Rojo . Xkg', precio: 999 });
        assertEq('Rechazo de Pomelo fruta para Secco', r4.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 5: Aceptación de alternativa en búsqueda genérica
        var r5 = validarCoincidencia('gaseosa de pomelo', { nombre: 'Gaseosa Manaos Pomelo 2.25L', precio: 1000 });
        assertEq('Aceptación de alternativa en búsqueda genérica', r5.estado, 'VALIDADA');

        // Test 6: Equivalencia 2.25L vs 2250ml
        var r6 = validarCoincidencia('Coca Cola 2.25L', { nombre: 'Coca Cola 2250ml', precio: 2000 });
        assertEq('Equivalencia 2.25L vs 2250ml', r6.estado, 'VALIDADA');

        // Test 7: Equivalencia 2,25 litros vs 2.25L
        var r7 = validarCoincidencia('Coca Cola 2,25 litros', { nombre: 'Coca Cola 2.25L', precio: 2000 });
        assertEq('Equivalencia 2,25 litros vs 2.25L', r7.estado, 'VALIDADA');

        // Test 8: Incompatibilidad 2.25L vs 500ml
        var r8 = validarCoincidencia('Coca Cola 2.25L', { nombre: 'Coca Cola 500ml', precio: 800 });
        assertEq('Incompatibilidad 2.25L vs 500ml', r8.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 9: Incompatibilidad 1kg vs 500g
        var r9 = validarCoincidencia('Arroz Ala 1kg', { nombre: 'Arroz Ala 500g', precio: 800 });
        assertEq('Incompatibilidad 1kg vs 500g', r9.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 10: Producto sin stock
        var r10 = validarCoincidencia('leche', { nombre: 'Leche Serenisima 1L', precioStr: 'Sin stock', stockRaw: 'SIN STOCK' });
        assertEq('Detección de Sin Stock', r10.estado, 'SIN STOCK');

        console.log('----------------------------------------------------------------------');
        if (errores === 0) {
            console.log(' 🎉 DIAGNÓSTICO FINAL: TODAS LAS PRUEBAS DEL VALIDADOR PASARON (10/10)\n');
            process.exit(0);
        } else {
            console.log(' ❌ DIAGNÓSTICO FINAL: SE DETECTARON ' + errores + ' ERRORES\n');
            process.exit(1);
        }
    } else {
        console.log('Uso: node validador.js [--reporte-individual "producto"] | [--limpiar 1|2|3] | [--crear-temp "producto"] | [--test]');
    }
}

module.exports = {
    normalizar: normalizar,
    extraerPresentacion: extraerPresentacion,
    detectarIntencion: detectarIntencion,
    validarCoincidencia: validarCoincidencia,
    parsePrecio: parsePrecio,
    formatoMoneda: formatoMoneda,
    leerResultadosCSV: leerResultadosCSV,
    mostrarReporteIndividual: mostrarReporteIndividual,
    limpiarResultados: limpiarResultados,
    crearTempInput: crearTempInput,
    MARCAS_CONOCIDAS: MARCAS_CONOCIDAS,
    CATEGORIAS_PRODUCTO: CATEGORIAS_PRODUCTO
};
