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
    
    const modal = document.getElementById('limpiar-modal');
    const btnCerrarModal = document.getElementById('btn-cerrar-modal');
    const btnsClean = document.querySelectorAll('.btn-clean');

    // Elementos del Reproductor
    const playerCanvas = document.getElementById('rpa-stream-canvas');
    const canvasCtx = playerCanvas.getContext('2d');
    const playerOverlay = document.getElementById('player-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlaySubtitle = document.getElementById('overlay-subtitle');
    const overlaySpinner = document.getElementById('overlay-spinner');
    const overlayIcon = document.getElementById('overlay-icon');
    const playerLiveBadge = document.getElementById('player-live-badge');
    const playerStatusBadge = document.getElementById('player-status-badge');
    const playerProgressFill = document.getElementById('player-progress-fill');
    const playerTime = document.getElementById('player-time');
    const btnPlayerFullscreen = document.getElementById('btn-player-fullscreen');
    const playerScreenWrapper = document.getElementById('player-screen-wrapper');

    let streamTimer = null;
    let streamSeconds = 0;
    let ws = null;
    let currentRpaState = 'idle';

    // Conectar WebSocket para Stream en Vivo del Navegador Real
    function connectStream() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/rpa-stream`;
        
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("[Stream] WebSocket conectado con éxito.");
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'frame') {
                    renderFrame(msg.data);
                } else if (msg.type === 'status') {
                    handlePlayerStatus(msg.state, msg.message);
                } else if (msg.type === 'progress') {
                    if (typeof msg.percent === 'number') {
                        playerProgressFill.style.width = `${msg.percent}%`;
                    }
                } else if (msg.type === 'log') {
                    addLog(msg.message);
                }
            } catch (e) {
                console.error("[Stream] Error procesando mensaje:", e);
            }
        };

        ws.onclose = () => {
            console.log("[Stream] WebSocket cerrado. Reintentando en 3s...");
            setTimeout(connectStream, 3000);
        };

        ws.onerror = (err) => {
            console.warn("[Stream] Error en WebSocket:", err);
        };
    }

    connectStream();

    // Dibujar frame en el canvas en tiempo real
    function renderFrame(base64Data) {
        const img = new Image();
        img.onload = () => {
            canvasCtx.drawImage(img, 0, 0, playerCanvas.width, playerCanvas.height);
            if (playerOverlay && !playerOverlay.classList.contains('hidden')) {
                playerOverlay.classList.add('hidden');
            }
        };
        img.src = 'data:image/jpeg;base64,' + base64Data;
    }

    // Cronómetro de reproducción
    function startTimer() {
        stopTimer();
        streamSeconds = 0;
        playerTime.textContent = '00:00';
        streamTimer = setInterval(() => {
            streamSeconds++;
            const m = Math.floor(streamSeconds / 60).toString().padStart(2, '0');
            const s = (streamSeconds % 60).toString().padStart(2, '0');
            playerTime.textContent = `${m}:${s}`;
        }, 1000);
    }

    function stopTimer() {
        if (streamTimer) {
            clearInterval(streamTimer);
            streamTimer = null;
        }
    }

    // Manejador de estados del reproductor conforme a las especificaciones
    function handlePlayerStatus(state, message) {
        currentRpaState = state;
        if (state === 'live') {
            playerOverlay.classList.add('hidden');
            playerLiveBadge.className = 'live-badge';
            playerStatusBadge.className = 'player-status live';
            playerStatusBadge.textContent = '🔴 EN VIVO — NAVEGADOR CONECTADO';
            startTimer();
        } else if (state === 'connecting') {
            playerOverlay.classList.remove('hidden');
            overlayTitle.textContent = '🔴 EN VIVO';
            overlaySubtitle.textContent = message || 'Conectando con el navegador Google Chrome...';
            overlaySpinner.style.display = 'block';
            overlayIcon.style.display = 'none';
            playerLiveBadge.className = 'live-badge';
            playerStatusBadge.className = 'player-status connecting';
            playerStatusBadge.textContent = '🔴 EN VIVO — CONECTANDO...';
            playerProgressFill.style.width = '15%';
            startTimer();
        } else if (state === 'finished') {
            stopTimer();
            playerProgressFill.style.width = '100%';
            playerLiveBadge.className = 'live-badge inactive';
            playerStatusBadge.className = 'player-status finished';
            playerStatusBadge.textContent = '✓ RPA FINALIZADO';
        } else if (state === 'stream_warn') {
            playerStatusBadge.className = 'player-status error';
            playerStatusBadge.textContent = '⚠ VISUALIZACIÓN NO DISPONIBLE';
            overlayTitle.textContent = '⚠ VISUALIZACIÓN NO DISPONIBLE';
            overlaySubtitle.textContent = message || 'El RPA continúa ejecutándose pero la transmisión no está disponible.';
            overlaySpinner.style.display = 'none';
            overlayIcon.style.display = 'block';
        } else if (state === 'error') {
            stopTimer();
            playerOverlay.classList.remove('hidden');
            overlayTitle.textContent = 'ERROR EN LA EJECUCIÓN';
            overlaySubtitle.textContent = message || 'Se produjo un error en la ejecución del bot.';
            overlaySpinner.style.display = 'none';
            overlayIcon.style.display = 'block';
            overlayIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i>';
            playerLiveBadge.className = 'live-badge inactive';
            playerStatusBadge.className = 'player-status error';
            playerStatusBadge.textContent = 'ERROR';
        } else if (state === 'idle') {
            stopTimer();
            playerLiveBadge.className = 'live-badge inactive';
            playerStatusBadge.className = 'player-status idle';
            playerStatusBadge.textContent = 'RPA EN ESPERA';
            playerProgressFill.style.width = '0%';
        }
    }

    // Pantalla completa
    if (btnPlayerFullscreen) {
        btnPlayerFullscreen.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                playerScreenWrapper.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });
    }

    // Función para añadir mensajes a la consola virtual
    function addLog(msg, isError = false) {
        const p = document.createElement('p');
        p.textContent = `> ${msg}`;
        if (isError) p.classList.add('log-error');
        logContainer.appendChild(p);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // Cambiar estado visual
    function setRunningState(isRunning) {
        const btns = document.querySelectorAll('button:not(#btn-cerrar-modal):not(.player-control-btn)');
        btns.forEach(btn => btn.disabled = isRunning);
        
        if (isRunning) {
            statusIndicator.textContent = "Procesando...";
            statusIndicator.className = "indicator running";
        } else {
            statusIndicator.textContent = "Listo";
            statusIndicator.className = "indicator idle";
        }
    }

    // Ejecutar llamada a la API
    async function executeAction(endpoint, body = null) {
        setRunningState(true);
        addLog(`Iniciando tarea: ${endpoint}...`);
        
        try {
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            };
            if (body) options.body = JSON.stringify(body);
            
            const response = await fetch(endpoint, options);
            const data = await response.json();
            
            if (data.success) {
                addLog(data.message);
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
});
