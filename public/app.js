// ==============================================================================
// UTN FRCU - Tecnologías para la Automatización (Año 2026)
// app.js - Lógica Simplificada del Dashboard de Supermercados
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM principales
    const selectProductoRapido = document.getElementById('select-producto-rapido');
    const btnBuscarRapido = document.getElementById('btn-buscar-rapido');
    const busquedaStatusBar = document.getElementById('busqueda-status-bar');
    const busquedaStatusMsg = document.getElementById('busqueda-status-msg');
    const busquedaResultadosWrapper = document.getElementById('busqueda-resultados-wrapper');
    const busquedaWinnerBanner = document.getElementById('busqueda-winner-banner');
    const busquedaTbody = document.getElementById('busqueda-tbody');

    const btnCompraMes = document.getElementById('btn-compra-mes');
    const btnEditarLista = document.getElementById('btn-editar-lista');
    const compraMesStatusBar = document.getElementById('compra-mes-status-bar');
    const compraMesStatusMsg = document.getElementById('compra-mes-status-msg');
    const compraMesResultadosWrapper = document.getElementById('compra-mes-resultados-wrapper');
    const compraMesWinnerBanner = document.getElementById('compra-mes-winner-banner');
    const compraMesTbody = document.getElementById('compra-mes-tbody');
    const compraMesTfoot = document.getElementById('compra-mes-tfoot');

    const btnAbrirExcel = document.getElementById('btn-abrir-excel');
    const statusIndicator = document.getElementById('status-indicator');
    const catalogoBrowserContainer = document.getElementById('catalogo-browser-container');

    // Estado del catálogo en memoria
    let catalogoGlobal = null;
    let itemsCatalogoGlobal = [];
    let isProcessRunning = false;

    // Conexión WebSocket para sincronizar estados transparentemente
    let ws = null;
    function connectStream() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/rpa-stream`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[WebSocket] Conectado.');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'status') {
                    if (statusIndicator) {
                        if (msg.state === 'live') {
                            statusIndicator.textContent = 'Procesando...';
                            statusIndicator.className = 'indicator running';
                        } else if (msg.state === 'idle') {
                            statusIndicator.textContent = 'Listo';
                            statusIndicator.className = 'indicator idle';
                        } else if (msg.state === 'aborted') {
                            statusIndicator.textContent = 'Interrumpido';
                            statusIndicator.className = 'indicator stopped';
                        }
                    }
                } else if (msg.type === 'log') {
                    // Actualizar mensaje amigable según el paso actual
                    const m = msg.message || '';
                    if (m.toLowerCase().includes('carrefour')) {
                        updateActiveStatus('Consultando precios en Carrefour Argentina...');
                    } else if (m.toLowerCase().includes('coto')) {
                        updateActiveStatus('Consultando precios en COTO Digital...');
                    } else if (m.toLowerCase().includes('d\u00eda') || m.toLowerCase().includes('dia')) {
                        updateActiveStatus('Consultando precios en Supermercados D\u00eda %...');
                    }
                }
            } catch (e) {}
        };

        ws.onclose = () => {
            setTimeout(connectStream, 3000);
        };
    }

    function updateActiveStatus(texto) {
        if (busquedaStatusBar && busquedaStatusBar.style.display !== 'none') {
            if (busquedaStatusMsg) busquedaStatusMsg.textContent = texto;
        }
        if (compraMesStatusBar && compraMesStatusBar.style.display !== 'none') {
            if (compraMesStatusMsg) compraMesStatusMsg.textContent = texto;
        }
    }

    connectStream();

    // ==========================================================================
    // 1. CARGA DEL CATÁLOGO CERRADO Y POBLADO DE SELECTORES
    // ==========================================================================
    async function cargarCatalogoUI() {
        try {
            const resp = await fetch('/api/catalogo');
            const data = await resp.json();
            if (data.success && data.catalogo) {
                catalogoGlobal = data.catalogo;
                itemsCatalogoGlobal = data.items || [];
                poblarSelectRapido();
                renderCatalogoBrowser();
            }
        } catch (e) {
            console.error('Error al cargar catálogo:', e);
        }
    }

    function poblarSelectRapido() {
        if (!selectProductoRapido || !catalogoGlobal) return;
        selectProductoRapido.innerHTML = '<option value="">-- Selecciona un producto del catálogo --</option>';

        const categorias = Object.keys(catalogoGlobal);
        categorias.forEach(cat => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = cat.toUpperCase();

            const prods = catalogoGlobal[cat] || [];
            prods.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = `${item.nombre_completo}`;
                optgroup.appendChild(opt);
            });

            selectProductoRapido.appendChild(optgroup);
        });
    }

    function renderCatalogoBrowser() {
        if (!catalogoBrowserContainer || !catalogoGlobal) return;
        catalogoBrowserContainer.innerHTML = '';

        const categorias = Object.keys(catalogoGlobal);
        categorias.forEach(cat => {
            const catCard = document.createElement('div');
            catCard.className = 'catalogo-cat-card';

            const catTitle = document.createElement('h5');
            catTitle.innerHTML = `<i class="fa-solid fa-folder-open"></i> ${cat.toUpperCase()}`;
            catCard.appendChild(catTitle);

            const list = document.createElement('div');
            list.className = 'catalogo-items-list';

            const prods = catalogoGlobal[cat] || [];
            prods.forEach(item => {
                const itemBtn = document.createElement('button');
                itemBtn.type = 'button';
                itemBtn.className = 'catalogo-item-chip';
                itemBtn.innerHTML = `<strong>${item.nombre_completo}</strong> <span class="chip-sub">(${item.marca})</span>`;
                itemBtn.title = 'Haz clic para seleccionar este producto para búsqueda rápida';
                
                itemBtn.addEventListener('click', () => {
                    if (selectProductoRapido) {
                        selectProductoRapido.value = item.id;
                        selectProductoRapido.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        selectProductoRapido.focus();
                    }
                });

                list.appendChild(itemBtn);
            });

            catCard.appendChild(list);
            catalogoBrowserContainer.appendChild(catCard);
        });
    }

    // ==========================================================================
    // 2. FORMATEO DE CELDAS Y TABLAS COMPARATIVAS
    // ==========================================================================
    function formatearMoneda(val) {
        if (typeof val === 'number') {
            return '$ ' + val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return val || 'No encontrado';
    }

    function construirFilaComparativa(item) {
        const tr = document.createElement('tr');

        // Celda 1: Producto
        const tdProd = document.createElement('td');
        tdProd.className = 'td-producto';
        tdProd.innerHTML = `<strong>${escapeHtml(item.producto)}</strong>`;
        tr.appendChild(tdProd);

        // Celda 2: Coto
        const tdCoto = document.createElement('td');
        tdCoto.className = typeof item.coto === 'number' ? 'td-precio' : 'td-nodisp';
        tdCoto.textContent = formatearMoneda(item.cotoTexto);
        tr.appendChild(tdCoto);

        // Celda 3: Carrefour
        const tdCarrefour = document.createElement('td');
        tdCarrefour.className = typeof item.carrefour === 'number' ? 'td-precio' : 'td-nodisp';
        tdCarrefour.textContent = formatearMoneda(item.carrefourTexto);
        tr.appendChild(tdCarrefour);

        // Celda 4: Día
        const tdDia = document.createElement('td');
        tdDia.className = typeof item.dia === 'number' ? 'td-precio' : 'td-nodisp';
        tdDia.textContent = formatearMoneda(item.diaTexto);
        tr.appendChild(tdDia);

        // Celda 5: El ganador es este
        const tdGanador = document.createElement('td');
        tdGanador.className = 'td-ganador';
        if (item.ganador && item.ganador !== 'No se pudo determinar un ganador') {
            tdGanador.innerHTML = `<span class="badge-winner"><i class="fa-solid fa-trophy"></i> ${escapeHtml(item.ganador)}</span>`;
        } else {
            tdGanador.innerHTML = `<span class="badge-no-winner">No determinado</span>`;
        }
        tr.appendChild(tdGanador);

        return tr;
    }

    function renderTablaResultados(filas, tbodyElement, bannerElement) {
        if (!tbodyElement) return;
        tbodyElement.innerHTML = '';

        if (!filas || filas.length === 0) {
            tbodyElement.innerHTML = '<tr><td colspan="5" class="td-empty">No hay resultados disponibles para mostrar.</td></tr>';
            if (bannerElement) bannerElement.innerHTML = '';
            return;
        }

        filas.forEach(f => {
            tbodyElement.appendChild(construirFilaComparativa(f));
        });

        if (bannerElement) {
            const primer = filas[0];
            if (primer && primer.ganador && primer.ganador !== 'No se pudo determinar un ganador') {
                bannerElement.innerHTML = `
                    <div class="winner-alert-box">
                        <div class="winner-icon"><i class="fa-solid fa-crown"></i></div>
                        <div>
                            <h4>EL GANADOR ES: <span>${escapeHtml(primer.ganador.toUpperCase())}</span></h4>
                            <p>Mejor precio válido encontrado para ${escapeHtml(primer.producto)}.</p>
                        </div>
                    </div>
                `;
            } else {
                bannerElement.innerHTML = `
                    <div class="winner-alert-box neutral">
                        <div class="winner-icon"><i class="fa-solid fa-circle-info"></i></div>
                        <div>
                            <h4>No se pudo determinar un ganador</h4>
                            <p>El producto no se encontró disponible con precio válido en los supermercados.</p>
                        </div>
                    </div>
                `;
            }
        }
    }

    // ==========================================================================
    // 3. BÚSQUEDA RÁPIDA (SELECTOR OBLIGATORIO + SIN UNIDADES)
    // ==========================================================================
    if (btnBuscarRapido) {
        btnBuscarRapido.addEventListener('click', async () => {
            const prodId = selectProductoRapido ? selectProductoRapido.value : '';
            if (!prodId) {
                alert('Por favor selecciona un producto del catálogo para realizar la búsqueda.');
                if (selectProductoRapido) selectProductoRapido.focus();
                return;
            }

            if (isProcessRunning) {
                alert('Ya hay un proceso de búsqueda en ejecución.');
                return;
            }

            const item = itemsCatalogoGlobal.find(it => it.id === prodId);
            const nombreProd = item ? item.nombre_completo : prodId;

            // Mostrar estado de carga y ocultar resultados anteriores
            isProcessRunning = true;
            btnBuscarRapido.disabled = true;
            if (busquedaStatusBar) {
                busquedaStatusBar.style.display = 'flex';
                if (busquedaStatusMsg) busquedaStatusMsg.textContent = `Buscando "${nombreProd}" en COTO, Carrefour y Día %...`;
            }
            if (busquedaResultadosWrapper) busquedaResultadosWrapper.style.display = 'none';

            try {
                const resp = await fetch('/api/buscar-individual', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productoId: prodId, producto: item ? item.producto : '' })
                });

                const data = await resp.json();
                if (data.success && data.filas) {
                    renderTablaResultados(data.filas, busquedaTbody, busquedaWinnerBanner);
                    if (busquedaResultadosWrapper) busquedaResultadosWrapper.style.display = 'block';
                } else {
                    alert(data.message || 'Error al realizar la búsqueda.');
                }
            } catch (err) {
                alert('Ocurrió un error de comunicación con el servidor: ' + err.message);
            } finally {
                isProcessRunning = false;
                btnBuscarRapido.disabled = false;
                if (busquedaStatusBar) busquedaStatusBar.style.display = 'none';
            }
        });
    }

    // ==========================================================================
    // 4. COMPRA DEL MES
    // ==========================================================================
    function renderCanastaTotal(filas) {
        if (!compraMesTfoot) return;
        compraMesTfoot.innerHTML = '';

        let totalCoto = 0, countCoto = 0;
        let totalCarrefour = 0, countCarrefour = 0;
        let totalDia = 0, countDia = 0;

        filas.forEach(f => {
            if (typeof f.coto === 'number') { totalCoto += f.coto; countCoto++; }
            if (typeof f.carrefour === 'number') { totalCarrefour += f.carrefour; countCarrefour++; }
            if (typeof f.dia === 'number') { totalDia += f.dia; countDia++; }
        });

        const valCoto = countCoto > 0 ? totalCoto : null;
        const valCarrefour = countCarrefour > 0 ? totalCarrefour : null;
        const valDia = countDia > 0 ? totalDia : null;

        // Determinar ganador total
        const candidatos = [];
        if (valCoto !== null) candidatos.push({ superm: 'COTO', precio: valCoto });
        if (valCarrefour !== null) candidatos.push({ superm: 'Carrefour', precio: valCarrefour });
        if (valDia !== null) candidatos.push({ superm: 'Día %', precio: valDia });

        candidatos.sort((a, b) => a.precio - b.precio);
        const ganadorTotal = candidatos.length > 0 ? candidatos[0].superm : 'No determinado';

        const tr = document.createElement('tr');
        tr.className = 'tr-total';
        tr.innerHTML = `
            <td><strong>TOTAL ESTIMADO CANASTA</strong></td>
            <td class="td-precio"><strong>${formatearMoneda(valCoto)}</strong></td>
            <td class="td-precio"><strong>${formatearMoneda(valCarrefour)}</strong></td>
            <td class="td-precio"><strong>${formatearMoneda(valDia)}</strong></td>
            <td class="td-ganador">
                <span class="badge-winner"><i class="fa-solid fa-trophy"></i> ${ganadorTotal}</span>
            </td>
        `;
        compraMesTfoot.appendChild(tr);

        if (compraMesWinnerBanner) {
            if (ganadorTotal !== 'No determinado') {
                compraMesWinnerBanner.innerHTML = `
                    <div class="winner-alert-box">
                        <div class="winner-icon"><i class="fa-solid fa-crown"></i></div>
                        <div>
                            <h4>CANASTA GANADORA: <span>${escapeHtml(ganadorTotal.toUpperCase())}</span></h4>
                            <p>Es la opción más económica para la compra mensual completa.</p>
                        </div>
                    </div>
                `;
            }
        }
    }

    if (btnCompraMes) {
        btnCompraMes.addEventListener('click', async () => {
            if (isProcessRunning) {
                alert('Ya hay un proceso en ejecución.');
                return;
            }

            isProcessRunning = true;
            btnCompraMes.disabled = true;
            if (compraMesStatusBar) {
                compraMesStatusBar.style.display = 'flex';
                if (compraMesStatusMsg) compraMesStatusMsg.textContent = 'Procesando canasta mensual en los 3 supermercados...';
            }
            if (compraMesResultadosWrapper) compraMesResultadosWrapper.style.display = 'none';

            try {
                const resp = await fetch('/api/compra-mes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });

                const data = await resp.json();
                if (data.success && data.filas) {
                    renderTablaResultados(data.filas, compraMesTbody, null);
                    renderCanastaTotal(data.filas);
                    if (compraMesResultadosWrapper) compraMesResultadosWrapper.style.display = 'block';
                } else {
                    alert(data.message || 'Error al procesar la canasta mensual.');
                }
            } catch (err) {
                alert('Error al ejecutar compra del mes: ' + err.message);
            } finally {
                isProcessRunning = false;
                btnCompraMes.disabled = false;
                if (compraMesStatusBar) compraMesStatusBar.style.display = 'none';
            }
        });
    }

    // ==========================================================================
    // 5. MODAL DE EDICIÓN DE CANASTA (SIN MANEJO DE UNIDADES)
    // ==========================================================================
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

    function crearFilaCanasta(prodItem = null) {
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

    if (btnEditarLista) {
        btnEditarLista.addEventListener('click', async () => {
            if (editarModal) editarModal.classList.add('active');
            if (modalTbodyCanasta) {
                modalTbodyCanasta.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 1.5rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando lista...</td></tr>';
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

                            const matched = itemsCatalogoGlobal.find(it =>
                                it.producto.toLowerCase() === prodText.toLowerCase() ||
                                it.nombre_completo.toLowerCase().includes(prodText.toLowerCase()) ||
                                it.marca.toLowerCase() === prodText.toLowerCase()
                            );

                            if (prodText) {
                                modalTbodyCanasta.appendChild(crearFilaCanasta(matched || { id: '', producto: prodText, cantidad: cant, unidad: unid }));
                                count++;
                            }
                        }
                    }
                    if (count === 0) {
                        modalTbodyCanasta.appendChild(crearFilaCanasta(null));
                    }
                } else if (modalTbodyCanasta) {
                    modalTbodyCanasta.appendChild(crearFilaCanasta(null));
                }
            } catch (e) {
                if (modalTbodyCanasta) {
                    modalTbodyCanasta.innerHTML = '';
                    modalTbodyCanasta.appendChild(crearFilaCanasta(null));
                }
            }
        });
    }

    if (btnAgregarFilaModal) {
        btnAgregarFilaModal.addEventListener('click', () => {
            if (modalTbodyCanasta) {
                modalTbodyCanasta.appendChild(crearFilaCanasta(null));
            }
        });
    }

    if (btnCerrarEditarModal) {
        btnCerrarEditarModal.addEventListener('click', () => {
            if (editarModal) editarModal.classList.remove('active');
        });
    }

    if (btnCerrarXModal) {
        btnCerrarXModal.addEventListener('click', () => {
            if (editarModal) editarModal.classList.remove('active');
        });
    }

    if (btnGuardarLista) {
        btnGuardarLista.addEventListener('click', async () => {
            if (!modalTbodyCanasta) return;
            const rows = modalTbodyCanasta.querySelectorAll('tr');
            let contenido = "producto,cantidad,unidad\n";
            let validCount = 0;

            rows.forEach(r => {
                const selProd = r.querySelector('.modal-select-prod');
                if (selProd && selProd.value) {
                    const item = itemsCatalogoGlobal.find(it => it.id === selProd.value);
                    if (item) {
                        contenido += `${item.producto},${item.cantidad},${item.unidad}\n`;
                        validCount++;
                    }
                }
            });

            if (validCount === 0) {
                alert('Debes agregar al menos un producto del catálogo a la canasta.');
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
                    if (editarModal) editarModal.classList.remove('active');
                    alert('Canasta mensual guardada exitosamente.');
                } else {
                    alert(`Error al guardar: ${data.message}`);
                }
            } catch (error) {
                alert(`Error al guardar: ${error.message}`);
            }
        });
    }

    // ==========================================================================
    // 6. REPORTES Y UTILIDADES (ABRIR EXCEL)
    // ==========================================================================
    if (btnAbrirExcel) {
        btnAbrirExcel.addEventListener('click', async () => {
            try {
                await fetch('/api/abrir-excel');
            } catch (e) {}
        });
    }

    // ==========================================================================
    // 7. PORTADA Y PRESENTACIÓN ACADÉMICA
    // ==========================================================================
    const welcomeScreen = document.getElementById('welcome-screen');
    const btnEntrarDashboard = document.getElementById('btn-entrar-dashboard');
    const btnVolverPortada = document.getElementById('btn-volver-portada');

    if (btnEntrarDashboard && welcomeScreen) {
        btnEntrarDashboard.addEventListener('click', () => {
            welcomeScreen.classList.add('hidden');
        });
    }

    if (btnVolverPortada && welcomeScreen) {
        btnVolverPortada.addEventListener('click', () => {
            welcomeScreen.classList.remove('hidden');
        });
    }

    // Cargar datos comparativos previos si existen
    async function cargarComparativasPrevias() {
        try {
            const respIndiv = await fetch('/api/comparativa?modo=individual');
            const dataIndiv = await respIndiv.json();
            if (dataIndiv.success && dataIndiv.filas && dataIndiv.filas.length > 0) {
                renderTablaResultados(dataIndiv.filas, busquedaTbody, busquedaWinnerBanner);
                if (busquedaResultadosWrapper) busquedaResultadosWrapper.style.display = 'block';
            }

            const respMes = await fetch('/api/comparativa?modo=compra_mes');
            const dataMes = await respMes.json();
            if (dataMes.success && dataMes.filas && dataMes.filas.length > 0) {
                renderTablaResultados(dataMes.filas, compraMesTbody, null);
                renderCanastaTotal(dataMes.filas);
                if (compraMesResultadosWrapper) compraMesResultadosWrapper.style.display = 'block';
            }
        } catch (e) {}
    }

    // Iniciar UI
    cargarCatalogoUI().then(() => {
        cargarComparativasPrevias();
    });
});
