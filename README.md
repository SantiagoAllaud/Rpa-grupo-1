# 🛒 Comparador RPA Inteligente de Precios: Supermercados Argentinos
## UTN FRCU – Tecnologías para la Automatización (Año 2026)
### Trabajo Práctico Integrador – Etapa 1: Automatización Robótica de Procesos (RPA)

---

### 👥 Equipo de Trabajo (Grupo 1)
- **Lourdes Alvarez**
- **Florencia Carballo**
- **Alexander Ramos**
- **Juan Martín Cruz**
- **Santiago Manuel Allaud**

---

## 📑 Tabla de Contenidos
1. [Nombre del Proyecto y Objetivo Principal](#1-nombre-del-proyecto-y-objetivo-principal)
2. [Descripción General y Caso de Negocio](#2-descripción-general-y-caso-de-negocio)
3. [Supermercados Consultados y Especificidades Técnicas](#3-supermercados-consultados-y-especificidades-técnicas)
4. [Estructura Exacta del Proyecto](#4-estructura-exacta-del-proyecto)
5. [Arquitectura y Diagramas de Flujo ASCII](#5-arquitectura-y-diagramas-de-flujo-ascii)
6. [Instructivo de Instalación y Requisitos](#6-instructivo-de-instalación-y-requisitos)
7. [Modo Compra del Mes (Uso Detallado)](#7-modo-compra-del-mes-uso-detallado)
8. [Modo Búsqueda Individual (Uso Detallado)](#8-modo-búsqueda-individual-uso-detallado)
9. [Reglas de Validación Estricta y Detección de Intención](#9-reglas-de-validación-estricta-y-detección-de-intención)
10. [Explicación de las 4 Hojas del Reporte Excel](#10-explicación-de-las-4-hojas-del-reporte-excel)
11. [Manejo de Productos Sin Stock](#11-manejo-de-productos-sin-stock)
12. [Diferenciación entre Estados de Disponibilidad](#12-diferenciación-entre-estados-de-disponibilidad)
13. [Funcionamiento del Historial y Persistencia](#13-funcionamiento-del-historial-y-persistencia)
14. [Opciones de Limpieza y Mantenimiento](#14-opciones-de-limpieza-y-mantenimiento)
15. [Troubleshooting y Problemas Frecuentes](#15-troubleshooting-y-problemas-frecuentes)
16. [Ejemplo Completo Paso a Paso: Compra del Mes](#16-ejemplo-completo-paso-a-paso-compra-del-mes)
17. [Ejemplos de Búsqueda Individual: Específica vs Genérica](#17-ejemplos-de-búsqueda-individual-específica-vs-genérica)
18. [Vinculación con Conceptos Teóricos de Control y Automatización](#18-vinculación-con-conceptos-teóricos-de-control-y-automatización)

---

## 1. Nombre del Proyecto y Objetivo Principal

**Nombre:** *Comparador RPA Inteligente de Precios y Optimizador de Canasta de Consumo Masivo.*

**Objetivo Principal:** Automatizar mediante RPA (Robotic Process Automation) y Node.js la recolección, validación semántica, comparación y optimización de precios en tiempo real sobre los principales supermercados con plataforma online de Argentina (**Carrefour**, **COTO** y **Día %**), proporcionando una toma de decisiones informada tanto para la **compra planificada del mes** como para **consultas individuales inmediatas**, evitando falsos positivos mediante validación estricta de marcas y atributos.

---

## 2. Descripción General y Caso de Negocio

En el contexto económico argentino, la dispersión de precios para un mismo producto o categoría entre distintas cadenas minoristas supera frecuentemente el 30% o 40%. Comparar manualmente decenas de artículos navegando múltiples portales web demanda un tiempo considerable y suele inducir a errores por diferencias de presentación, empaques o sustituciones no deseadas.

Este bot RPA actúa como un agente inteligente de software que:
1. **Navega de forma autónoma** los catálogos públicos de las tiendas online utilizando Google Chrome y TagUI.
2. **Extrae en tiempo real** el nombre exacto del artículo, precio vigente, enlace directo a la publicación y estado de stock en el DOM.
3. **Evalúa semánticamente** la coincidencia a través de un motor de validación (`validador.js`) que distingue entre búsquedas específicas (marca, variedad, tamaño) y búsquedas genéricas (categoría abierta).
4. **Calcula la canasta económica óptima**: Determina el supermercado ganador por costo total acumulado (ponderando cantidades requeridas) y calcula el ahorro máximo posible comprando cada artículo en su tienda más barata.
5. **Consolida la información** en dos formatos: persistencia estructurada (`resultados.csv` de 9 columnas) y un reporte analítico visual de 4 hojas en Microsoft Excel (`reporte_supermercados.xlsx`).

---

## 3. Supermercados Consultados y Especificidades Técnicas

El robot opera sobre tres plataformas con arquitecturas web y motores de renderizado frontend diferentes:

| Supermercado | URL Base | Tecnología Frontend | Retos Técnicos y Selectores DOM |
| :--- | :--- | :--- | :--- |
| **Carrefour Argentina** | `https://www.carrefour.com.ar` | VTEX IO (React SPA) | Renderizado asíncrono. Banner de privacidad OneTrust (`if present('Aceptar todo') click`). Nombre en `[class*="productBrand"]` o `[data-testid="product-summary-name"]`. Precio en `[class*="sellingPrice"]`. Detección de clase `unavailable` para artículos agotados. |
| **COTO Digital** | `https://www.coto.com.ar` | Angular SPA | Componente web custom `<constructor-result-item>`. Título en `.nombre-producto`. Precio en `.card-title`. Detección de botón inactivo o texto `"Sin stock"` / `"Agotado"`. |
| **Supermercados Día %** | `https://diaonline.supermercadosdia.com.ar` | VTEX IO | Contenedor en `<article>`. Marca y título en `<h3>` o `[class*="productBrand"]`. Precio en `[class*="sellingPrice"]` o parseo directo de nodo de texto con `$`. Identificación de badges `"Agotado"` y ausencia de botón de compra. |

---

## 4. Estructura Exacta del Proyecto

```
Rpa programa/
├── ejecutar.bat                # Lanzador por lotes interactivo con menú de 6 opciones y diagnóstico para Windows.
├── interfaz.bat                # Lanzador de la interfaz web moderna con servidor local Node.js.
├── server.js                   # Servidor Express con Server-Sent Events (SSE) para streaming en vivo del RPA.
├── public/                     # Frontend moderno (index.html, styles.css, app.js) con monitor y CRUD visual.
├── supermercados.tag           # Script central de automatización TagUI (control de Chrome y extracción DOM).
├── validador.js                # Motor de validación semántica, manejo de cantidades y suite de 20 tests.
├── generar_excel.js            # Generador del reporte profesional en Excel (4 hojas con estilos y KPIs).
├── input.csv                   # Archivo editable con la canasta mensual (formato: producto,cantidad,modo).
├── resultados.csv              # Persistencia estructurada (9 columnas: modo, producto, precio, stock, cantidad, etc.).
├── reporte_supermercados.xlsx  # Reporte final visual consolidado en 4 hojas analíticas.
├── package.json                # Dependencias del proyecto (exceljs, express, cors).
├── package-lock.json           # Bloqueo de versiones de dependencias.
├── node_modules/               # Módulos instalados de Node.js.
├── .gitignore                  # Exclusión de temporales, logs y node_modules para control de versiones.
└── README.md                   # Documentación técnica integral del proyecto.
```

### Detalle de Responsabilidad por Archivo:
- **`ejecutar.bat`**: Menú amigable en Windows (soporta UTF-8 y codificación CRLF). Incluye validaciones previas de entorno (TagUI en PATH, Node.js, npm, ExcelJS y archivos esenciales). Ofrece 6 opciones: Compra del Mes, Búsqueda Individual, Abrir Excel (4 hojas), Limpieza de Historial, Diagnóstico del Sistema con suite de pruebas, y Salir.
- **`interfaz.bat` / `server.js`**: Servidor web local en puerto 3000 con endpoints REST y streaming SSE (`/api/stream`) para visualizar paso a paso y en vivo las decisiones del bot, estado de tiendas y modal CRUD visual de canasta mensual sin tocar CSV crudo.
- **`supermercados.tag`**: Realiza la automatización de la interfaz gráfica web en Google Chrome. Extrae datos limpios del DOM, ordena candidatos válidos de menor a mayor precio y persiste cada registro con 9 columnas (`cantidad` incluida) en `resultados.csv`.
- **`validador.js`**: Normaliza cadenas, reconoce marcas y presentaciones estrictas (ej: 2.25L vs 2L o 1.5L), parsea y guarda `input.csv` en formato `producto,cantidad,modo`, asocia cantidades a resultados y ejecuta 20 tests automatizados (`node validador.js --test`).
- **`generar_excel.js`**: Procesa `resultados.csv` mediante la librería `exceljs`. Realiza el análisis matemático considerando multiplicadores de cantidad (`precio * cantidad`), generando un archivo `.xlsx` estilizado de exactamente 4 hojas.
- **`input.csv`**: Lista de artículos de la compra mensual con formato `producto,cantidad,modo`. Compatible con el formato clásico de 2 columnas `producto,modo` asumiendo cantidad 1.

---

## 5. Arquitectura y Diagramas de Flujo ASCII

### Arquitectura General del Sistema
```
                          ┌───────────────────────────────┐
                          │          ejecutar.bat         │
                          │        (Menú Principal)       │
                          └───────────────┬───────────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   ▼                                             ▼
        [1] COMPRA DEL MES                           [2] BÚSQUEDA INDIVIDUAL
     - Lee lista de entrada:                        - Solicita término por consola
       input.csv (totalmente editable)              - NO modifica input.csv
     - Ejecuta TagUI (modo 'compra_mes')            - Ejecuta TagUI (modo 'individual')
                   │                                             │
                   └──────────────────────┬──────────────────────┘
                                          ▼
                          ┌───────────────────────────────┐
                          │       supermercados.tag       │
                          │    TagUI + Google Chrome      │
                          │  - Carrefour (VTEX)           │
                          │  - COTO (Angular SPA)         │
                          │  - Día % (VTEX)               │
                          │  - Extracción de Nombre,      │
                          │    Precio, URL y Stock        │
                          └───────────────┬───────────────┘
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │         validador.js          │
                          │  - Detección de Intención     │
                          │    (Específica vs Genérica)   │
                          │  - Validación de Marca,       │
                          │    Categoría y Presentación   │
                          │  - Clasificación de Estado:   │
                          │    VALIDADA / NO VÁLIDA /     │
                          │    SIN STOCK / NO ENCONTRADO  │
                          └───────────────┬───────────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   ▼                                             ▼
          Terminal en Vivo                               Persistencia Local
     (Muestra precios, validación,                         resultados.csv
      ganador y ahorro en pantalla)                   (9 columnas con cantidades)
                                                                 │
                                                                 ▼
                                                      ┌─────────────────────┐
                                                      │  generar_excel.js   │
                                                      │  - Subtotales (P*Q) │
                                                      │  - Compra Óptima    │
                                                      │  - Historial        │
                                                      │  - Stock & Rechazos │
                                                      └──────────┬──────────┘
                                                                 ▼
                                                    reporte_supermercados.xlsx
                                                    (4 Hojas con diseño pro)
```

### Flujo del Modo Búsqueda Individual
```
  [Usuario ingresa término] ──► "Gaseosa Secco Pomelo"
              │
              ▼
   Crea temp_input.csv (input.csv queda INTACTO)
              │
              ▼
   TagUI consulta Carrefour, COTO y Día %
              │
              ▼
   validador.js analiza resultados:
     • Carrefour devolvió "Shampoo Dove" ──► ❌ COINCIDENCIA NO VÁLIDA (Categoría ajena)
     • COTO devolvió "Pomelo Rojo Xkg"    ──► ❌ COINCIDENCIA NO VÁLIDA (Fruta por kg)
     • Día % devolvió "Shampoo Pantene"   ──► ❌ COINCIDENCIA NO VÁLIDA (Categoría ajena)
              │
              ▼
   Alerta en Terminal / Web: "Ningún supermercado arrojó coincidencia válida. No se sustituyó."
              │
              ▼
   Actualiza resultados.csv y reporte_supermercados.xlsx (Hojas 3 y 4)
```

---

## 6. Instructivo de Instalación y Requisitos

### Requisitos Previos
1. **Sistema Operativo:** Windows 10 o Windows 11 (64-bit).
2. **Google Chrome:** Navegador instalado en su ubicación por defecto.
3. **Node.js:** Versión 18 o superior instalada (verificar con `node -v` en consola).

### Paso 1: Descargar e Instalar TagUI
1. Descargar el paquete oficial de TagUI para Windows:
   - [TagUI_Windows.zip](https://github.com/aisingapore/tagui/releases/download/v6.110.0/TagUI_Windows.zip)
2. Descomprimir el contenido en una carpeta sin espacios ni caracteres especiales, por ejemplo:
   `C:\tagui`  o  `C:\Users\<TuUsuario>\tagui`

### Paso 2: Configurar la Variable de Entorno PATH
1. Presionar la tecla `Windows` y escribir **"variables de entorno"**.
2. Seleccionar **"Editar las variables de entorno de esta cuenta"** (o del sistema).
3. En la lista de variables de usuario, hacer doble clic en `Path`.
4. Hacer clic en **"Nuevo"** y añadir la ruta a la subcarpeta `src` de TagUI:
   `C:\tagui\src` (o la ruta donde se descomprimió).
5. Hacer clic en **Aceptar** en todas las ventanas.

### Paso 3: Clonar el Repositorio e Instalar Dependencias
Abrir una terminal (PowerShell o CMD) y ejecutar:
```cmd
git clone https://github.com/SantiagoAllaud/Rpa-grupo-1.git
cd "Rpa-grupo-1/Rpa programa"
npm install
```
*(Esto instalará `exceljs` y dependencias adicionales como `express`).*

### Paso 4: Iniciar la Interfaz Gráfica Web (¡Recomendado!)
Para utilizar el nuevo **Dashboard Web** con botones y diseño moderno:
1. Haz doble clic en el archivo `interfaz.bat`.
2. Esto encenderá el servidor y abrirá automáticamente tu navegador web apuntando a `http://localhost:3000`.
3. Desde la web podrás controlar todo el bot sin usar la consola negra (Búsqueda Individual, Compra del Mes, Limpieza, etc).

*(Nota: Si prefieres la consola de texto clásica, sigue utilizando `ejecutar.bat` en su lugar).*

---

## 7. Modo Compra del Mes (Uso Detallado)

El modo **Compra del Mes** está diseñado para calcular el abastecimiento mensual regular de la familia.

1. Abrir el archivo `input.csv` con cualquier editor de texto o Excel.
2. Ingresar la lista de artículos a cotizar:
   ```csv
   producto,modo
   leche,compra_mes
   arroz,compra_mes
   fideos,compra_mes
   aceite,compra_mes
   yerba,compra_mes
   azucar,compra_mes
   cafe,compra_mes
   galletitas,compra_mes
   papel higienico,compra_mes
   ```
3. Ejecutar `ejecutar.bat` y seleccionar la opción `[1]`.
4. El bot recorrerá cada producto en Carrefour, COTO y Día %, extraerá los precios y generará el reporte en Excel.
5. Al finalizar, abrirá automáticamente `reporte_supermercados.xlsx` mostrando:
   - Cuál supermercado es el más barato para comprar la **canasta completa**.
   - Cuál es el costo total si se opta por una **compra combinada óptima**.
   - El ahorro total potencial obtenido.

---

## 8. Modo Búsqueda Individual (Uso Detallado)

El modo **Búsqueda Individual** permite consultar el precio y disponibilidad de cualquier artículo puntual en los tres supermercados sin modificar el archivo `input.csv`.

1. Ejecutar `ejecutar.bat` y elegir la opción `[2]` (o tipear directamente el nombre del producto en el prompt del menú).
2. Ingresar el producto deseado (ejemplo: `leche la serenisima`, `fideos`, `gaseosa secco pomelo`).
3. El bot ejecuta la automatización en Chrome mediante un archivo temporal `temp_input.csv` que se elimina inmediatamente.
4. En la terminal se despliega un reporte inmediato con los precios, el estado de validación para cada tienda, el ganador y el ahorro.
5. Los resultados se añaden al historial en `resultados.csv` y se actualiza el Excel, abriéndolo en pantalla.

---

## 9. Reglas de Validación Estricta y Detección de Intención

Para evitar que el bot compare productos absurdos cuando una tienda no tiene stock, `validador.js` implementa un motor de inferencia semántica con dos comportamientos:

### A) Búsqueda Específica (`ESPECIFICA`)
Se activa cuando la consulta incluye una **marca conocida** (ej: *Secco*, *Coca Cola*, *Playadito*, *La Serenísima*, *Lucchetti*), una **presentación exacta** (ej: *2.25L*, *1Kg*) o múltiples atributos concretos.
- **Regla de Marca:** La marca solicitada **debe** estar presente en el título devuelto por la tienda. Si no coincide, el resultado es clasificado como `COINCIDENCIA NO VÁLIDA`.
- **Regla de Categoría:** Se bloquean cruces incoherentes (por ejemplo, ante la búsqueda de una bebida, se rechazan frutas por kilo, verduras o artículos de tocador).
- **Regla de Presentación:** Si se indicó tamaño (ej: *2.25l*), se rechazan envases muy lejanos (ej: *600ml*).
- **Ejemplo:** Ante la búsqueda `"Gaseosa Secco Pomelo"`:
  - COTO devuelve `"Pomelo Rojo . Xkg"` (fruta) ➔ **Rechazado** (`COINCIDENCIA NO VÁLIDA`).
  - Carrefour devuelve `"Shampoo Dove..."` ➔ **Rechazado** (`COINCIDENCIA NO VÁLIDA`).
  - Día % devuelve `"Shampoo Pantene..."` ➔ **Rechazado** (`COINCIDENCIA NO VÁLIDA`).
  - **Resultado:** Ningún supermercado gana. El sistema no inventa sustitutos.

### B) Búsqueda Genérica (`GENERICA`)
Se activa cuando la consulta no menciona marcas particulares (ej: *arroz*, *leche*, *fideos*, *bebida de naranja*).
- **Regla:** Se valida que el producto pertenezca a la categoría solicitada (y al sabor si fue especificado).
- Permite comparar entre distintas marcas del mercado para encontrar la alternativa más económica.
- **Ejemplo:** Ante `"bebida de naranja"`:
  - Carrefour ofrece Levité Naranja ($ 2.100).
  - COTO ofrece Baggio Naranja ($ 1.850).
  - Día % ofrece Cepita Naranja ($ 2.450).
  - Todos son validados como alternativas aceptables y gana COTO por menor precio.

---

## 10. Explicación de las 4 Hojas del Reporte Excel

El archivo `reporte_supermercados.xlsx` cuenta con exactamente 4 pestañas profesionales con formato condicional, fórmulas y ponderación matemática por cantidades:

### Hoja 1: 🏆 Conclusiones
- **Tarjetas KPI:** Muestra el Supermercado Recomendado para la canasta completa ponderada, el Costo Total de la Canasta Ganadora, el Costo de la Compra Combinada Óptima y el Ahorro Máximo Potencial.
- **Tabla de Evaluación por Supermercado:** Compara el costo total acumulado (`∑ precio * cantidad`), cantidad de productos con stock y cantidad de ítems ganados por cada tienda.
- **Tabla de Ganadores por Producto:** Detalla el producto más barato para cada ítem, con cantidad solicitada, precio unitario, subtotal ponderado y enlace web directo.
- **⚠️ Sección Productos con Problemas:** Cuadro visible integrado directamente en Conclusiones que consolida métricas críticas (total problemas, faltantes de stock, rechazos semánticos) y lista cada incidencia con su motivo.
- **Bloque Narrativo:** Resumen ejecutivo redactado por el bot con recomendaciones para el comprador.

### Hoja 2: 🛒 Canasta Mensual
- **Matriz Comparativa Horizontal:** Filas por artículo solicitado con columna explícita de **Cantidad**.
- **Cálculo de Subtotales Reales:** Cada celda computa y visualiza tanto el precio unitario relevado como el subtotal ponderado (`precio * cantidad`).
- **Celdas en Verde Pastel:** Resaltan visualmente la celda del supermercado que ofrece el menor precio válido en cada fila.
- **Fila Total al Pie:** Suma ponderada del costo de canasta por supermercado, costo de compra óptima combinada y ahorro total.

### Hoja 3: 🔎 Consultas Individuales
- **Historial de Búsquedas Unitarias:** Registra cada consulta interactiva realizada desde la terminal o frontend web, con fecha, supermercado, producto devuelto, precio, validación y link directo.

### Hoja 4: ⚠️ Disponibilidad y Stock
- **Control de Calidad y Auditoría Técnica:** Detalle exhaustivo de todas las incidencias registradas:
  - Artículos sin stock (`SIN STOCK`).
  - Artículos inexistentes en el catálogo (`NO ENCONTRADO`).
  - Productos descartados por validación semántica o de presentación (`COINCIDENCIA NO VÁLIDA`) con la justificación técnica del descarte.

---

## 11. Manejo de Productos Sin Stock

Cuando un producto está agotado en la tienda online:
1. El script `supermercados.tag` inspecciona selectores DOM como botones deshabilitados, etiquetas `"Agotado"`, `"Sin stock"` o clases CSS `unavailable`.
2. Asigna el estado `SIN STOCK` en `resultados.csv`.
3. El módulo `validador.js` excluye automáticamente ese producto de la competencia por el precio más bajo, evitando que una oferta ficticia sin stock gane la comparativa.
4. Se registra tanto en la sección de problemas de la **Hoja 1 (Conclusiones)** como en la **Hoja 4 (Disponibilidad y Stock)** del Excel para total advertencia del usuario.

---

## 12. Diferenciación entre Estados de Disponibilidad

El sistema tipifica con rigor cuatro estados posibles para cada consulta:

| Estado | Significado | Tratamiento en el Sistema |
| :--- | :--- | :--- |
| `VALIDADA` | Coincidencia conforme y disponible en góndola digital. | Participa en la comparativa de precios y cálculo de canasta. |
| `SIN STOCK` | El producto existe en el catálogo pero está agotado temporalmente. | Se muestra el precio informativo pero se excluye de la canasta ganadora. |
| `NO ENCONTRADO` | La búsqueda no arrojó ningún elemento en el catálogo del súper. | Se registra como N/D y se alerta la falta de cobertura en ese comercio. |
| `COINCIDENCIA NO VÁLIDA` | El supermercado devolvió un producto ajeno a lo solicitado. | Se rechaza terminantemente para evitar falsas comparaciones de precio. |

---

## 13. Funcionamiento del Historial y Persistencia

La persistencia se realiza en `resultados.csv` con codificación UTF-8 (9 columnas):
```csv
modo,producto_solicitado,nombre_encontrado,precio,supermercado,url,fecha,stock_status,cantidad
compra_mes,yerba,Yerba mate Playadito suave con palo 1 kg.,"$ 5.209,00",Carrefour,https://...,2026-09-08,DISPONIBLE,2
compra_mes,yerba,Yerba Mate 4 Flex Mañanita Paq 1 Kgm,"$5.370,00",COTO,https://...,2026-09-08,DISPONIBLE,2
compra_mes,yerba,Yerba Mate Mañanita 4 Flex 1 Kg.,$ 3.790,Día %,https://...,2026-09-08,DISPONIBLE,2
individual,leche serenisima,Leche Protein La Serenisima 1L,"$ 3.119,00",Carrefour,https://...,2026-09-08,DISPONIBLE,1
```
- Cada nueva consulta se agrega al final del archivo sin sobreescribir las anteriores.
- La columna `cantidad` permite ponderar el gasto real en la canasta mensual y en el reporte Excel.
- La columna `modo` permite segregar analíticamente los datos de la compra del mes de las consultas rápidas.

---

## 14. Opciones de Limpieza y Mantenimiento

Desde el menú principal de `ejecutar.bat`, la opción `[4] Limpiar resultados / historial` ofrece:
- `[1] Limpiar registros de Compra del Mes actual`: Reinicia la canasta mensual para una nueva medición conservando las búsquedas individuales.
- `[2] Limpiar historial de Consultas Individuales`: Borra búsquedas de prueba conservando la canasta mensual.
- `[3] Limpiar TODO el historial de resultados`: Reinicia `resultados.csv` a cero con cabeceras limpias.
- `[4] Volver`: Cancela la operación.

> **Importante:** Ninguna de las opciones de limpieza modifica o elimina el archivo `input.csv`.

---

## 15. Troubleshooting y Problemas Frecuentes

### 1. Error `invalid URL` en TagUI
- **Causa:** Términos de búsqueda con espacios no codificados (ej: `leche serenisima`).
- **Solución:** Ya corregido en el script mediante `encodeURIComponent(producto.trim())`.

### 2. Banner de Cookies bloquea la pantalla
- **Causa:** Modales de consentimiento de cookies (OneTrust) en Carrefour o Día %.
- **Solución:** Implementado detector `if present('Aceptar todo') click Aceptar todo; wait 1`.

### 3. "No se reconoce tagui como un comando interno"
- **Causa:** La ruta `C:\tagui\src` no fue agregada a la variable `Path` del sistema.
- **Solución:** Seguir los pasos de la Sección 6 y reiniciar la terminal.

### 4. Error EBUSY al generar el Excel
- **Causa:** El archivo `reporte_supermercados.xlsx` se encuentra abierto en Microsoft Excel al momento de guardar.
- **Solución:** Cerrar la ventana de Excel antes de ejecutar una nueva consulta para permitir la reescritura (el sistema ahora lo detecta e informa con un mensaje limpio).

### 5. La ventana de CMD se cerraba inmediatamente al ejecutar `ejecutar.bat`
- **Causa:** Archivos `.bat` guardados con saltos de línea estilo UNIX (`LF`) o ejecutados desde un directorio relativo diferente al hacer doble clic.
- **Solución:** `ejecutar.bat` fue formateado estrictamente con saltos de línea Windows CRLF (`\r\n`), inicia con `cd /d "%~dp0"` y `setlocal EnableExtensions EnableDelayedExpansion`, e incluye pausas informativas y diagnóstico integrado (`[5]`) para que nunca se cierre sin previo aviso.

### 6. Suite de Pruebas Automatizadas (20 Tests Unitarios e Integradores)
El sistema cuenta con una suite integral de 20 pruebas automáticas que verifican todas las reglas de negocio, cálculos de cantidad, validaciones y diseño de 4 hojas del Excel:
```bash
node validador.js --test
```
La suite valida exhaustivamente:
- **Normalización y Marcas:** Limpieza de diacríticos y reconocimiento de marcas argentinas líderes.
- **Intención de Búsqueda:** Clasificación precisa entre consultas `ESPECIFICA` y `GENERICA`.
- **Presentación Estricta:** Regla infalible donde `2.25L` solo acepta equivalentes exactos (`2250ml`, `2,25 litros`) y rechaza tajantemente `2L`, `1.5L` o `500ml`.
- **Estructura CSV de Entrada:** Soporte nativo de `producto,cantidad,modo`, retrocompatibilidad con formato de 2 columnas y consolidación de duplicados.
- **Ponderación de Cantidades:** Cálculo real de subtotales `precio * cantidad` en canastas, compra combinada y ganadores.
- **Arquitectura Excel de 4 Hojas:** Verificación de que el reporte genera exactamente 4 hojas (`🏆 Conclusiones`, `🛒 Canasta Mensual`, `🔎 Consultas Individuales`, `⚠️ Disponibilidad y Stock`), eliminando por completo "Ranking Menor a Mayor" e integrando los productos con problemas directamente en la primera hoja.

---

## 16. Ejemplo Completo Paso a Paso: Compra del Mes

1. Supongamos `input.csv` con: `yerba`, `leche`, `arroz`, `fideos`, `aceite`.
2. Se ejecuta `ejecutar.bat` y se presiona `[1]`.
3. TagUI abre Chrome, consulta secuencialmente Carrefour, COTO y Día % para cada uno de los 5 artículos.
4. Extrae 15 registros y los añade a `resultados.csv`.
5. `generar_excel.js` totaliza:
   - Carrefour: $ 16.808,40
   - COTO: $ 16.873,85
   - Día %: $ 18.315,00
   - Compra Óptima Combinada: $ 14.739,85
6. El bot declara a **Carrefour** como **Supermercado Recomendado** por menor costo de canasta completa.
7. Se abre el Excel mostrando en verde pastel los productos ganadores individuales y el ahorro de $ 3.575,15 si se combina la compra.

---

## 17. Ejemplos de Búsqueda Individual: Específica vs Genérica

### Caso 1: Búsqueda Específica con Rechazo de Falsos Positivos
- **Entrada:** `gaseosa secco pomelo`
- **Comportamiento:** Intención detectada: `ESPECIFICA` (Marca: SECCO | Sabor: POMELO).
- **Salida en Terminal:**
```
================================================================================
       🔍 REPORTE DE BÚSQUEDA INDIVIDUAL - VALIDACIÓN INTELIGENTE
================================================================================
 Producto Solicitado : "gaseosa secco pomelo"
 Intención Detectada : ESPECIFICA (Marca: SECCO) [Categoría: gaseosa]
 Regla Aplicada      : Validación ESTRICTA de marca y tipo (rechaza sustitutos)
--------------------------------------------------------------------------------
 SUPERMERCADO  │ PRECIO        │ ESTADO                 │ PRODUCTO ENCONTRADO
───────────────┼──────────────┼───────────────────────┼──────────────────────────
 Carrefour     │ $ 6.095,40    │ ❌ COINCIDENCIA NO VÁLIDA│ Shampoo Dove Nutrición + Tri-Óleos 400 ml
               │              │    └─ Motivo: Marca requerida "SECCO" no coincide...
 COTO          │ $ 999,00      │ ❌ COINCIDENCIA NO VÁLIDA│ Pomelo Rojo . Xkg
               │              │    └─ Motivo: Marca requerida "SECCO" no coincide...
 Día %         │ $ 7.509,00    │ ❌ COINCIDENCIA NO VÁLIDA│ Shampoo Pantene Pro-V Miracles...
               │              │    └─ Motivo: Marca requerida "SECCO" no coincide...
--------------------------------------------------------------------------------
 ⚠️  ALERTA: Ningún supermercado arrojó una coincidencia válida disponible.
     El sistema evitó sustituir con productos erróneos (marcas ajenas, frutas o shampoo).
================================================================================
```

### Caso 2: Búsqueda Genérica con Comparación de Alternativas
- **Entrada:** `bebida de naranja`
- **Comportamiento:** Intención detectada: `GENERICA` (Categoría: BEBIDA | Sabor: NARANJA).
- **Salida en Terminal:**
```
================================================================================
       🔍 REPORTE DE BÚSQUEDA INDIVIDUAL - VALIDACIÓN INTELIGENTE
================================================================================
 Producto Solicitado : "bebida de naranja"
 Intención Detectada : GENERICA [Categoría: bebida]
 Regla Aplicada      : Comparación abierta de alternativas de mercado
--------------------------------------------------------------------------------
 SUPERMERCADO  │ PRECIO        │ ESTADO                 │ PRODUCTO ENCONTRADO
───────────────┼──────────────┼───────────────────────┼──────────────────────────
 Carrefour     │ $ 2.100,00    │  VALIDADA              │ Levite Naranja 1.5L
 COTO          │ $ 1.850,00    │ 🏆 GANADOR             │ Baggio Naranja 1.5L
 Día %         │ $ 2.450,00    │  VALIDADA              │ Cepita Naranja 1.5L
--------------------------------------------------------------------------------
 🏆 MEJOR OPCIÓN     : COTO ($ 1.850,00)
 💰 AHORRO POTENCIAL : $ 600,00 (24% menos que Día %)
================================================================================
```

---

## 18. Vinculación con Conceptos Teóricos de Control y Automatización

El desarrollo de este bot de software traslada directamente los principios fundamentales de la **Teoría de Control Automático** y de los **Sistemas de Lazo Cerrado** al entorno digital:

### 1. Sistema de Control de Lazo Cerrado con Retroalimentación Sensorial
Un lazo abierto ejecuta una secuencia de comandos ciega sin verificar el estado del proceso. En este sistema:
- **Planta:** El navegador Google Chrome renderizando aplicaciones e-commerce dinámicas.
- **Sensor:** Las funciones de inspección del DOM (`document.querySelector`, `present(...)`).
- **Controlador:** El script `supermercados.tag` y el motor `validador.js`.
- **Acción de Control:** Modificación del flujo de ejecución en base a la señal de error (ej: si aparece un popup de cookies que obstruye la pantalla, se aplica la acción correctiva `click Aceptar todo` antes de proceder a la medición).

### 2. Dinámica Transitoria y Error en Estado Estable ($e_{ss}$)
En aplicaciones web basadas en Single Page Applications (SPA), la carga de la página genera una respuesta temporal caracterizada por un **período transitorio** (descarga de bundles JavaScript, ejecución de APIs asíncronas de catálogo y renderizado de componentes reactivos).
- Si el sensor intenta leer los datos en el instante inicial ($t \approx 0$), el sistema se encuentra en plena oscilación transitoria y el dato no existe, provocando un fallo.
- Para forzar que el **error en estado estable tienda a cero ($e_{ss} \to 0$)**, se introducen tiempos de asentamiento y estabilización (`wait`), garantizando que la medición del precio se efectúe en el régimen permanente del DOM.

### 3. Rechazo de Perturbaciones Exógenas y Endógenas
- **Perturbaciones Exógenas:** Factores aleatorios fuera del control del bot (fluctuaciones en la latencia de internet, respuestas HTTP lentas de los servidores de Carrefour o COTO, cambios en la distribución visual o promociones emergentes). El lazo de control las absorbe mediante timeouts configurados y verificación condicional de existencia.
- **Perturbaciones Endógenas:** Errores en las variables de entrada ingresadas por el usuario (palabras mal tipeadas, espacios extras, falta de especificaciones en `input.csv`). El bloque de normalización y el detector de intención actúan como un **filtro pasa-bajos** que limpia el ruido de entrada antes de inyectarlo en la planta.

---

## 📄 Licencia y Ámbito Académico
Desarrollo realizado en el marco de la cátedra **Tecnologías para la Automatización (2026)**, carrera de Ingeniería en Sistemas de Información, **Universidad Tecnológica Nacional – Facultad Regional Concepción del Uruguay (UTN FRCU)**.

