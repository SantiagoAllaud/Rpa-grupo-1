document.addEventListener('DOMContentLoaded', () => {
    const btnCompraMes = document.getElementById('btn-compra-mes');
    const btnBuscarIndividual = document.getElementById('btn-buscar-individual');
    const inputProducto = document.getElementById('input-producto');
    const inputCantidad = document.getElementById('input-cantidad');
    const inputUnidad = document.getElementById('input-unidad');
    const logContainer = document.getElementById('log-container');
    const statusIndicator = document.getElementById('status-indicator');
    const btnAbort = document.getElementById('btn-abort');
    const abortBar = document.getElementById('abort-bar');

    // Monitor y Pasos de Supermercados
    const monitorStatusText = document.getElementById('monitor-status-text');
    const mainProgressFill = document.getElementById('main-progress-fill');
    const progressPercentBadge = document.getElementById('progress-percent-badge');
    const stepCarrefour = document.getElementById('step-carrefour');
    const statusCarrefour = document.getElementById('status-carrefour');
    const stepCoto = document.getElementById('step-coto');
    const statusCoto = document.getElementById('status-coto');
    const stepDia = document.getElementById('step-dia');
    const statusDia = document.getElementById('status-dia');

    let ws = null;

    function resetSuperSteps() {
        if (stepCarrefour) stepCarrefour.className = 'super-step-card';
        if (statusCarrefour) statusCarrefour.textContent = 'En espera';
        if (stepCoto) stepCoto.className = 'super-step-card';
        if (statusCoto) statusCoto.textContent = 'En espera';
        if (stepDia) stepDia.className = 'super-step-card';
        if (statusDia) statusDia.textContent = 'En espera';
        if (mainProgressFill) mainProgressFill.style.width = '0%';
        if (progressPercentBadge) progressPercentBadge.textContent = '0%';
        if (monitorStatusText) monitorStatusText.textContent = 'RPA EN ESPERA';
    }

    // Conectar WebSocket para logs en vivo del sistema
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
                    parseLogStep(msg.message);
                } else if (msg.type === 'progress') {
                    if (typeof msg.percent === 'number') {
                        if (mainProgressFill) mainProgressFill.style.width = `${msg.percent}%`;
                        if (progressPercentBadge) progressPercentBadge.textContent = `${msg.percent}%`;
                    }
                } else if (msg.type === 'status') {
                    if (monitorStatusText) {
                        if (msg.state === 'live') {
                            monitorStatusText.textContent = '🤖 AUTOMATIZACIÓN EN CURSO';
                        } else if (msg.state === 'connecting') {
                            monitorStatusText.textContent = 'CONECTANDO CON NAVEGADOR...';
                        } else if (msg.state === 'finished') {
                            monitorStatusText.textContent = '✓ RPA FINALIZADO EXITOSAMENTE';
                            if (mainProgressFill) mainProgressFill.style.width = '100%';
                            if (progressPercentBadge) progressPercentBadge.textContent = '100%';
                        } else if (msg.state === 'idle') {
                            monitorStatusText.textContent = 'RPA EN ESPERA';
                        } else if (msg.state === 'aborted') {
                            monitorStatusText.textContent = '🛑 RPA DETENIDO';
                        } else if (msg.state === 'error') {
                            monitorStatusText.textContent = 'ERROR EN LA EJECUCIÓN';
                        }
                    }
                }
            } catch (e) {
                console.error("[WebSocket] Error:", e);
            }
        };

        ws.onclose = () => {
            setTimeout(connectStream, 3000);
        };
    }

    connectStream();

    // Actualiza los pasos de los 3 supermercados según los logs
    function parseLogStep(text) {
        if (!text) return;
        if (text.includes('[SUPERMERCADO 1]')) {
            if (stepCarrefour) stepCarrefour.className = 'super-step-card active';
            if (statusCarrefour) statusCarrefour.textContent = 'En curso...';
            if (mainProgressFill) mainProgressFill.style.width = '25%';
            if (progressPercentBadge) progressPercentBadge.textContent = '25%';
            if (text.includes('Finalizado')) {
                if (stepCarrefour) stepCarrefour.className = 'super-step-card completed';
                if (statusCarrefour) statusCarrefour.textContent = '✓ Completado';
                if (mainProgressFill) mainProgressFill.style.width = '35%';
                if (progressPercentBadge) progressPercentBadge.textContent = '35%';
            }
        } else if (text.includes('[SUPERMERCADO 2]')) {
            if (stepCoto) stepCoto.className = 'super-step-card active';
            if (statusCoto) statusCoto.textContent = 'En curso...';
            if (mainProgressFill) mainProgressFill.style.width = '55%';
            if (progressPercentBadge) progressPercentBadge.textContent = '55%';
            if (text.includes('Finalizado')) {
                if (stepCoto) stepCoto.className = 'super-step-card completed';
                if (statusCoto) statusCoto.textContent = '✓ Completado';
                if (mainProgressFill) mainProgressFill.style.width = '70%';
                if (progressPercentBadge) progressPercentBadge.textContent = '70%';
            }
        } else if (text.includes('[SUPERMERCADO 3]')) {
            if (stepDia) stepDia.className = 'super-step-card active';
            if (statusDia) statusDia.textContent = 'En curso...';
            if (mainProgressFill) mainProgressFill.style.width = '85%';
            if (progressPercentBadge) progressPercentBadge.textContent = '85%';
            if (text.includes('Finalizado')) {
                if (stepDia) stepDia.className = 'super-step-card completed';
                if (statusDia) statusDia.textContent = '✓ Completado';
                if (mainProgressFill) mainProgressFill.style.width = '100%';
                if (progressPercentBadge) progressPercentBadge.textContent = '100%';
            }
        } else if (text.includes('[ RPA FINALIZADO ]')) {
            if (stepCarrefour) stepCarrefour.className = 'super-step-card completed';
            if (stepCoto) stepCoto.className = 'super-step-card completed';
            if (stepDia) stepDia.className = 'super-step-card completed';
            if (mainProgressFill) mainProgressFill.style.width = '100%';
            if (progressPercentBadge) progressPercentBadge.textContent = '100%';
        }
    }

    // Añadir mensajes a la consola virtual
    function addLog(msg, isError = false) {
        const p = document.createElement('p');
        p.textContent = `> ${msg}`;
        if (isError) p.classList.add('log-error');
        logContainer.appendChild(p);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // Cambiar estado visual de botones
    function setRunningState(isRunning) {
        const btns = document.querySelectorAll('button:not(#btn-cerrar-modal):not(#btn-abort):not(#btn-toggle-screen)');
        btns.forEach(btn => btn.disabled = isRunning);
        
        if (isRunning) {
            statusIndicator.textContent = "Procesando...";
            statusIndicator.className = "indicator running";
            if (abortBar) abortBar.classList.add('visible');
            if (btnAbort) btnAbort.disabled = false;
        } else {
            statusIndicator.textContent = "Listo";
            statusIndicator.className = "indicator idle";
            if (abortBar) abortBar.classList.remove('visible');
        }
    }

    // Ejecutar llamada a la API
    async function executeAction(endpoint, body = null) {
        resetSuperSteps();
        setRunningState(true);
        addLog(`Iniciando: ${endpoint}...`);

        const payload = Object.assign({}, body || {}, {
            demoMode: true,
            typingDelay: 50,
            mouseDuration: 600,
            headless: true
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
            } else {
                addLog(`Error: ${data.message}`, true);
            }
        } catch (error) {
            addLog(`Error de conexión: ${error.message}`, true);
        } finally {
            setRunningState(false);
        }
    }

    // ==========================================================================
    // GESTIÓN DEL CATÁLOGO CERRADO EN EL FRONTEND
    // ==========================================================================
    let catalogoGlobal = null;
    let itemsCatalogoGlobal = [];
    const selectProducto = document.getElementById('select-producto');
    const inputUnidadesCompra = document.getElementById('input-unidades-compra');
    const boxInfoProducto = document.getElementById('box-info-producto');
    const infoMarca = document.getElementById('info-marca');
    const infoVariante = document.getElementById('info-variante');
    const infoPresentacion = document.getElementById('info-presentacion');

    async function cargarCatalogoUI() {
        try {
            const resp = await fetch('/api/catalogo');
            const data = await resp.json();
            if (data.success && data.catalogo) {
                catalogoGlobal = data.catalogo;
                itemsCatalogoGlobal = data.items || [];
                poblarSelectProductosUnificado();
            }
        } catch (e) {
            console.error('Error cargando catálogo:', e);
        }
    }

    function poblarSelectProductosUnificado() {
        if (!selectProducto || !catalogoGlobal) return;
        selectProducto.innerHTML = '<option value="">-- Selecciona un producto del catálogo --</option>';

        const categorias = Object.keys(catalogoGlobal);
        categorias.forEach(cat => {
            const prods = catalogoGlobal[cat];
            if (!prods || prods.length === 0) return;

            const optgroup = document.createElement('optgroup');
            optgroup.label = cat.toUpperCase();

            prods.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.nombre_completo;
                optgroup.appendChild(opt);
            });

            selectProducto.appendChild(optgroup);
        });
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

    if (selectProducto) {
        selectProducto.addEventListener('change', (e) => {
            const val = e.target.value;
            if (!val) {
                mostrarInfoProducto(null);
                return;
            }
            const item = itemsCatalogoGlobal.find(it => it.id === val);
            mostrarInfoProducto(item);
        });
    }

    // Iniciar carga del catálogo
    cargarCatalogoUI();

    // Eventos de Botones Principales
    btnCompraMes.addEventListener('click', () => {
        executeAction('/api/compra-mes');
    });

    btnBuscarIndividual.addEventListener('click', () => {
        const prodId = selectProducto ? selectProducto.value : '';
        const item = itemsCatalogoGlobal.find(it => it.id === prodId);
        const unidades = inputUnidadesCompra ? (parseInt(inputUnidadesCompra.value, 10) || 1) : 1;

        if (!item) {
            addLog("Por favor selecciona un producto del catálogo cerrado.", true);
            return;
        }

        executeAction('/api/buscar-individual', {
            producto: item.producto,
            terminoBusqueda: item.termino_busqueda || item.nombre_completo,
            cantidad: item.cantidad,
            unidad: item.unidad,
            unidades: unidades
        });
    });

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
                <input type="number" class="modal-input modal-input-unid-compra" min="1" step="1" value="${unidades > 0 ? unidades : 1}" />
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn-del-row" title="Eliminar este producto"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;

        tr.querySelector('.btn-del-row').addEventListener('click', () => {
            tr.remove();
        });
        return tr;
    }

    if (btnEditarLista) {
        btnEditarLista.addEventListener('click', async () => {
            editarModal.classList.add('active');
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

    if (btnCerrarEditarModal) {
        btnCerrarEditarModal.addEventListener('click', () => {
            editarModal.classList.remove('active');
        });
    }

    if (btnCerrarXModal) {
        btnCerrarXModal.addEventListener('click', () => {
            editarModal.classList.remove('active');
        });
    }

    if (btnGuardarLista) {
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

    // Control de Portada / Pantalla de Bienvenida
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

    // Kill-switch: Si el usuario cierra el frontend en el navegador, abortar la búsqueda inmediatamente
    window.addEventListener('beforeunload', () => {
        try {
            navigator.sendBeacon('/api/abort');
        } catch (e) {}
    });
});
