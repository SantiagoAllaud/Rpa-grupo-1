document.addEventListener('DOMContentLoaded', () => {
    const btnCompraMes = document.getElementById('btn-compra-mes');
    const logContainer = document.getElementById('log-container');
    const statusIndicator = document.getElementById('status-indicator');
    const btnAbort = document.getElementById('btn-abort');

    // Elementos del Banner de Progreso Activo y Estado de Búsqueda
    const activeProcessBanner = document.getElementById('active-process-banner');
    const processBannerText = document.getElementById('process-banner-text');
    const mainProgressFill = document.getElementById('main-progress-fill');
    const progressPercentBadge = document.getElementById('progress-percent-badge');
    const estadoBusqueda = document.getElementById('estado-busqueda');
    const textoEstadoBusqueda = document.getElementById('texto-estado-busqueda');

    let ws = null;

    function resetSuperSteps() {
        if (mainProgressFill) mainProgressFill.style.width = '0%';
        if (progressPercentBadge) progressPercentBadge.textContent = '0%';
        if (processBannerText) processBannerText.textContent = 'Iniciando proceso RPA visible...';
        if (textoEstadoBusqueda) textoEstadoBusqueda.textContent = 'Buscando producto en los 3 supermercados...';
    }

    // Conectar WebSocket para logs y telemetría en vivo del sistema
    function connectStream() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/rpa-stream`;
        
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("[WebSocket] Conectado con el servidor.");
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                if (msg.type === 'log') {
                    addLog(msg.message);
                    if (processBannerText) processBannerText.textContent = msg.message;
                    if (textoEstadoBusqueda) textoEstadoBusqueda.textContent = msg.message;
                } else if (msg.type === 'progress') {
                    if (typeof msg.percent === 'number') {
                        if (mainProgressFill) mainProgressFill.style.width = `${msg.percent}%`;
                        if (progressPercentBadge) progressPercentBadge.textContent = `${msg.percent}%`;
                    }
                    if (msg.message) {
                        addLog(msg.message);
                        if (processBannerText) processBannerText.textContent = msg.message;
                        if (textoEstadoBusqueda) textoEstadoBusqueda.textContent = msg.message;
                    }
                } else if (msg.type === 'status') {
                    if (msg.state === 'live' || msg.state === 'connecting') {
                        setRunningState(true);
                        if (msg.message) {
                            if (processBannerText) processBannerText.textContent = msg.message;
                            if (textoEstadoBusqueda) textoEstadoBusqueda.textContent = msg.message;
                        }
                    } else if (msg.state === 'finished') {
                        if (mainProgressFill) mainProgressFill.style.width = '100%';
                        if (progressPercentBadge) progressPercentBadge.textContent = '100%';
                        if (processBannerText) processBannerText.textContent = '✓ Proceso finalizado exitosamente';
                        setTimeout(() => {
                            setRunningState(false);
                            cargarResultadosRecientes();
                        }, 1200);
                    } else if (msg.state === 'idle') {
                        setRunningState(false);
                    } else if (msg.state === 'aborted' || msg.state === 'error') {
                        setRunningState(false);
                        if (msg.message) addLog(`[AVISO] ${msg.message}`, true);
                    }
                }
            } catch (e) {
                console.error("[WebSocket] Error parseando mensaje:", e);
            }
        };

        ws.onclose = () => {
            setTimeout(connectStream, 3000);
        };
    }

    connectStream();

    // Añadir mensajes a la consola (con salvaguarda segura si no existe logContainer)
    function addLog(msg, isError = false) {
        if (isError) {
            console.error(`[RPA] ${msg}`);
        } else {
            console.log(`[RPA] ${msg}`);
        }

        if (logContainer) {
            const p = document.createElement('p');
            p.textContent = `> ${msg}`;
            if (isError) p.classList.add('log-error');
            logContainer.appendChild(p);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }

    // Cambiar estado visual de la interfaz según si el RPA está corriendo
    function setRunningState(isRunning) {
        const btns = document.querySelectorAll('button:not(#btn-abort):not(#btn-cerrar-x-modal):not(#btn-cerrar-editar-modal)');
        btns.forEach(btn => btn.disabled = isRunning);
        
        if (isRunning) {
            if (statusIndicator) {
                statusIndicator.textContent = "Buscando en vivo...";
                statusIndicator.className = "indicator running";
            }
            if (activeProcessBanner) activeProcessBanner.style.display = 'block';
            if (estadoBusqueda) estadoBusqueda.style.display = 'flex';
            if (btnAbort) btnAbort.disabled = false;
        } else {
            if (statusIndicator) {
                statusIndicator.textContent = "Listo";
                statusIndicator.className = "indicator idle";
            }
            if (activeProcessBanner) activeProcessBanner.style.display = 'none';
            if (estadoBusqueda) estadoBusqueda.style.display = 'none';
            if (btnAbort) btnAbort.disabled = true;
        }
    }

    // Ejecutar llamada a la API
    async function executeAction(endpoint, body = null) {
        resetSuperSteps();
        setRunningState(true);
        addLog(`Iniciando acción: ${endpoint}...`);

        // NOTA: demoMode: true y headless: false aseguran que Chrome abra visiblemente en el escritorio
        const payload = Object.assign({}, body || {}, {
            demoMode: true,
            typingDelay: 20,
            mouseDuration: 250
        });
        
        try {
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            };
            
            const response = await fetch(endpoint, options);
            const data = await response.json();
            
            if (data.success) {
                addLog(`✓ ${data.message}`);
                await cargarResultadosRecientes();
            } else {
                addLog(`Error: ${data.message}`, true);
                alert(data.message || 'Error en la ejecución del RPA');
            }
        } catch (error) {
            addLog(`Error de conexión: ${error.message}`, true);
            alert(`Error de conexión con el servidor: ${error.message}`);
        } finally {
            setRunningState(false);
        }
    }

    // ==========================================================================
    // GESTIÓN DEL CATÁLOGO CERRADO EN EL FRONTEND (INMUTABLE)
    // ==========================================================================
    let catalogoGlobal = null;
    let itemsCatalogoGlobal = [];
    const selectCategoria = document.getElementById('select-categoria');
    const selectProducto = document.getElementById('select-producto');
    const inputUnidadesCompra = document.getElementById('input-unidades-compra');
    const boxInfoProducto = document.getElementById('box-info-producto');
    const infoMarca = document.getElementById('info-marca');
    const infoVariante = document.getElementById('info-variante');
    const infoPresentacion = document.getElementById('info-presentacion');
    const btnUsarProductoCatalogo = document.getElementById('btn-usar-producto-catalogo');

    async function cargarCatalogoUI() {
        try {
            const resp = await fetch('/api/catalogo');
            const data = await resp.json();
            if (data.success && data.catalogo) {
                catalogoGlobal = data.catalogo;
                itemsCatalogoGlobal = data.items || [];
                poblarSelectCategorias();
            }
        } catch (e) {
            console.error('Error cargando catálogo:', e);
        }
    }

    function poblarSelectCategorias() {
        if (!selectCategoria || !catalogoGlobal) return;
        selectCategoria.innerHTML = '<option value="">-- Selecciona una categoría --</option>';
        const categorias = Object.keys(catalogoGlobal);
        categorias.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            selectCategoria.appendChild(opt);
        });
        if (categorias.length > 0) {
            selectCategoria.value = categorias[0];
            poblarSelectProductos(categorias[0]);
        }
    }

    function poblarSelectProductos(categoria) {
        if (!selectProducto || !catalogoGlobal) return;
        selectProducto.innerHTML = '<option value="">-- Selecciona un producto --</option>';
        if (!categoria || !catalogoGlobal[categoria]) {
            if (boxInfoProducto) boxInfoProducto.style.display = 'none';
            return;
        }

        const prods = catalogoGlobal[categoria];
        prods.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.nombre_completo}`;
            selectProducto.appendChild(opt);
        });

        if (prods.length > 0) {
            selectProducto.value = prods[0].id;
            mostrarInfoProducto(prods[0]);
            const inputBusquedaRapida = document.getElementById('input-busqueda-rapida');
            if (inputBusquedaRapida && !inputBusquedaRapida.value) {
                inputBusquedaRapida.value = prods[0].nombre_completo;
            }
        }
    }

    function mostrarInfoProducto(item) {
        if (!boxInfoProducto) return;
        if (!item) {
            boxInfoProducto.style.display = 'none';
            return;
        }
        boxInfoProducto.style.display = 'block';
        if (infoMarca) infoMarca.textContent = item.marca;
        if (infoVariante) infoVariante.textContent = item.variante || 'N/A';
        if (infoPresentacion) infoPresentacion.textContent = `${item.cantidad} ${item.unidad}`;
    }

    if (selectCategoria) {
        selectCategoria.addEventListener('change', (e) => {
            poblarSelectProductos(e.target.value);
        });
    }

    if (selectProducto) {
        selectProducto.addEventListener('change', (e) => {
            const item = itemsCatalogoGlobal.find(it => it.id === e.target.value);
            mostrarInfoProducto(item);
            const inputBusquedaRapida = document.getElementById('input-busqueda-rapida');
            if (item && inputBusquedaRapida) {
                inputBusquedaRapida.value = item.nombre_completo;
            }
        });
    }

    // Botón para usar producto seleccionado del catálogo en la búsqueda rápida
    if (btnUsarProductoCatalogo) {
        btnUsarProductoCatalogo.addEventListener('click', () => {
            const prodId = selectProducto ? selectProducto.value : '';
            const item = itemsCatalogoGlobal.find(it => it.id === prodId);
            const inputBusquedaRapida = document.getElementById('input-busqueda-rapida');
            if (item && inputBusquedaRapida) {
                inputBusquedaRapida.value = item.nombre_completo;
                const seccionBusqueda = document.getElementById('seccion-busqueda');
                if (seccionBusqueda) {
                    seccionBusqueda.scrollIntoView({ behavior: 'smooth' });
                }
                inputBusquedaRapida.focus();
                addLog(`Producto del catálogo seleccionado: ${item.nombre_completo}`);
            }
        });
    }

    // Iniciar carga del catálogo
    cargarCatalogoUI();

    // ==========================================================================
    // TABLAS COMPARATIVAS Y CÁLCULO DE GANADOR
    // ==========================================================================
    const tbodyBusquedaRapida = document.getElementById('tbody-busqueda-rapida');
    const tbodyCompraMes = document.getElementById('tbody-compra-mes');

    function formatearPrecio(valor) {
        if (valor === null || valor === undefined || isNaN(valor) || valor <= 0) {
            return '<span class="precio-no-disponible">No encontrado</span>';
        }
        return `$${Number(valor).toLocaleString('es-AR')}`;
    }

    function renderTablaComparativa(tbody, listaProductos, esCanastaMes = false) {
        if (!tbody) return;
        if (!listaProductos || listaProductos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
                        No hay registros disponibles aún.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        listaProductos.forEach(item => {
            const tr = document.createElement('tr');
            
            // Determinar precios numéricos válidos
            const pCoto = typeof item.coto === 'number' && item.coto > 0 ? item.coto : null;
            const pCarrefour = typeof item.carrefour === 'number' && item.carrefour > 0 ? item.carrefour : null;
            const pDia = typeof item.dia === 'number' && item.dia > 0 ? item.dia : null;

            // Determinar menor precio
            const validos = [];
            if (pCoto !== null) validos.push({ super: 'Coto', precio: pCoto });
            if (pCarrefour !== null) validos.push({ super: 'Carrefour', precio: pCarrefour });
            if (pDia !== null) validos.push({ super: 'Día', precio: pDia });

            let superGanador = null;
            let badgeGanadorHtml = '';

            if (validos.length > 0) {
                validos.sort((a, b) => a.precio - b.precio);
                const ganador = validos[0];
                superGanador = ganador.super;
                badgeGanadorHtml = `<span class="badge-ganador"><i class="fa-solid fa-trophy"></i> ${ganador.super}</span>`;
            } else {
                badgeGanadorHtml = '<span class="badge-no-ganador">No se pudo determinar un ganador</span>';
            }

            // Clases para celdas ganadoras
            const cotoClass = superGanador === 'Coto' ? 'super-winner' : '';
            const carrefourClass = superGanador === 'Carrefour' ? 'super-winner' : '';
            const diaClass = superGanador === 'Día' ? 'super-winner' : '';

            tr.innerHTML = `
                <td style="font-weight: 600;">${escapeHtml(item.producto)}</td>
                <td class="${cotoClass}" style="text-align: right;">${formatearPrecio(pCoto)}</td>
                <td class="${carrefourClass}" style="text-align: right;">${formatearPrecio(pCarrefour)}</td>
                <td class="${diaClass}" style="text-align: right;">${formatearPrecio(pDia)}</td>
                <td style="text-align: center;">${badgeGanadorHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function cargarResultadosRecientes() {
        try {
            const res = await fetch('/api/resultados-recientes');
            const data = await res.json();
            if (data.success) {
                if (tbodyBusquedaRapida && data.individuales) {
                    renderTablaComparativa(tbodyBusquedaRapida, data.individuales, false);
                }
                if (tbodyCompraMes && data.canastaMes) {
                    renderTablaComparativa(tbodyCompraMes, data.canastaMes, true);
                }
            }
        } catch (e) {
            console.error("Error al cargar resultados recientes:", e);
        }
    }

    // Cargar datos existentes al inicio
    cargarResultadosRecientes();

    // ==========================================================================
    // NAVEGACIÓN ENTRE SECCIONES (PILLS)
    // ==========================================================================
    const navPills = document.querySelectorAll('.nav-pill');
    navPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            navPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const targetId = pill.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                const targetSec = document.querySelector(targetId);
                if (targetSec) {
                    targetSec.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    // ==========================================================================
    // BÚSQUEDA RÁPIDA (BARRA ÚNICA)
    // ==========================================================================
    const inputBusquedaRapida = document.getElementById('input-busqueda-rapida');
    const btnBuscarRapido = document.getElementById('btn-buscar-rapido');

    function ejecutarBusquedaRapida() {
        const query = inputBusquedaRapida ? inputBusquedaRapida.value.trim() : '';
        if (!query) {
            alert("Por favor ingresa o selecciona un producto a buscar (ej: Yerba Playadito, Arroz Gallo, Leche La Serenísima).");
            if (inputBusquedaRapida) inputBusquedaRapida.focus();
            return;
        }

        const prodId = selectProducto ? selectProducto.value : '';
        const itemCat = itemsCatalogoGlobal.find(it => it.id === prodId || it.nombre_completo.toLowerCase() === query.toLowerCase());

        const body = {
            producto: query
        };

        if (itemCat) {
            body.terminoBusqueda = itemCat.termino_busqueda || itemCat.producto;
            body.cantidad = itemCat.cantidad;
            body.unidad = itemCat.unidad;
        }

        executeAction('/api/buscar-individual', body);
    }

    if (btnBuscarRapido) {
        btnBuscarRapido.addEventListener('click', ejecutarBusquedaRapida);
    }

    if (inputBusquedaRapida) {
        inputBusquedaRapida.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                ejecutarBusquedaRapida();
            }
        });
    }

    // ==========================================================================
    // COMPRA DEL MES
    // ==========================================================================
    if (btnCompraMes) {
        btnCompraMes.addEventListener('click', () => {
            executeAction('/api/compra-mes');
        });
    }

    // Manejo del Modal de Edición de Lista Interactiva
    const btnEditarLista = document.getElementById('btn-editar-lista');
    const editarModal = document.getElementById('editar-lista-modal');
    const btnCerrarEditarModal = document.getElementById('btn-cerrar-editar-modal');
    const btnCerrarXModal = document.getElementById('btn-cerrar-x-modal');
    const btnGuardarLista = document.getElementById('btn-guardar-lista');
    const btnAgregarFilaModal = document.getElementById('btn-agregar-fila-modal');
    const modalTbodyCanasta = document.getElementById('modal-tbody-canasta');

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function crearFilaCanasta(prodItem = null, unidades = 1) {
        const tr = document.createElement('tr');
        
        let selectOptions = '<option value="">-- Selecciona producto del catálogo --</option>';
        itemsCatalogoGlobal.forEach(it => {
            const selected = (prodItem && (it.id === prodItem.id || it.producto.toLowerCase() === prodItem.producto.toLowerCase())) ? 'selected' : '';
            selectOptions += `<option value="${it.id}" ${selected}>${escapeHtml(it.nombre_completo)}</option>`;
        });

        tr.innerHTML = `
            <td>
                <select class="modal-input modal-select-prod">
                    ${selectOptions}
                </select>
            </td>
            <td>
                <span class="modal-pres-label" style="color: #34d399; font-weight: 600; font-size: 0.88rem;">-</span>
            </td>
            <td>
                <input type="number" class="modal-input modal-input-unid-compra" min="1" step="1" value="${unidades > 0 ? unidades : 1}" />
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn-del-row" title="Eliminar este producto"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;

        const sel = tr.querySelector('.modal-select-prod');
        const presLabel = tr.querySelector('.modal-pres-label');

        function actualizarPres() {
            const found = itemsCatalogoGlobal.find(it => it.id === sel.value);
            if (found) {
                presLabel.textContent = `${found.cantidad} ${found.unidad}`;
            } else {
                presLabel.textContent = '-';
            }
        }

        sel.addEventListener('change', actualizarPres);
        actualizarPres();

        tr.querySelector('.btn-del-row').addEventListener('click', () => {
            tr.remove();
        });
        return tr;
    }

    if (btnEditarLista && editarModal) {
        btnEditarLista.addEventListener('click', async () => {
            editarModal.classList.add('active');
            if (modalTbodyCanasta) {
                modalTbodyCanasta.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1.5rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando lista...</td></tr>';
            }
            try {
                const response = await fetch('/api/input');
                const data = await response.json();
                if (modalTbodyCanasta) modalTbodyCanasta.innerHTML = '';
                if (data.success && data.data) {
                    const lines = data.data.split('\n');
                    let count = 0;
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line) {
                            const parts = line.split(',');
                            const prodText = parts[0] ? parts[0].trim() : '';
                            const cant = parts[1] ? (parseFloat(parts[1].trim()) || 1) : 1;
                            const unid = parts[2] ? parts[2].trim() : '';
                            const unidades = parts[3] ? (parseInt(parts[3].trim(), 10) || 1) : 1;

                            const matched = itemsCatalogoGlobal.find(it => 
                                it.producto.toLowerCase() === prodText.toLowerCase() ||
                                it.nombre_completo.toLowerCase().includes(prodText.toLowerCase()) ||
                                it.marca.toLowerCase() === prodText.toLowerCase()
                            );

                            if (prodText) {
                                modalTbodyCanasta.appendChild(crearFilaCanasta(matched || { id: '', producto: prodText, cantidad: cant, unidad: unid }, unidades));
                                count++;
                            }
                        }
                    }
                    if (count === 0) {
                        modalTbodyCanasta.appendChild(crearFilaCanasta(null, 1));
                    }
                } else if (modalTbodyCanasta) {
                    modalTbodyCanasta.appendChild(crearFilaCanasta(null, 1));
                }
            } catch (e) {
                if (modalTbodyCanasta) {
                    modalTbodyCanasta.innerHTML = '';
                    modalTbodyCanasta.appendChild(crearFilaCanasta(null, 1));
                }
            }
        });
    }

    if (btnAgregarFilaModal) {
        btnAgregarFilaModal.addEventListener('click', () => {
            if (modalTbodyCanasta) {
                const tr = crearFilaCanasta(null, 1);
                modalTbodyCanasta.appendChild(tr);
            }
        });
    }

    if (btnCerrarEditarModal && editarModal) {
        btnCerrarEditarModal.addEventListener('click', () => {
            editarModal.classList.remove('active');
        });
    }

    if (btnCerrarXModal && editarModal) {
        btnCerrarXModal.addEventListener('click', () => {
            editarModal.classList.remove('active');
        });
    }

    if (btnGuardarLista && editarModal) {
        btnGuardarLista.addEventListener('click', async () => {
            if (!modalTbodyCanasta) return;
            const rows = modalTbodyCanasta.querySelectorAll('tr');
            let contenido = "producto,cantidad,unidad,unidades\n";
            let validCount = 0;

            rows.forEach(r => {
                const selProd = r.querySelector('.modal-select-prod');
                const unidadesInput = r.querySelector('.modal-input-unid-compra');
                if (selProd && selProd.value) {
                    const item = itemsCatalogoGlobal.find(it => it.id === selProd.value);
                    const unidades = parseInt(unidadesInput ? unidadesInput.value : '1', 10) || 1;
                    if (item) {
                        contenido += `${item.producto},${item.cantidad},${item.unidad},${unidades}\n`;
                        validCount++;
                    }
                }
            });

            if (validCount === 0) {
                alert("Debes agregar al menos un producto del catálogo a la lista.");
                return;
            }

            try {
                const response = await fetch('/api/input', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contenido })
                });
                const data = await response.json();
                if (data.success) {
                    editarModal.classList.remove('active');
                    addLog("✓ Lista mensual guardada exitosamente y validada con el catálogo cerrado.");
                } else {
                    alert(`Error al guardar: ${data.message}`);
                }
            } catch (error) {
                alert(`Error al guardar: ${error.message}`);
            }
        });
    }

    // Kill-switch: botón de aborto visible en la interfaz
    if (btnAbort) {
        btnAbort.addEventListener('click', async () => {
            btnAbort.disabled = true;
            addLog('⛔ Solicitando aborto del RPA...');
            try {
                await fetch('/api/abort', { method: 'POST' });
                addLog('✓ RPA detenido por el usuario.');
            } catch (e) {
                addLog('Error al abortar: ' + e.message, true);
            }
            setRunningState(false);
        });
    }

    // Kill-switch: Si el usuario cierra el frontend mientras el RPA está corriendo, abortar inmediatamente
    window.addEventListener('beforeunload', () => {
        if (activeProcessBanner && activeProcessBanner.style.display !== 'none') {
            try {
                navigator.sendBeacon('/api/abort');
            } catch (e) {}
        }
    });
});
