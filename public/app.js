document.addEventListener('DOMContentLoaded', () => {
    const btnCompraMes = document.getElementById('btn-compra-mes');
    const btnBuscarIndividual = document.getElementById('btn-buscar-individual');
    const inputProducto = document.getElementById('input-producto');
    const inputCantidad = document.getElementById('input-cantidad');
    const inputUnidad = document.getElementById('input-unidad');
    const btnAbrirExcel = document.getElementById('btn-abrir-excel');
    const btnLimpiar = document.getElementById('btn-limpiar');
    
    const logContainer = document.getElementById('log-container');
    const statusIndicator = document.getElementById('status-indicator');
    const btnAbort = document.getElementById('btn-abort');
    const abortBar = document.getElementById('abort-bar');
    
    const modal = document.getElementById('limpiar-modal');
    const btnCerrarModal = document.getElementById('btn-cerrar-modal');
    const btnsClean = document.querySelectorAll('.btn-clean');

    // Controles de Modo Demostración
    const checkDemoMode = document.getElementById('check-demo-mode');
    const inputTypingDelay = document.getElementById('input-typing-delay');
    const labelTypingDelay = document.getElementById('label-typing-delay');
    const inputMouseDuration = document.getElementById('input-mouse-duration');
    const labelMouseDuration = document.getElementById('label-mouse-duration');

    if (inputTypingDelay && labelTypingDelay) {
        inputTypingDelay.addEventListener('input', () => {
            labelTypingDelay.textContent = `${parseFloat(inputTypingDelay.value).toFixed(2)}s`;
        });
    }

    if (inputMouseDuration && labelMouseDuration) {
        inputMouseDuration.addEventListener('input', () => {
            labelMouseDuration.textContent = `${parseFloat(inputMouseDuration.value).toFixed(1)}s`;
        });
    }

    // Monitor y Pasos de Supermercados
    const monitorStatusText = document.getElementById('monitor-status-text');
    const mainProgressFill = document.getElementById('main-progress-fill');
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
                    if (typeof msg.percent === 'number' && mainProgressFill) {
                        mainProgressFill.style.width = `${msg.percent}%`;
                    }
                } else if (msg.type === 'status') {
                    if (monitorStatusText) {
                        if (msg.state === 'live') {
                            monitorStatusText.textContent = '🔴 NAVEGADOR CHROME EN VIVO';
                        } else if (msg.state === 'connecting') {
                            monitorStatusText.textContent = 'CONECTANDO CON NAVEGADOR...';
                        } else if (msg.state === 'finished') {
                            monitorStatusText.textContent = '✓ RPA FINALIZADO EXITOSAMENTE';
                            if (mainProgressFill) mainProgressFill.style.width = '100%';
                        } else if (msg.state === 'idle') {
                            monitorStatusText.textContent = 'RPA EN ESPERA';
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
            if (text.includes('Finalizado')) {
                if (stepCarrefour) stepCarrefour.className = 'super-step-card completed';
                if (statusCarrefour) statusCarrefour.textContent = '✓ Completado';
                if (mainProgressFill) mainProgressFill.style.width = '35%';
            }
        } else if (text.includes('[SUPERMERCADO 2]')) {
            if (stepCoto) stepCoto.className = 'super-step-card active';
            if (statusCoto) statusCoto.textContent = 'En curso...';
            if (mainProgressFill) mainProgressFill.style.width = '55%';
            if (text.includes('Finalizado')) {
                if (stepCoto) stepCoto.className = 'super-step-card completed';
                if (statusCoto) statusCoto.textContent = '✓ Completado';
                if (mainProgressFill) mainProgressFill.style.width = '70%';
            }
        } else if (text.includes('[SUPERMERCADO 3]')) {
            if (stepDia) stepDia.className = 'super-step-card active';
            if (statusDia) statusDia.textContent = 'En curso...';
            if (mainProgressFill) mainProgressFill.style.width = '85%';
            if (text.includes('Finalizado')) {
                if (stepDia) stepDia.className = 'super-step-card completed';
                if (statusDia) statusDia.textContent = '✓ Completado';
                if (mainProgressFill) mainProgressFill.style.width = '100%';
            }
        } else if (text.includes('[ RPA FINALIZADO ]')) {
            if (stepCarrefour) stepCarrefour.className = 'super-step-card completed';
            if (stepCoto) stepCoto.className = 'super-step-card completed';
            if (stepDia) stepDia.className = 'super-step-card completed';
            if (mainProgressFill) mainProgressFill.style.width = '100%';
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
        const btns = document.querySelectorAll('button:not(#btn-cerrar-modal):not(#btn-abort)');
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

        const isDemo = checkDemoMode ? checkDemoMode.checked : true;
        const typingDelayMs = inputTypingDelay ? Math.round(parseFloat(inputTypingDelay.value) * 1000) : 50;
        const mouseDurationMs = inputMouseDuration ? Math.round(parseFloat(inputMouseDuration.value) * 1000) : 600;

        const payload = Object.assign({}, body || {}, {
            demoMode: isDemo,
            typingDelay: typingDelayMs,
            mouseDuration: mouseDurationMs
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

    // Eventos de Botones Principales
    btnCompraMes.addEventListener('click', () => {
        executeAction('/api/compra-mes');
    });

    btnBuscarIndividual.addEventListener('click', () => {
        const producto = inputProducto.value.trim();
        const cantidad = inputCantidad ? (parseInt(inputCantidad.value, 10) || 1) : 1;
        const unidad = inputUnidad ? inputUnidad.value.trim() : '';

        if (!producto) {
            addLog("Por favor ingresa un producto antes de buscar.", true);
            return;
        }
        executeAction('/api/buscar-individual', { producto, cantidad, unidad });
    });

    // Permitir buscar con ENTER desde cualquiera de los inputs
    inputProducto.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnBuscarIndividual.click();
    });
    if (inputCantidad) {
        inputCantidad.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnBuscarIndividual.click();
        });
    }
    if (inputUnidad) {
        inputUnidad.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnBuscarIndividual.click();
        });
    }

    btnAbrirExcel.addEventListener('click', () => {
        executeAction('/api/abrir-excel');
    });

    // Manejo de Modal de Limpieza
    btnLimpiar.addEventListener('click', () => modal.classList.add('active'));
    btnCerrarModal.addEventListener('click', () => modal.classList.remove('active'));

    btnsClean.forEach(btn => {
        btn.addEventListener('click', () => {
            const tipo = btn.getAttribute('data-tipo');
            modal.classList.remove('active');
            executeAction('/api/limpiar', { tipo });
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

    function crearFilaCanasta(producto = '', cantidad = 1, unidad = '') {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="text" class="modal-input modal-input-prod" placeholder="Ej: Arroz Gallo Oro, Leche La Serenisima..." value="${escapeHtml(producto)}" />
            </td>
            <td>
                <input type="number" class="modal-input modal-input-cant" min="1" step="1" value="${cantidad > 0 ? cantidad : 1}" />
            </td>
            <td>
                <input type="text" class="modal-input modal-input-unid" placeholder="Ej: 2L, 1kg, 500g (Opcional)" value="${escapeHtml(unidad)}" />
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
                            const prod = parts[0] ? parts[0].trim() : '';
                            let cant = 1;
                            let unid = '';
                            if (parts[1]) {
                                const parsed = parseInt(parts[1].trim(), 10);
                                if (!isNaN(parsed) && parsed > 0) {
                                    cant = parsed;
                                }
                            }
                            if (parts[2]) {
                                unid = parts[2].trim();
                            }
                            if (prod) {
                                modalTbodyCanasta.appendChild(crearFilaCanasta(prod, cant, unid));
                                count++;
                            }
                        }
                    }
                    if (count === 0) {
                        modalTbodyCanasta.appendChild(crearFilaCanasta('', 1, ''));
                    }
                } else if (modalTbodyCanasta) {
                    modalTbodyCanasta.appendChild(crearFilaCanasta('', 1, ''));
                }
            } catch (e) {
                if (modalTbodyCanasta) {
                    modalTbodyCanasta.innerHTML = '';
                    modalTbodyCanasta.appendChild(crearFilaCanasta('', 1, ''));
                }
            }
        });
    }

    if (btnAgregarFilaModal) {
        btnAgregarFilaModal.addEventListener('click', () => {
            if (modalTbodyCanasta) {
                const tr = crearFilaCanasta('', 1, '');
                modalTbodyCanasta.appendChild(tr);
                const inputProd = tr.querySelector('.modal-input-prod');
                if (inputProd) inputProd.focus();
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
            let contenido = "producto,cantidad,unidad\n";
            let validCount = 0;

            rows.forEach(r => {
                const prodInput = r.querySelector('.modal-input-prod');
                const cantInput = r.querySelector('.modal-input-cant');
                const unidInput = r.querySelector('.modal-input-unid');
                if (prodInput) {
                    const prod = prodInput.value.replace(/,/g, ' ').trim();
                    const cant = parseInt(cantInput ? cantInput.value : '1', 10) || 1;
                    const unid = unidInput ? unidInput.value.replace(/,/g, ' ').trim() : '';
                    if (prod) {
                        contenido += `${prod},${cant},${unid}\n`;
                        validCount++;
                    }
                }
            });

            if (validCount === 0) {
                alert("Debes agregar al menos un producto a la lista.");
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
                    addLog(`✓ Canasta mensual actualizada (${validCount} productos guardados con cantidad y unidad).`);
                } else {
                    alert("Error al guardar: " + data.message);
                }
            } catch (e) {
                alert("Error de conexión al guardar.");
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

    // Kill-switch: Si el usuario cierra el frontend en el navegador, abortar la búsqueda inmediatamente
    window.addEventListener('beforeunload', () => {
        try {
            navigator.sendBeacon('/api/abort');
        } catch (e) {}
    });
});
