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
    // Bebidas y Gaseosas / Cervezas
    'secco', 'coca cola', 'coca-cola', 'coca', 'pepsi', 'fanta', 'sprite', 'manaos',
    '7up', 'seven up', 'aquarius', 'levite', 'villavicencio', 'eco de los andes',
    'kin', 'ivess', 'pritty', 'terma', 'quilmes', 'brahma', 'stella artois',
    'heineken', 'corona', 'andes origen', 'andes', 'patagonia', 'imperial', 'schneider',
    'isenbeck', 'budweiser', 'gancia', 'fernet branca', 'branca', 'campari', 'cinzano',
    'ser', 'cepita', 'tang', 'clight', 'baggio', 'ades', 'bicitrico',
    // Lácteos y Bebidas Lácteas
    'la serenisima', 'serenisima', 'sancor', 'tregar', 'las tres ninas', 'tres ninas',
    'ilolay', 'veronica', 'milkaut', 'manfrey', 'danette', 'danonino', 'actacol',
    'barraza', 'la suipachense', 'suipachense', 'vacalin', 'san ignacio', 'la paulina',
    'casancrem', 'mendicrim', 'tholem', 'cremon',
    // Almacén / Infusiones / Pastas / Granos / Aceites
    'playadito', 'taragui', 'amanda', 'chamigo', 'nobleza gaucha', 'la merced',
    'cruz de malta', 'union', 'cbse', 'rosamonte', 'mananita', 'canuelas', 'natura',
    'cocinero', 'marolio', 'lira', 'pureza', 'blancaflor', 'favorita', 'morixe',
    'lucchetti', 'luchetti', 'matarazzo', 'barilla', 'don vicente', 'knorr', 'maggi',
    'arcor', 'gallo oro', 'gallo', 'molinos ala', 'ala', 'maximo', 'dos hermanos',
    'ledesma', 'chango', 'nescafe', 'dolca', 'arlistan', 'la virginia', 'cabrales',
    'hellmanns', 'danica', 'fanacoa', 'la campagnola', 'salsati', 'maruchan',
    'carrefour', 'coto', 'dia', 'menoyo', 'dos anclas', 'celusal', 'noel',
    // Galletitas / Snacks / Golosinas / Panificados
    'oreo', 'pepitos', 'chocolinas', 'terrabusi', 'sonrisas', 'rumba', 'melba',
    'amor', 'don satur', '9 de oro', 'criollitas', 'express', 'club social', 'traviata',
    'cereal mix', 'lays', 'doritos', 'cheetos', 'guaymallen', 'havanna', 'jorgito',
    'fantoche', 'capitan del espacio', 'bimbo', 'fargo', 'lactal',
    // Higiene y Limpieza
    'dove', 'sedal', 'pantene', 'head & shoulders', 'elvive', 'plusbelle', 'suave',
    'garnier', 'tresemme', 'colgate', 'oral-b', 'sensodyne', 'aquafresh', 'gillette',
    'rexona', 'axe', 'nivea', 'old spice', 'higienol', 'elegante', 'campanita',
    'felpita', 'scott', 'elite', 'sussex', 'ariel', 'skip', 'drive', 'ala jabon',
    'magistral', 'cif', 'ayudin', 'poett', 'procensol', 'mr musculo', 'blem', 'glade',
    'pampers', 'huggies'
];

// Definición general y exhaustiva de categorías con sus términos válidos e incompatibilidades cruzadas
const DEFINICION_CATEGORIAS = {
    leche: {
        terminos: ['leche', 'lactea', 'descremada', 'entera', 'uht', 'polvo'],
        incompatibles: ['alfajor', 'jugo', 'gaseosa', 'arroz', 'fideos', 'aceite', 'yerba', 'shampoo', 'jabon', 'galletita', 'galleta', 'detergente', 'cerveza', 'vino', 'queso crema', 'dulce de leche']
    },
    yogur: {
        terminos: ['yogur', 'yogurt', 'yogurth'],
        incompatibles: ['leche', 'alfajor', 'arroz', 'fideos', 'shampoo', 'jabon']
    },
    queso: {
        terminos: ['queso', 'cremoso', 'mozzarella', 'muzarella', 'sardo', 'reggianito', 'gouda', 'tybo', 'roquefort', 'brie', 'camembert', 'fontina', 'provolone', 'danbo', 'port salut'],
        incompatibles: ['leche', 'arroz', 'fideos', 'galletita', 'yerba']
    },
    manteca: {
        terminos: ['manteca'],
        incompatibles: ['leche', 'margarina', 'aceite', 'arroz']
    },
    dulce_de_leche: {
        terminos: ['dulce de leche'],
        incompatibles: ['alfajor', 'helado']
    },
    arroz: {
        terminos: ['arroz', 'parboil', 'largo fino', 'doble carolina', 'carnaroli', 'yamani'],
        incompatibles: ['fideos', 'tallarin', 'pasta', 'harina', 'galletita', 'galleta', 'polenta', 'leche', 'aceite', 'yerba', 'alfajor', 'shampoo', 'jabon']
    },
    fideos: {
        terminos: ['fideos', 'fideo', 'tallarin', 'tallarines', 'spaghetti', 'tirabuzon', 'tirabuzones', 'mostachol', 'mostacholes', 'guisero', 'pasta', 'penne', 'rigati', 'fusilli', 'codito', 'moñito', 'sopero', 'cabello de angel'],
        incompatibles: ['arroz', 'harina', 'polenta', 'galletita', 'galleta', 'leche', 'aceite', 'yerba', 'alfajor', 'shampoo']
    },
    harina: {
        terminos: ['harina', '000', '0000', 'leudante'],
        incompatibles: ['arroz', 'fideos', 'azucar', 'polenta']
    },
    polenta: {
        terminos: ['polenta', 'harina de maiz'],
        incompatibles: ['arroz', 'fideos']
    },
    aceite: {
        terminos: ['aceite', 'girasol', 'oliva', 'maiz', 'mezcla'],
        incompatibles: ['vinagre', 'aceto', 'mayonesa', 'arroz', 'fideos', 'leche', 'galletita', 'detergente', 'shampoo']
    },
    vinagre: {
        terminos: ['vinagre', 'aceto'],
        incompatibles: ['aceite', 'arroz', 'leche']
    },
    mayonesa: {
        terminos: ['mayonesa'],
        incompatibles: ['mostaza', 'ketchup', 'aceite', 'leche', 'arroz', 'fideos']
    },
    mostaza: {
        terminos: ['mostaza'],
        incompatibles: ['mayonesa', 'ketchup']
    },
    ketchup: {
        terminos: ['ketchup'],
        incompatibles: ['mayonesa', 'mostaza']
    },
    tomate: {
        terminos: ['pure de tomate', 'tomate triturado', 'pulpa de tomate', 'extracto de tomate', 'salsa de tomate', 'salsa'],
        incompatibles: ['fideos', 'arroz', 'leche']
    },
    yerba: {
        terminos: ['yerba', 'yerba mate', 'mate'],
        incompatibles: ['cafe', 'te', 'mate cocido', 'cacao', 'arroz', 'fideos', 'leche', 'galletita', 'alfajor']
    },
    cafe: {
        terminos: ['cafe', 'torrado', 'tostado', 'molido', 'en grano', 'instantaneo', 'capsulas'],
        incompatibles: ['yerba', 'te', 'mate cocido', 'cacao', 'leche', 'arroz', 'fideos']
    },
    te: {
        terminos: ['te negro', 'te verde', 'te en saquitos', 'te rojo', 'manzanilla', 'boldo', 'tilo'],
        incompatibles: ['yerba', 'cafe', 'arroz']
    },
    cacao: {
        terminos: ['cacao', 'chocolatada', 'nesquik', 'toddy'],
        incompatibles: ['yerba', 'cafe', 'te']
    },
    azucar: {
        terminos: ['azucar', 'azucar comun', 'azucar impalpable', 'azucar mascabo', 'azucar rubio'],
        incompatibles: ['edulcorante', 'sal', 'harina', 'arroz', 'fideos', 'leche']
    },
    edulcorante: {
        terminos: ['edulcorante', 'stevia', 'sucralosa', 'sacarina'],
        incompatibles: ['azucar', 'sal']
    },
    sal: {
        terminos: ['sal fina', 'sal gruesa', 'sal marina', 'sal parrillera'],
        incompatibles: ['azucar', 'harina']
    },
    galletitas: {
        terminos: ['galletitas', 'galletas', 'biscotti', 'crackers', 'dulces', 'rellenas', 'obleas', 'bizcochos', 'tostadas'],
        incompatibles: ['arroz', 'fideos', 'harina', 'leche', 'aceite', 'yerba', 'shampoo', 'jabon']
    },
    alfajor: {
        terminos: ['alfajor', 'alfajores', 'bocadito', 'conito'],
        incompatibles: ['leche', 'arroz', 'fideos', 'galletita', 'aceite', 'yerba', 'gaseosa', 'jugo', 'shampoo']
    },
    gaseosa: {
        terminos: ['gaseosa', 'cola', 'soda', 'bebida con gas', 'refresco'],
        incompatibles: ['jugo', 'agua', 'cerveza', 'vino', 'shampoo', 'jabon', 'detergente', 'arroz', 'fideos', 'aceite', 'leche', 'alfajor']
    },
    jugo: {
        terminos: ['jugo', 'jugos', 'multifruta', 'citrico', 'nectar', 'bicitrico', 'cepita', 'tang', 'clight'],
        incompatibles: ['leche', 'gaseosa', 'cerveza', 'arroz', 'fideos', 'aceite', 'shampoo', 'alfajor']
    },
    agua: {
        terminos: ['agua mineral', 'agua de mesa', 'agua sin gas', 'agua con gas', 'agua saborizada', 'saborizada'],
        incompatibles: ['gaseosa cola', 'cerveza', 'vino', 'aceite', 'leche', 'detergente', 'arroz', 'fideos']
    },
    cerveza: {
        terminos: ['cerveza', 'rubia', 'negra', 'ipa', 'apa', 'stout', 'lager', 'pilsen'],
        incompatibles: ['gaseosa', 'vino', 'jugo', 'agua', 'leche', 'aceite', 'arroz', 'fideos']
    },
    vino: {
        terminos: ['vino', 'malbec', 'cabernet', 'syrah', 'merlot', 'chardonnay', 'sauvignon', 'tinto', 'blanco', 'rosado'],
        incompatibles: ['cerveza', 'gaseosa', 'jugo', 'agua', 'aceite', 'arroz', 'fideos']
    },
    atun: {
        terminos: ['atun', 'lomitos de atun', 'desmenuzado', 'al agua', 'al aceite'],
        incompatibles: ['caballa', 'sardinas', 'arvejas', 'choclo', 'lentejas', 'fideos', 'arroz', 'leche']
    },
    conservas_vegetales: {
        terminos: ['arvejas', 'choclo', 'lentejas', 'porotos', 'garbanzos'],
        incompatibles: ['atun', 'fideos', 'arroz', 'leche']
    },
    detergente: {
        terminos: ['detergente', 'lavavajillas', 'detergente para platos'],
        incompatibles: ['jabon en pan', 'jabon de tocador', 'shampoo', 'lavandina', 'limpiador de pisos', 'suavizante', 'aceite', 'leche', 'arroz']
    },
    lavandina: {
        terminos: ['lavandina', 'cloro'],
        incompatibles: ['detergente', 'suavizante', 'shampoo', 'jabon']
    },
    suavizante: {
        terminos: ['suavizante', 'suavizante para ropa'],
        incompatibles: ['detergente', 'lavandina', 'jabon']
    },
    jabon_ropa: {
        terminos: ['jabon liquido para ropa', 'jabon en polvo', 'baja espuma', 'para lavarropas'],
        incompatibles: ['jabon de tocador', 'shampoo', 'detergente para platos']
    },
    jabon_tocador: {
        terminos: ['jabon de tocador', 'jabon en barra', 'jabon corporal'],
        incompatibles: ['jabon en polvo', 'detergente', 'shampoo', 'lavandina']
    },
    shampoo: {
        terminos: ['shampoo', 'champu', 'acondicionador', 'enjuague', 'crema de enjuague', 'balsamo capilar'],
        incompatibles: ['jabon de tocador', 'detergente', 'lavandina', 'leche', 'gaseosa', 'jugo', 'aceite', 'arroz']
    },
    desodorante: {
        terminos: ['desodorante', 'antitranspirante', 'bodyspray', 'roll on', 'aerosol'],
        incompatibles: ['shampoo', 'jabon', 'detergente']
    },
    dentifrico: {
        terminos: ['dentifrico', 'crema dental', 'pasta dental', 'anticaries'],
        incompatibles: ['shampoo', 'jabon', 'detergente']
    },
    papel_higienico: {
        terminos: ['papel higienico', 'hoja simple', 'doble hoja'],
        incompatibles: ['rollo de cocina', 'servilletas']
    },
    rollo_cocina: {
        terminos: ['rollo de cocina', 'toalla de papel', 'servilletas de papel'],
        incompatibles: ['papel higienico']
    },
    pan: {
        terminos: ['pan lactal', 'pan de molde', 'pan para panchos', 'pan para hamburguesas', 'pan rallado', 'rebozador'],
        incompatibles: ['galletitas', 'fideos', 'arroz', 'leche']
    }
};

// Generar compatibilidad de CATEGORIAS_PRODUCTO
const CATEGORIAS_PRODUCTO = {};
for (const key in DEFINICION_CATEGORIAS) {
    CATEGORIAS_PRODUCTO[key] = DEFINICION_CATEGORIAS[key].terminos;
}

// Stop words que no representan marcas ni productos
const STOP_WORDS = new Set([
    'de', 'del', 'en', 'para', 'con', 'sin', 'el', 'la', 'los', 'las', 'un', 'una',
    'unos', 'unas', 'tipo', 'x', 'al', 'por', 'y', 'o', 'gr', 'grs', 'g', 'kg',
    'kgs', 'kilo', 'kilos', 'l', 'lt', 'lts', 'litro', 'litros', 'ml', 'mls', 'cc',
    'u', 'unidades', 'comun', 'clasico', 'clasica', 'original'
]);

// Sabores y variantes descriptivas comunes
const SABORES_Y_VARIANTES = new Set([
    'pomelo', 'naranja', 'limon', 'cola', 'manzana', 'pera', 'uva', 'frutilla',
    'durazno', 'anana', 'multifruta', 'citrico', 'lima', 'vainilla', 'chocolate',
    'dulce', 'salado', 'amargo', 'suave', 'intenso', 'fuerte', 'extra', 'parboil',
    'largo', 'fino', 'entera', 'descremada', 'parcialmente', 'deslactosada',
    'zero', 'diet', 'light', 'cero'
]);

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

// Detecta la intención de búsqueda: ESPECÍFICA o GENÉRICA de forma general para todas las categorías
function detectarIntencion(queryOriginal) {
    var queryNorm = normalizar(queryOriginal);
    if (!queryNorm) {
        return { tipo: 'GENERICA', marca: null, presentacion: null, categoria: null, palabras: [] };
    }

    var tienePalabraGenerica = PALABRAS_GENERICAS.some(function(pg) {
        return queryNorm.includes(pg);
    });

    var pres = extraerPresentacion(queryOriginal);

    // 1. Identificar categoría
    var catEncontrada = null;
    var defKeys = Object.keys(DEFINICION_CATEGORIAS);
    for (var j = 0; j < defKeys.length; j++) {
        var cKey = defKeys[j];
        var def = DEFINICION_CATEGORIAS[cKey];
        if (def.terminos.some(function(t) { return queryNorm.includes(t); })) {
            catEncontrada = cKey;
            break;
        }
    }

    // 2. Detectar si contiene alguna marca conocida
    var marcaEncontrada = null;
    var marcasOrdenadas = MARCAS_CONOCIDAS.slice().sort(function(a, b) { return b.length - a.length; });
    for (var i = 0; i < marcasOrdenadas.length; i++) {
        var m = marcasOrdenadas[i];
        var regex = new RegExp('(?:^|\\s)' + m.replace('-', '[-\\s]') + '(?:$|\\s)', 'i');
        if (regex.test(queryNorm)) {
            marcaEncontrada = m;
            break;
        }
    }

    var palabras = queryNorm.split(/\s+/);
    var esEspecifica = false;

    // 3. Si no hay marca conocida pero hay palabras que califican (no stop words, no unidades, no categoría, no sabores)
    if (!marcaEncontrada && !tienePalabraGenerica) {
        var palabrasCalificadoras = palabras.filter(function(p) {
            if (STOP_WORDS.has(p)) return false;
            if (SABORES_Y_VARIANTES.has(p)) return false;
            if (PALABRAS_GENERICAS.includes(p)) return false;
            if (pres && pres.raw.toLowerCase().includes(p)) return false;
            if (/^\d+([.,]\d+)?$/.test(p)) return false;
            if (catEncontrada && DEFINICION_CATEGORIAS[catEncontrada]) {
                if (DEFINICION_CATEGORIAS[catEncontrada].terminos.some(function(t) { return t === p || t.includes(p); })) {
                    return false;
                }
            }
            return p.length >= 2;
        });

        if (palabrasCalificadoras.length > 0) {
            marcaEncontrada = palabrasCalificadoras.join(' ');
            esEspecifica = true;
        }
    } else if (marcaEncontrada && !tienePalabraGenerica) {
        esEspecifica = true;
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

// Obtiene la configuración completa de búsqueda para pasarla al browser screencast
function obtenerConfiguracionBusqueda(queryOriginal) {
    var intencion = detectarIntencion(queryOriginal);
    var defCat = intencion.categoria && DEFINICION_CATEGORIAS[intencion.categoria] ? DEFINICION_CATEGORIAS[intencion.categoria] : null;
    
    var terminosValidos = defCat ? defCat.terminos : [];
    var terminosIncompatibles = defCat ? defCat.incompatibles : [];
    
    var palabrasRequeridas = [];
    if (intencion.marca) {
        palabrasRequeridas = normalizar(intencion.marca).split(/\s+/).filter(function(w) {
            return w.length >= 2 && !STOP_WORDS.has(w);
        });
    }

    var variantesRequeridas = [];
    var qNorm = intencion.queryNormalizada;
    SABORES_Y_VARIANTES.forEach(function(v) {
        if (qNorm.includes(v)) {
            variantesRequeridas.push(v);
        }
    });

    return {
        queryOriginal: queryOriginal,
        queryNormalizada: qNorm,
        tipo: intencion.tipo,
        categoria: intencion.categoria,
        terminosValidos: terminosValidos,
        terminosIncompatibles: terminosIncompatibles,
        marca: intencion.marca,
        palabrasRequeridas: palabrasRequeridas,
        variantesRequeridas: variantesRequeridas,
        presentacion: intencion.presentacion
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

    // 3. Validación de CATEGORÍA E INCOMPATIBILIDADES (Aplica a TODAS las categorías)
    if (intencion.categoria && DEFINICION_CATEGORIAS[intencion.categoria]) {
        var defCat = DEFINICION_CATEGORIAS[intencion.categoria];

        // Función auxiliar para coincidencia exacta de palabra en términos cortos (evita falsos positivos como 'te' dentro de 'mate')
        function contienePalabra(texto, palabra) {
            if (!texto || !palabra) return false;
            if (palabra.length <= 4) {
                var rx = new RegExp('(?:^|\\s)' + palabra.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:$|\\s)', 'i');
                return rx.test(texto);
            }
            return texto.includes(palabra);
        }

        // A) Rechazo estricto si contiene términos incompatibles
        if (defCat.incompatibles) {
            for (var k = 0; k < defCat.incompatibles.length; k++) {
                var inc = defCat.incompatibles[k];
                if (contienePalabra(nombreNorm, inc)) {
                    return {
                        estado: 'COINCIDENCIA NO VÁLIDA',
                        valido: false,
                        motivo: 'El producto devuelto (' + nombreEncontrado + ') contiene "' + inc.toUpperCase() + '", incompatible con la categoría requerida (' + intencion.categoria.toUpperCase() + ').',
                        intencion: intencion.tipo,
                        marca: intencion.marca
                    };
                }
            }
        }

        // B) Debe contener al menos un término válido de la categoría
        if (defCat.terminos) {
            var coincideCategoria = defCat.terminos.some(function(t) {
                return contienePalabra(nombreNorm, t);
            });
            if (!coincideCategoria) {
                return {
                    estado: 'COINCIDENCIA NO VÁLIDA',
                    valido: false,
                    motivo: 'El producto devuelto (' + nombreEncontrado + ') no pertenece a la categoría ' + intencion.categoria.toUpperCase() + '.',
                    intencion: intencion.tipo,
                    marca: intencion.marca
                };
            }
        }
    }

    // 4. Validación de BÚSQUEDA GENÉRICA
    if (intencion.tipo === 'GENERICA') {
        // Verificar si se buscó un sabor o variante descriptiva específica
        var saboresArray = Array.from(SABORES_Y_VARIANTES);
        for (var s = 0; s < saboresArray.length; s++) {
            var sab = saboresArray[s];
            if (intencion.queryNormalizada.includes(sab) && !nombreNorm.includes(sab)) {
                return {
                    estado: 'COINCIDENCIA NO VÁLIDA',
                    valido: false,
                    motivo: 'Se solicitó variante/sabor "' + sab + '" pero el producto devuelto (' + nombreEncontrado + ') no lo incluye.',
                    intencion: intencion.tipo,
                    marca: null
                };
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

    // 5. Validación de BÚSQUEDA ESPECÍFICA (MARCA Y CALIFICADORES)
    if (intencion.marca) {
        var marcaBuscada = intencion.marca;
        var palabrasMarca = marcaBuscada.split(/\s+/).filter(function(w) {
            return !STOP_WORDS.has(w);
        });
        var coincideMarca = palabrasMarca.every(function(m) {
            var regexM = new RegExp('(?:^|\\s)' + m.replace('-', '[-\\s]') + '(?:$|\\s)', 'i');
            return regexM.test(nombreNorm) || nombreNorm.includes(m);
        });
        if (!coincideMarca) {
            return {
                estado: 'COINCIDENCIA NO VÁLIDA',
                valido: false,
                motivo: 'Marca requerida "' + marcaBuscada.toUpperCase() + '" no coincide con el producto devuelto ("' + nombreEncontrado + '").',
                intencion: intencion.tipo,
                marca: intencion.marca
            };
        }
    }

    // Validación de Sabor o Variante específica en búsqueda específica
    var variantesArray = Array.from(SABORES_Y_VARIANTES);
    for (var v = 0; v < variantesArray.length; v++) {
        var varItem = variantesArray[v];
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

    // Validación de Presentación / Tamaño si se especificó
    if (intencion.presentacion) {
        var presEncontrada = extraerPresentacion(nombreEncontrado);
        if (presEncontrada && presEncontrada.tipo === intencion.presentacion.tipo) {
            var ratio = presEncontrada.valor / intencion.presentacion.valor;
            if (ratio > 2.5 || ratio < 0.4) {
                return {
                    estado: 'COINCIDENCIA NO VÁLIDA',
                    valido: false,
                    motivo: 'Presentación incompatible: solicitada ' + intencion.presentacion.raw + ' vs encontrada ' + presEncontrada.raw + '.',
                    intencion: intencion.tipo,
                    marca: intencion.marca
                };
            } else if (ratio > 1.3 || ratio < 0.75) {
                return {
                    estado: 'VALIDADA',
                    valido: true,
                    motivo: 'Presentación alternativa más cercana: ' + presEncontrada.raw + ' (solicitada: ' + intencion.presentacion.raw + ').',
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
            // Formato nuevo de 8 a 10 columnas:
            // modo, producto_solicitado, nombre_encontrado, precio, supermercado, url, fecha, stock_status, cantidad, unidad
            items.push({
                modo: cols[0] || 'compra_mes',
                producto: cols[1] || 'producto',
                nombre: cols[2] || 'N/D',
                precioStr: cols[3] || 'N/D',
                precio: parsePrecio(cols[3]),
                supermercado: cols[4] || 'N/D',
                url: cols[5] || '',
                fecha: cols[6] || '',
                stockRaw: cols[7] || 'DISPONIBLE',
                cantidad: cols[8] ? (parseInt(cols[8], 10) || 1) : 1,
                unidad: cols[9] || ''
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

        // Test 8: Incompatibilidad 2.25L vs 500ml (ratio fuera de tolerancia)
        var r8 = validarCoincidencia('Coca Cola 2.25L', { nombre: 'Coca Cola 500ml', precio: 800 });
        assertEq('Incompatibilidad 2.25L vs 500ml', r8.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 9: Presentación alternativa más cercana (1kg vs 500g, ratio dentro de tolerancia 0.4-2.5)
        var r9 = validarCoincidencia('Arroz Ala 1kg', { nombre: 'Arroz Ala 500g', precio: 800 });
        assertEq('Presentación alternativa más cercana 1kg vs 500g', r9.estado, 'VALIDADA');

        // Test 10: Producto sin stock
        var r10 = validarCoincidencia('leche', { nombre: 'Leche Serenisima 1L', precioStr: 'Sin stock', stockRaw: 'SIN STOCK' });
        assertEq('Detección de Sin Stock', r10.estado, 'SIN STOCK');

        // Test 11: Generalización - Rechazo de alfajor o jugo cuando se busca leche
        var r11 = validarCoincidencia('leche baggio', { nombre: 'Alfajor Havanna Chocolate', precio: 1500 });
        assertEq('Generalización: Rechazo de Alfajor para Leche', r11.estado, 'COINCIDENCIA NO VÁLIDA');

        var r11b = validarCoincidencia('leche baggio', { nombre: 'Jugo Baggio Naranja 1L', precio: 1200 });
        assertEq('Generalización: Rechazo de Jugo para Leche', r11b.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 12: Generalización - Rechazo de fideos cuando se busca arroz
        var r12 = validarCoincidencia('arroz gallo', { nombre: 'Fideos Tallarín Matarazzo 500g', precio: 1400 });
        assertEq('Generalización: Rechazo de Fideos para Arroz', r12.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 13: Generalización - Rechazo de otra marca cuando se pide marca específica
        var r13 = validarCoincidencia('arroz gallo', { nombre: 'Arroz Molinos Ala Largo Fino 1kg', precio: 1900 });
        assertEq('Generalización: Rechazo de marca distinta para Arroz Gallo', r13.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 14: Generalización - Rechazo de vinagre para aceite
        var r14 = validarCoincidencia('aceite natura', { nombre: 'Vinagre de Alcohol Menoyo 1L', precio: 1100 });
        assertEq('Generalización: Rechazo de Vinagre para Aceite', r14.estado, 'COINCIDENCIA NO VÁLIDA');

        // Test 15: Generalización - Aceptación correcta de marca y categoría en cualquier producto
        var r15 = validarCoincidencia('fideos matarazzo', { nombre: 'Fideos Tirabuzón Matarazzo 500g', precio: 1800 });
        assertEq('Generalización: Aceptación Fideos Matarazzo', r15.estado, 'VALIDADA');

        var r16 = validarCoincidencia('detergente magistral', { nombre: 'Detergente Magistral Limón 500ml', precio: 2200 });
        assertEq('Generalización: Aceptación Detergente Magistral', r16.estado, 'VALIDADA');

        var r17 = validarCoincidencia('yerba playadito', { nombre: 'Yerba Mate Playadito 1kg', precio: 4500 });
        assertEq('Generalización: Aceptación Yerba Playadito', r17.estado, 'VALIDADA');

        console.log('----------------------------------------------------------------------');
        if (errores === 0) {
            console.log(' 🎉 DIAGNÓSTICO FINAL: TODAS LAS PRUEBAS DEL VALIDADOR PASARON CON ÉXITO\n');
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
    obtenerConfiguracionBusqueda: obtenerConfiguracionBusqueda,
    validarCoincidencia: validarCoincidencia,
    parsePrecio: parsePrecio,
    formatoMoneda: formatoMoneda,
    leerResultadosCSV: leerResultadosCSV,
    mostrarReporteIndividual: mostrarReporteIndividual,
    limpiarResultados: limpiarResultados,
    crearTempInput: crearTempInput,
    MARCAS_CONOCIDAS: MARCAS_CONOCIDAS,
    DEFINICION_CATEGORIAS: DEFINICION_CATEGORIAS,
    CATEGORIAS_PRODUCTO: CATEGORIAS_PRODUCTO
};

