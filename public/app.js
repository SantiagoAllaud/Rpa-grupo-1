document.addEventListener('DOMContentLoaded', () => {
    // Elementos principales
    const btnCompraMes = document.getElementById('btn-compra-mes');
    const btnBuscarIndividual = document.getElementById('btn-buscar-individual');
    const inputProducto = document.getElementById('input-producto');
    const btnAbrirExcel = document.getElementById('btn-abrir-excel');
    const btnLimpiar = document.getElementById('btn-limpiar');
    const btnLimpiarConsola = document.getElementById('btn-limpiar-consola');
    
    const logContainer = document.getElementById('log-container');
    const statusIndicator = document.getElementById('status-indicator');
    const liveCycleState = document.getElementById('live-cycle-state');
    const liveCurrentProduct = document.getElementById('live-current-product');
    
    // Filtros de búsqueda rápida
    const filterButtons = document.querySelectorAll('.filter-btn');
    const quickSearchTermBox = document.getElementById('quick-search-term-box');
    const quickSearchTermVal = document.getElementById('quick-search-term-val');
    let filtroActivo = 'Todos';

    // Elementos de la tarjeta de decisión
    const decisionWinner = document.getElementById('decision-winner');
    const decisionReason = document.getElementById('decision-reason');
    const decisionRankingList = document.getElementById('decision-ranking-list');

    // Modales
    const limpiarModal = document.getElementById('limpiar-modal');
    const btnCerrarModal = document.getElementById('btn-cerrar-modal');
    const btnsClean = document.querySelectorAll('.btn-clean');

    const editarModal = document.getElementById('editar-lista-modal');
    const btnEditarLista = document.getElementById('btn-editar-lista');
    const btnCerrarEditarModal = document.getElementById('btn-cerrar-editar-modal');
    const btnCerrarX = document.getElementById('btn-cerrar-x');
    const btnGuardarCanasta = document.getElementById('btn-guardar-canasta');
    const canastaTbody = document.getElementById('canasta-tbody');
    const nuevoProdNombre = document.getElementById('nuevo-prod-nombre');
    const nuevoProdCant = document.getElementById('nuevo-prod-cant');
    const btnAgregarProd = document.getElementById('btn-agregar-prod');
    const canastaFeedback = document.getElementById('canasta-feedback');

    // Estado local de la canasta
    let canastaActual = [];

    // ==============================================================================
    // 1. CONEXIÓN A SERVER-SENT EVENTS (SSE) EN TIEMPO REAL
    // ==============================================================================
    const eventSource = new EventSource('/api/stream');

    eventSource.addEventListener('conectado', (e) => {
        const data = JSON.parse(e.data);
        addLog(`Monitor en vivo conectado: ${data.message}`);
    });

    eventSource.addEventListener('rpa_inicio', (e) => {
        const data = JSON.parse(e.data);
        setRunningState(true);
        setCycleBadge('INICIANDO');
        addLog(data.mensaje);
        resetStoreCards();
    });

    eventSource.addEventListener('producto_inicio', (e) => {
        const data = JSON.parse(e.data);
        liveCurrentProduct.textContent = data.producto;
        setCycleBadge('BUSCANDO');
        resetStoreCards(data.producto);
        addLog(data.mensaje);
    });

    eventSource.addEventListener('supermercado_estado', (e) => {
        const data = JSON.parse(e.data);
        updateStoreStatus(data.supermercado, 'searching', data.mensaje, data.producto);
    });

    eventSource.addEventListener('supermercado_resultado', (e) => {
        const data = JSON.parse(e.data);
        updateStoreResult(data);
    });

    eventSource.addEventListener('decision', (e) => {
        const data = JSON.parse(e.data);
        setCycleBadge('SELECCIONANDO GANADOR');
        updateDecisionBox(data);
        addLog(`🧠 Decisión: Ganador ${data.ganador} (${data.precio}) - Motivo: ${data.motivo}`);
    });

    eventSource.addEventListener('completado', (e) => {
        const data = JSON.parse(e.data);
        setCycleBadge('RESULTADO FINAL');
        setRunningState(false);
        addLog(`✓ ${data.mensaje}`);
    });

    eventSource.addEventListener('log', (e) => {
        const data = JSON.parse(e.data);
        addLog(data.texto, data.error);
    });

    // ==============================================================================
    // 2. ACTUALIZACIÓN VISUAL DEL MONITOR EN TIEMPO REAL
    // ==============================================================================
    function setCycleBadge(text) {
        if (liveCycleState) {
            liveCycleState.textContent = text;
        }
    }

    function resetStoreCards(prodNombre = '') {
        ['carrefour', 'coto', 'dia'].forEach((supKey) => {
            const card = document.getElementById(`card-${supKey}`);
            const badge = document.getElementById(`badge-${supKey}`);
            const sSearch = document.getElementById(`search-${supKey}`);
            const sFound = document.getElementById(`found-${supKey}`);
            const sPrice = document.getElementById(`price-${supKey}`);
            const sVal = document.getElementById(`val-${supKey}`);

            if (card) {
                card.classList.remove('active-searching', 'winner');
            }
            if (badge) {
                badge.className = 'store-badge';
                badge.textContent = 'En espera';
            }
            if (sSearch) sSearch.textContent = prodNombre || '-';
            if (sFound) sFound.textContent = '-';
            if (sPrice) sPrice.textContent = '-';
            if (sVal) sVal.textContent = '-';
        });

        if (decisionWinner) decisionWinner.textContent = 'Calculando...';
        if (decisionReason) decisionReason.textContent = '-';
        if (decisionRankingList) decisionRankingList.innerHTML = '<span class="no-data">Esperando resultados de las 3 tiendas...</span>';
    }

    function normalizarSupermKey(name) {
        if (!name) return 'carrefour';
        const n = name.toLowerCase();
        if (n.includes('carrefour')) return 'carrefour';
        if (n.includes('coto')) return 'coto';
        if (n.includes('dia')) return 'dia';
        return 'carrefour';
    }

    function updateStoreStatus(supermercado, status, msg, prod) {
        const key = normalizarSupermKey(supermercado);
        const card = document.getElementById(`card-${key}`);
        const badge = document.getElementById(`badge-${key}`);
        const sSearch = document.getElementById(`search-${key}`);

        if (card) card.classList.add('active-searching');
        if (badge) {
            badge.className = `store-badge ${status}`;
            badge.textContent = status === 'searching' ? 'Buscando...' : status;
        }
        if (sSearch && prod) sSearch.textContent = prod;
    }

    function updateStoreResult(data) {
        const key = normalizarSupermKey(data.supermercado);
        const card = document.getElementById(`card-${key}`);
        const badge = document.getElementById(`badge-${key}`);
        const sFound = document.getElementById(`found-${key}`);
        const sPrice = document.getElementById(`price-${key}`);
        const sVal = document.getElementById(`val-${key}`);

        if (card) card.classList.remove('active-searching');

        if (sFound) sFound.textContent = data.nombre || 'No encontrado';
        if (sPrice) sPrice.textContent = data.precio || 'N/D';
        if (sVal) sVal.textContent = data.validacion || '-';

        if (badge) {
            if (data.stock === 'SIN STOCK') {
                badge.className = 'store-badge nostock';
                badge.textContent = 'Sin stock';
            } else if (data.validacion && data.validacion.includes('válida') && !data.validacion.includes('❌')) {
                badge.className = 'store-badge found';
                badge.textContent = '✓ Válida';
            } else {
                badge.className = 'store-badge invalid';
                badge.textContent = 'Descartada';
            }
        }
    }

    function updateDecisionBox(data) {
        if (decisionWinner) decisionWinner.textContent = data.ganador ? `${data.ganador} (${data.precio})` : 'Ninguno';
        if (decisionReason) decisionReason.textContent = data.motivo || 'menor precio válido';

        if (data.ganador) {
            const winKey = normalizarSupermKey(data.ganador);
            const winCard = document.getElementById(`card-${winKey}`);
            if (winCard) winCard.classList.add('winner');
        }

        if (decisionRankingList && Array.isArray(data.ranking)) {
            decisionRankingList.innerHTML = '';
            data.ranking.forEach((r) => {
                const badge = document.createElement('span');
                badge.className = `ranking-badge ${r.seleccionado ? 'selected' : ''}`;
                badge.innerHTML = `${r.posicion}° ${r.supermercado} — <strong>${r.precio}</strong> ${r.seleccionado ? '✓' : ''}`;
                decisionRankingList.appendChild(badge);
            });
        }
    }

    // ==============================================================================
    // 3. REGISTRO DE ACTIVIDAD Y CONSOLA VIRTUAL
    // ==============================================================================
    function addLog(msg, isError = false) {
        const p = document.createElement('p');
        p.textContent = `> ${msg}`;
        if (isError) p.classList.add('log-error');
        logContainer.appendChild(p);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    function setRunningState(isRunning) {
        const btns = document.querySelectorAll('button:not(#btn-cerrar-modal):not(#btn-cerrar-editar-modal):not(#btn-cerrar-x):not(#btn-limpiar-consola)');
        btns.forEach(btn => btn.disabled = isRunning);
        
        if (isRunning) {
            statusIndicator.textContent = "Procesando...";
            statusIndicator.className = "indicator running";
        } else {
            statusIndicator.textContent = "Listo";
            statusIndicator.className = "indicator idle";
        }
    }

    if (btnLimpiarConsola) {
        btnLimpiarConsola.addEventListener('click', () => {
            logContainer.innerHTML = '<p class="log-msg">Registro reiniciado...</p>';
        });
    }

    // ==============================================================================
    // 4. ACCIONES PRINCIPALES (COMPRA DEL MES, BÚSQUEDA RÁPIDA, EXCEL, LIMPIEZA)
    // ==============================================================================
    btnCompraMes.addEventListener('click', async () => {
        setRunningState(true);
        addLog('Iniciando proceso Compra del Mes...');
        try {
            const res = await fetch('/api/compra-mes', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                addLog(data.message);
            } else {
                addLog(`Error: ${data.message}`, true);
            }
        } catch (err) {
            addLog(`Error de conexión: ${err.message}`, true);
        } finally {
            setRunningState(false);
        }
    });

    // Búsqueda Rápida (Preserva el texto ingresado en input)
    async function ejecutarBusquedaRapida() {
        const producto = inputProducto.value.trim();
        if (!producto) {
            addLog("Por favor ingresa un producto antes de buscar.", true);
            return;
        }

        // Mostrar término buscado de forma clara y visible
        if (quickSearchTermBox && quickSearchTermVal) {
            quickSearchTermVal.textContent = producto;
            quickSearchTermBox.style.display = 'flex';
        }

        setRunningState(true);
        addLog(`Iniciando búsqueda rápida para: "${producto}"...`);

        try {
            const res = await fetch('/api/buscar-individual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ producto })
            });
            const data = await res.json();
            if (data.success) {
                addLog(data.message);
            } else {
                addLog(`Error: ${data.message}`, true);
            }
        } catch (err) {
            addLog(`Error de conexión: ${err.message}`, true);
        } finally {
            setRunningState(false);
        }
    }

    btnBuscarIndividual.addEventListener('click', ejecutarBusquedaRapida);

    inputProducto.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') ejecutarBusquedaRapida();
    });

    // Filtros visuales de búsqueda
    filterButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActivo = btn.getAttribute('data-filter');

            // Aplicar filtro visual a las tarjetas
            ['carrefour', 'coto', 'dia'].forEach((supKey) => {
                const card = document.getElementById(`card-${supKey}`);
                if (!card) return;
                if (filtroActivo === 'Todos') {
                    card.style.display = 'block';
                } else {
                    const match = (filtroActivo.toLowerCase().includes(supKey));
                    card.style.display = match ? 'block' : 'none';
                }
            });

            addLog(`Filtro aplicado: [${filtroActivo}]. Mostrando tiendas correspondientes.`);
        });
    });

    btnAbrirExcel.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/abrir-excel', { method: 'POST' });
            const data = await res.json();
            addLog(data.message);
        } catch (err) {
            addLog(`Error abriendo Excel: ${err.message}`, true);
        }
    });

    // Manejo de Modal de Limpieza
    btnLimpiar.addEventListener('click', () => limpiarModal.classList.add('active'));
    btnCerrarModal.addEventListener('click', () => limpiarModal.classList.remove('active'));

    btnsClean.forEach(btn => {
        btn.addEventListener('click', async () => {
            const tipo = btn.getAttribute('data-tipo');
            limpiarModal.classList.remove('active');
            setRunningState(true);
            try {
                const res = await fetch('/api/limpiar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tipo })
                });
                const data = await res.json();
                addLog(data.message);
            } catch (err) {
                addLog(`Error en limpieza: ${err.message}`, true);
            } finally {
                setRunningState(false);
            }
        });
    });


    // ==============================================================================
    // 5. GESTIÓN VISUAL DE LA CANASTA DEL MES (CRUD COMPLETO)
    // ==============================================================================
    async function cargarCanasta() {
        try {
            const res = await fetch('/api/canasta');
            const data = await res.json();
            if (data.success && Array.isArray(data.items)) {
                canastaActual = data.items;
            } else {
                canastaActual = [];
            }
            renderizarTablaCanasta();
        } catch (err) {
            mostrarCanastaFeedback('Error al cargar la canasta mensual.', true);
        }
    }

    function renderizarTablaCanasta() {
        canastaTbody.innerHTML = '';
        if (canastaActual.length === 0) {
            canastaTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">La canasta está vacía. ¡Agrega productos arriba!</td></tr>';
            return;
        }

        canastaActual.forEach((item, idx) => {
            const tr = document.createElement('tr');

            // Columna Producto (editable)
            const tdProd = document.createElement('td');
            const inputNom = document.createElement('input');
            inputNom.type = 'text';
            inputNom.value = item.producto;
            inputNom.className = 'canasta-input-cant';
            inputNom.style.width = '100%';
            inputNom.style.textAlign = 'left';
            inputNom.addEventListener('change', (e) => {
                const val = e.target.value.trim();
                if (val) item.producto = val;
            });
            tdProd.appendChild(inputNom);

            // Columna Cantidad (editable)
            const tdCant = document.createElement('td');
            tdCant.style.textAlign = 'center';
            const inputCant = document.createElement('input');
            inputCant.type = 'number';
            inputCant.min = '1';
            inputCant.value = item.cantidad || 1;
            inputCant.className = 'canasta-input-cant';
            inputCant.addEventListener('change', (e) => {
                const c = parseInt(e.target.value, 10);
                if (!isNaN(c) && c > 0) {
                    item.cantidad = c;
                } else {
                    e.target.value = item.cantidad || 1;
                }
            });
            tdCant.appendChild(inputCant);

            // Columna Acción Eliminar
            const tdAcc = document.createElement('td');
            tdAcc.style.textAlign = 'center';
            const btnDel = document.createElement('button');
            btnDel.className = 'btn-del-prod';
            btnDel.title = 'Eliminar producto';
            btnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
            btnDel.addEventListener('click', () => {
                canastaActual.splice(idx, 1);
                renderizarTablaCanasta();
            });
            tdAcc.appendChild(btnDel);

            tr.appendChild(tdProd);
            tr.appendChild(tdCant);
            tr.appendChild(tdAcc);
            canastaTbody.appendChild(tr);
        });
    }

    function mostrarCanastaFeedback(msg, isError = false) {
        if (!canastaFeedback) return;
        canastaFeedback.textContent = msg;
        canastaFeedback.className = `canasta-msg ${isError ? 'error' : 'success'}`;
        canastaFeedback.style.display = 'block';
        setTimeout(() => {
            if (canastaFeedback) canastaFeedback.style.display = 'none';
        }, 3500);
    }

    // Agregar producto a la lista local
    if (btnAgregarProd) {
        btnAgregarProd.addEventListener('click', () => {
            const nom = nuevoProdNombre.value.trim();
            const cant = parseInt(nuevoProdCant.value, 10);

            if (!nom) {
                mostrarCanastaFeedback('Por favor escribe el nombre del producto.', true);
                nuevoProdNombre.focus();
                return;
            }
            if (isNaN(cant) || cant <= 0) {
                mostrarCanastaFeedback('La cantidad debe ser un número entero mayor a 0.', true);
                nuevoProdCant.focus();
                return;
            }

            // Evitar duplicados acumulando cantidad
            const indexExist = canastaActual.findIndex(p => p.producto.toLowerCase() === nom.toLowerCase());
            if (indexExist >= 0) {
                canastaActual[indexExist].cantidad += cant;
                mostrarCanastaFeedback(`Se actualizó "${canastaActual[indexExist].producto}" a cantidad: ${canastaActual[indexExist].cantidad}`);
            } else {
                canastaActual.push({ producto: nom, cantidad: cant, modo: 'compra_mes' });
                mostrarCanastaFeedback(`"${nom}" (x${cant}) agregado a la canasta.`);
            }

            nuevoProdNombre.value = '';
            nuevoProdCant.value = '1';
            nuevoProdNombre.focus();
            renderizarTablaCanasta();
        });

        // Permitir agregar con Enter en los campos
        nuevoProdNombre.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnAgregarProd.click();
        });
        nuevoProdCant.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnAgregarProd.click();
        });
    }

    // Abrir modal de canasta
    if (btnEditarLista) {
        btnEditarLista.addEventListener('click', () => {
            editarModal.classList.add('active');
            cargarCanasta();
        });
    }

    if (btnCerrarEditarModal) {
        btnCerrarEditarModal.addEventListener('click', () => {
            editarModal.classList.remove('active');
        });
    }

    if (btnCerrarX) {
        btnCerrarX.addEventListener('click', () => {
            editarModal.classList.remove('active');
        });
    }

    // Guardar cambios en el backend / input.csv
    if (btnGuardarCanasta) {
        btnGuardarCanasta.addEventListener('click', async () => {
            if (canastaActual.length === 0) {
                mostrarCanastaFeedback('La canasta no puede estar vacía.', true);
                return;
            }

            try {
                const res = await fetch('/api/canasta', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productos: canastaActual })
                });
                const data = await res.json();
                if (data.success) {
                    mostrarCanastaFeedback(data.message);
                    addLog('Canasta mensual actualizada exitosamente con cantidades.');
                    setTimeout(() => {
                        editarModal.classList.remove('active');
                    }, 800);
                } else {
                    mostrarCanastaFeedback(data.message, true);
                }
            } catch (err) {
                mostrarCanastaFeedback(`Error al guardar: ${err.message}`, true);
            }
        });
    }
});
