document.addEventListener('DOMContentLoaded', () => {
    const btnCompraMes = document.getElementById('btn-compra-mes');
    const btnBuscarIndividual = document.getElementById('btn-buscar-individual');
    const inputProducto = document.getElementById('input-producto');
    const btnAbrirExcel = document.getElementById('btn-abrir-excel');
    const btnLimpiar = document.getElementById('btn-limpiar');
    
    const logContainer = document.getElementById('log-container');
    const statusIndicator = document.getElementById('status-indicator');
    
    const modal = document.getElementById('limpiar-modal');
    const btnCerrarModal = document.getElementById('btn-cerrar-modal');
    const btnsClean = document.querySelectorAll('.btn-clean');

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
        const btns = document.querySelectorAll('button:not(#btn-cerrar-modal)');
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
                if (data.output) {
                    const lines = data.output.split('\n').slice(-5); // Mostrar ultimas 5 lineas
                    lines.forEach(l => { if(l.trim()) addLog(l) });
                }
            } else {
                addLog(`Error: ${data.message}`, true);
            }
        } catch (error) {
            addLog(`Error de conexión: ${error.message}`, true);
        } finally {
            setRunningState(false);
        }
    }

    // Eventos
    btnCompraMes.addEventListener('click', () => {
        executeAction('/api/compra-mes');
    });

    btnBuscarIndividual.addEventListener('click', () => {
        const producto = inputProducto.value.trim();
        if (!producto) {
            addLog("Por favor ingresa un producto antes de buscar.", true);
            return;
        }
        executeAction('/api/buscar-individual', { producto });
    });

    // Permitir buscar con ENTER
    inputProducto.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnBuscarIndividual.click();
    });

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
});
