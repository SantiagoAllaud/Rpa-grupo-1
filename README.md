# 📌 UTN FRCU – Tecnologías para la Automatización 2026
## 📋 Trabajo Práctico Integrador – Etapa 1: RPA

### 👥 Equipo
- **Integrantes:**
  - *[Completar con los nombres de los integrantes del grupo]*

---

## 🤖 1. Descripción del Bot y Proceso de Negocio

### 🎯 Objetivo y Alcance
El objetivo de este desarrollo RPA es automatizar la consulta y extracción de precios de productos de consumo masivo en tres de las principales cadenas de supermercados con presencia online en Argentina:
- **Carrefour** (`https://www.carrefour.com.ar`)
- **COTO** (`https://www.coto.com.ar`)
- **Día %** (`https://diaonline.supermercadosdia.com.ar`)

El bot toma como entrada una lista de términos de búsqueda provista en un archivo local `input.csv`, controla el navegador Google Chrome para ingresar a cada plataforma, localiza el primer resultado relevante y extrae la información textual disponible en el DOM (Document Object Model). Finalmente, consolida los registros en un archivo estructurado `resultados.csv`.

### 🔄 Diagrama del Flujo de Trabajo
```
  [ input.csv ] (Lista de productos)
        │
        ▼ (Lee productos)
 ┌──────────────────────────────────────────────────────────┐
 │  1. AUTOMATIZACIÓN RPA (TagUI + Google Chrome)           │
 │                                                          │
 │    ┌─────────────┐   Control    ┌─────────────────┐      │
 │    │    TagUI    │ ───────────► │  Google Chrome  │      │
 │    │  Script.tag │              └────────┬────────┘      │
 │    └─────────────┘                       │ Búsqueda      │
 │           ▲                              ▼               │
 │           │                     ┌─────────────────┐      │
 │           │ URL del producto    │ Supermercados:  │      │
 │           └──────────────────── │  - Carrefour    │      │
 │                                 │  - COTO         │      │
 │                                 │  - Día %        │      │
 │                                 └────────┬────────┘      │
 │                                          │               │
 │                                 Extracción DOM:          │
 │                                 Nombre y Precio          │
 └──────────────────────────────────────────┼───────────────┘
                                            │ (Guarda resultados)
                                            ▼
                                   [ resultados.csv ]
                    (Nombre · Precio · Supermercado · URL · Fecha)
```

### 🔒 Restricciones y Controles de Calidad
- **Restricciones iniciales:** Requiere conexión a Internet estable y Google Chrome instalado. Se enfoca exclusivamente en la extracción de datos textuales del DOM público sin necesidad de iniciar sesión o realizar compras.
- **Restricciones a largo plazo:** Los sitios web de e-commerce pueden actualizar sus estructuras DOM, nombres de clases CSS o modificar sus URLs de búsqueda.
- **Controles implementados:**
  - Control de flujo condicional con `if present(...)` para detectar banners de privacidad y cookies (ej. OneTrust en Carrefour) y cerrarlos sin interferir con la navegación.
  - Bloques de extracción tolerantes a fallos (`try/catch` o validación de nodos en JavaScript/DOM) para asignar `"No encontrado / Sin stock"` y evitar que el bot se detenga si un producto no existe en algún catálogo.
  - Limpieza de saltos de línea y formateo estándar de CSV utilizando la función nativa `csv_row(...)` de TagUI.

---

## ⚙️ 2. Justificación de la Herramienta Seleccionada: TagUI

Entre las opciones analizadas durante la cursada (UiPath, Automation Anywhere, TagUI, etc.), se seleccionó **TagUI** debido a los siguientes factores:
1. **Open Source y Gratuita:** Desarrollada por AI Singapore, no requiere suscripciones mensuales, cuentas corporativas ni periodos de prueba limitados (a diferencia de licencias como UiPath o Power Automate).
2. **Sintaxis Clara y Expresiva:** Utiliza lenguaje natural ("pseudo-código") en texto plano, lo que reduce la curva de aprendizaje y permite que el código fuente sea comprendido y mantenido rápidamente por terceros.
3. **Manejo Nativo de Datatables CSV:** Permite ejecutar flujos por lotes (`tagui script.tag input.csv`) donde cada fila se asigna directamente a variables de contexto, sin código boilerplate.
4. **Control Directo de Chrome e Inyección en el DOM:** Interactúa con Google Chrome mediante el Chrome DevTools Protocol (CDP) e inyecta JavaScript directamente sobre la página web, facilitando la extracción de componentes en Single Page Applications (Angular, React, VTEX).

---

## 🛠️ 3. Instructivo de Instalación y Requisitos

Para reproducir este proyecto en cualquier computadora con Windows, seguir estos sencillos pasos:

### Requisitos Previos
- **Google Chrome** instalado.
- Conexión a Internet activa.

### Paso 1: Descargar TagUI
1. Descargar la versión para Windows desde el repositorio oficial:
   - Enlace directo: [TagUI_Windows.zip](https://github.com/aisingapore/tagui/releases/download/v6.110.0/TagUI_Windows.zip)
2. Descomprimir el archivo en una ubicación estable en el disco, por ejemplo:
   - `C:\tagui`  o  `C:\Users\<TuUsuario>\tagui`

### Paso 2: Agregar TagUI al PATH del Sistema
1. En la barra de búsqueda de Windows escribir **"Editar las variables de entorno del sistema"** y abrirla.
2. Hacer clic en el botón **"Variables de entorno..."**.
3. En la sección **"Variables de usuario"** (o del sistema), seleccionar la variable `Path` y hacer clic en **"Editar..."**.
4. Hacer clic en **"Nuevo"** y pegar la ruta a la subcarpeta `src` de TagUI, por ejemplo:
   - `C:\tagui\src` (o `C:\Users\<TuUsuario>\tagui\src`).
5. Aceptar todas las ventanas para guardar los cambios.

### Paso 3: Verificar la Instalación
Abrir un nuevo terminal (Símbolo del sistema o PowerShell) y ejecutar:
```cmd
tagui
```
Debe mostrarse en pantalla el mensaje de ayuda de TagUI indicando su versión (`tagui v6.110`).

---

## 🚀 4. Modo de Uso

### Archivo de Entrada (`input.csv`)
En la misma carpeta del programa se encuentra el archivo `input.csv`. Para buscar nuevos productos, simplemente agregar los nombres deseados debajo de la cabecera `producto`:
```csv
producto
yerba
leche
arroz
fideos
aceite
```

### Ejecución de la Automatización
Existen dos formas sencillas de ejecutar el bot:

#### Opción A: Mediante el ejecutor directo (`ejecutar.bat`)
Hacer doble clic en `ejecutar.bat` o ejecutarlo desde la terminal:
```cmd
ejecutar.bat
```
El script presentará un menú para elegir entre:
1. **Procesar la lista completa de `input.csv`**.
2. **Ingresar un producto específico manualmente** (ej: `café`, `azúcar`, `yerba`).

También puedes pasarle el producto directamente por argumento:
```cmd
ejecutar.bat "yerba mate"
```

#### Opción B: Directamente con TagUI
Abrir una terminal en la carpeta `Rpa programa` y ejecutar:
```cmd
tagui supermercados.tag input.csv
```
*(Nota: Para ejecutarlo en segundo plano sin abrir visualmente la ventana de Chrome, se puede agregar el modificador `-h`: `tagui supermercados.tag input.csv -h`).*

### Salida Generada (`resultados.csv`)
Al finalizar la ejecución, se generará o actualizará el archivo `resultados.csv` con el siguiente formato:
```csv
Nombre,Precio,Supermercado,URL,Fecha
Yerba mate Playadito suave con palo 1 kg.,"$ 5.209,00",Carrefour,https://www.carrefour.com.ar/yerba-mate-playadito-suave-con-palo-1-kg-714088/p,2026-09-04
Yerba Mate 4 Flex Mañanita Paq 1 Kgm,"$5.370,00",COTO,https://www.coto.com.ar/productos/yerba-mate-4-flex-mananita-paq-1-kgm-/_/R-00499475-00499475-200,2026-09-04
Yerba Mate Mañanita 4 Flex 1 Kg.,$ 3.790,Día %,https://diaonline.supermercadosdia.com.ar/yerba,2026-09-04
```

---

## 📚 5. Vinculación con Conceptos Teóricos de la Materia

En el diseño e implementación del bot se aplicaron los siguientes conceptos teóricos vistos en la cátedra:

### 1. Sistema de Control de Lazo Cerrado y Retroalimentación (Feedback)
Un sistema de lazo abierto ejecuta acciones sin evaluar el resultado de las etapas intermedias. En este desarrollo, el bot implementa un **lazo cerrado con retroalimentación sensorial (DOM)**:
- Antes de intentar extraer un elemento, el sistema mide el estado actual del DOM (`if present(...)`).
- Si se detecta una condición anómala (como un diálogo de consentimiento de cookies que bloquea la interacción), la señal de error genera una acción de corrección inmediata (`click Aceptar todo`) antes de proseguir con el proceso principal.
- Si un selector no devuelve elementos (por ejemplo, ante una búsqueda sin coincidencias), el comparador detecta la ausencia del dato y activa una rutina de manejo seguro (`"No encontrado / Sin stock"`), garantizando la continuidad operativa del sistema.

### 2. Perturbaciones Exógenas y Endógenas
Todo sistema de automatización opera en un entorno sujeto a variaciones no deseadas que pueden desviar la salida esperada:
- **Perturbaciones Exógenas:** Provienen del entorno externo al sistema de control. En este caso:
  - Variaciones en la latencia o pérdida de paquetes de la conexión a Internet.
  - Aparición imprevista de banners publicitarios o modales de cookies.
  - Modificaciones en la estructura HTML o nombres de clases CSS aplicadas por los desarrolladores de los supermercados.
- **Perturbaciones Endógenas:** Se originan dentro del propio sistema o de sus fuentes de datos:
  - Registros vacíos, caracteres especiales o palabras mal redactadas en el archivo local `input.csv`.
  - Fallas de compatibilidad de tipos durante el procesamiento de cadenas o números en el script.

### 3. Dinámica Transitoria y Error en Estado Estable ($e_{ss}$)
Las plataformas web modernas (Carrefour con VTEX IO, COTO con Angular SPA) utilizan renderizado asíncrono en el cliente:
- Al ingresar a una URL, el navegador experimenta una **respuesta transitoria**: se descargan scripts, se ejecutan peticiones API y los componentes gráficos se van ensamblando progresivamente en la pantalla.
- Si el robot intentara leer el DOM inmediatamente tras la navegación (tiempo $t \approx 0$), el sistema se encontraría en estado transitorio y los elementos aún no existirían, arrojando un error de lectura.
- Para asegurar un **error en estado estable nulo ($e_{ss} \to 0$)**, se introducen tiempos de estabilización controlados (`wait`) que permiten amortiguar las oscilaciones de carga y garantizar que la lectura de nombres y precios ocurra cuando el sistema haya alcanzado su estado de régimen permanente.

---

## 🔮 6. Propuesta de Mejora para la Etapa 2

Para garantizar que el grupo que reciba este proyecto en la **Etapa 2** pueda extenderlo y mejorarlo de forma sustancial, se documenta la siguiente propuesta de mejora:

### 📢 Módulo de Notificaciones Automáticas (Telegram / Discord)
- **Problemática actual:** En la Etapa 1, los resultados se almacenan únicamente de manera pasiva en el archivo local `resultados.csv`. El usuario debe inspeccionar manualmente el archivo para comparar precios o enterarse si se encontraron los productos.
- **Mejora propuesta:** Implementar un canal de salida activo mediante un bot de mensajería (vía webhook de Discord o Bot API de Telegram).
  - Al procesar cada producto o al finalizar la ejecución del lote, el sistema evaluará automáticamente cuál supermercado ofrece el menor precio para cada artículo.
  - El bot enviará un mensaje enriquecido al canal o chat configurado, detallando el producto más conveniente, la diferencia porcentual de ahorro y el enlace directo para realizar la compra.
  - Asimismo, podrá enviar alertas de error o notificar si algún producto clave se encuentra agotado en todas las cadenas.
