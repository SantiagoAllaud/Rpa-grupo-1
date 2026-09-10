# Interfaz Gráfica para el Bot RPA (Web Dashboard)

¡Excelente idea! La consola negra (`ejecutar.bat`) es muy funcional, pero podemos llevar el proyecto al siguiente nivel construyendo una **Interfaz Web moderna y visualmente atractiva** que funcione localmente en tu computadora.

## Propuesta de Cambios

Vamos a crear un servidor web local liviano y una página web hermosa para controlar el bot con botones en lugar de comandos.

### 1. Servidor Backend (Node.js + Express)
- **[NUEVO]** `server.js`: Crearemos un pequeño servidor web utilizando Express.
- Este servidor se encargará de recibir los clics de los botones en la página web y traducirlos a comandos reales en tu computadora (ejecutará TagUI y los validadores por detrás usando `child_process`).
- Instalaremos `express` en tu proyecto (`npm install express`).

### 2. Frontend Moderno (HTML + CSS + JS)
- Crearemos una carpeta `public/` con los archivos visuales.
- **[NUEVO]** `public/index.html`: La estructura del panel de control (Dashboard).
- **[NUEVO]** `public/styles.css`: Utilizaremos **Glassmorphism**, paletas de colores vibrantes sobre fondo oscuro (Dark Mode), y animaciones fluidas para que se vea como un software *Premium*.
- **[NUEVO]** `public/app.js`: Para conectar los botones de la interfaz con el servidor, y mostrar un indicador de "Cargando..." mientras el bot de TagUI está trabajando en los supermercados.

### 3. Nuevo Lanzador
- **[NUEVO]** `interfaz.bat`: Crearemos un nuevo archivo de arranque que encenderá el servidor y automáticamente abrirá tu navegador (Google Chrome) apuntando a `http://localhost:3000` para que veas la interfaz de inmediato.

## Verificación Planificada

- Se verificará que el servidor inicie correctamente.
- Se probará la ejecución de la "Búsqueda Individual" y la "Compra del Mes" haciendo clic en los botones de la nueva página web y confirmando que TagUI se abre y procesa los datos tal como lo hacía desde el menú de la consola.

---

> [!IMPORTANT]
> **Revisión del Usuario Requerida**
> Revisa este plan. Si estás de acuerdo con llevar el control a una página web hermosa, aprueba este plan y comenzaré a codificar el servidor y la interfaz visual paso a paso.
