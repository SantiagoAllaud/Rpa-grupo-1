@echo off
chcp 65001 >nul
title RPA Comparador de Precios - UTN FRCU

:: Verificar si TagUI esta disponible en PATH o en ubicaciones estándar
where tagui >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "%USERPROFILE%\tagui\src\tagui.cmd" (
        set "PATH=%USERPROFILE%\tagui\src;%PATH%"
    ) else if exist "C:\tagui\src\tagui.cmd" (
        set "PATH=C:\tagui\src;%PATH%"
    ) else (
        echo [ERROR] No se encontró TagUI instalado en el sistema.
        echo Por favor revisa el archivo README.md para ver los pasos de instalación.
        echo.
        pause
        exit /b 1
    )
)

:: Verificar si Node.js esta disponible
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no está instalado o no se encuentra en el PATH.
    pause
    exit /b 1
)

:: Si se envió un argumento por línea de comandos (ej: ejecutar.bat "gaseosa secco pomelo")
if not "%~1"=="" (
    set "ARG1=%~1"
    goto :evaluar_arg
)

:menu
cls
echo ==============================================================================
echo       UTN FRCU - Tecnologías para la Automatización (Año 2026)
echo          Trabajo Práctico Integrador: Bot RPA de Supermercados
echo ==============================================================================
echo.
echo Selecciona una opción:
echo   [1] Procesar compra del mes (desde input.csv)
echo   [2] Buscar producto individual (consulta interactiva)
echo   [3] Abrir reporte Excel (reporte_supermercados.xlsx)
echo   [4] Limpiar resultados / historial (sin alterar input.csv)
echo   [5] Salir
echo.
echo (Tip: También podés escribir directamente el producto aquí y presionar Enter)
echo.
set "OPCION=1"
set /p "OPCION=Elige opción o escribe el producto [1]: "

if "%OPCION%"=="1" goto :ejecutar_mes
if "%OPCION%"=="2" goto :pedir_individual
if "%OPCION%"=="3" goto :abrir_excel
if "%OPCION%"=="4" goto :menu_limpieza
if "%OPCION%"=="5" goto :salir

:: Si el usuario escribió directamente un producto (ej: "yerba playadito")
set "PROD_MANUAL=%OPCION%"
goto :ejecutar_individual

:evaluar_arg
if "%ARG1:~0,1%"=="-" (
    goto :ejecutar_mes_con_args
) else (
    set "PROD_MANUAL=%*"
    goto :ejecutar_individual
)

:pedir_individual
echo.
set /p "PROD_MANUAL=Ingresa el producto a buscar (ej: Gaseosa Secco Pomelo, fideos): "
if "%PROD_MANUAL%"=="" (
    echo [ERROR] No se ingresó ningún producto.
    timeout /t 2 >nul
    goto :menu
)
goto :ejecutar_individual

:ejecutar_individual
echo.
echo ==============================================================================
echo [INFO] Iniciando BÚSQUEDA INDIVIDUAL para: "%PROD_MANUAL%"
echo [INFO] Se consultará Carrefour, COTO y Día %% sin modificar input.csv...
echo ==============================================================================
echo.

:: Crear archivo temporal con modo individual
echo producto,modo> temp_input.csv
echo %PROD_MANUAL%,individual>> temp_input.csv

call tagui supermercados.tag temp_input.csv
if exist "temp_input.csv" del "temp_input.csv" >nul 2>&1

:: Validación inteligente y reporte en vivo en la consola
echo.
node validador.js --reporte-individual "%PROD_MANUAL%"

:: Actualización del reporte Excel
echo [INFO] Actualizando reporte_supermercados.xlsx con la nueva consulta...
node generar_excel.js

if exist "reporte_supermercados.xlsx" (
    echo [INFO] Abriendo reporte_supermercados.xlsx...
    start "" "reporte_supermercados.xlsx"
)

echo.
pause
goto :menu

:ejecutar_mes
if not exist "input.csv" (
    echo [ERROR] No se encontró el archivo input.csv con los productos.
    pause
    goto :menu
)

echo.
echo ==============================================================================
echo [INFO] Iniciando MODO COMPRA DEL MES
echo [INFO] Leyendo lista predefinida desde input.csv...
echo ==============================================================================
echo.
call tagui supermercados.tag input.csv

echo.
echo [INFO] Procesando datos y generando reporte Excel con 5 hojas...
node generar_excel.js

if exist "reporte_supermercados.xlsx" (
    echo [INFO] Abriendo reporte_supermercados.xlsx...
    start "" "reporte_supermercados.xlsx"
)

echo.
echo ==============================================================================
echo [FIN] Compra del mes procesada exitosamente!
echo ==============================================================================
echo.
pause
goto :menu

:ejecutar_mes_con_args
if not exist "input.csv" (
    echo [ERROR] No se encontró el archivo input.csv.
    pause
    goto :menu
)
echo.
echo [INFO] Iniciando automatización con parámetros [%*]...
call tagui supermercados.tag input.csv %*
node generar_excel.js
if exist "reporte_supermercados.xlsx" start "" "reporte_supermercados.xlsx"
pause
goto :menu

:abrir_excel
echo.
if exist "reporte_supermercados.xlsx" (
    echo [INFO] Abriendo reporte_supermercados.xlsx en Microsoft Excel...
    start "" "reporte_supermercados.xlsx"
) else (
    echo [AVISO] Aún no se ha generado el reporte Excel.
    echo Por favor ejecutá primero la opción [1] o [2].
)
timeout /t 2 >nul
goto :menu

:menu_limpieza
cls
echo ==============================================================================
echo                       GESTIÓN Y LIMPIEZA DE RESULTADOS
echo ==============================================================================
echo.
echo   [1] Limpiar registros de Compra del Mes actual (reiniciar canasta)
echo   [2] Limpiar historial de Consultas Individuales
echo   [3] Limpiar TODO el historial de resultados
echo   [4] Volver al menú principal
echo.
echo (Nota: Tu archivo input.csv NUNCA será borrado ni modificado)
echo.
set "OPC_LIMPIAR=4"
set /p "OPC_LIMPIAR=Selecciona opción [4]: "

if "%OPC_LIMPIAR%"=="1" (
    node validador.js --limpiar 1
    node generar_excel.js
    pause
    goto :menu
)
if "%OPC_LIMPIAR%"=="2" (
    node validador.js --limpiar 2
    node generar_excel.js
    pause
    goto :menu
)
if "%OPC_LIMPIAR%"=="3" (
    node validador.js --limpiar 3
    node generar_excel.js
    pause
    goto :menu
)
goto :menu

:salir
echo.
echo Gracias por utilizar el Comparador RPA de Supermercados - UTN FRCU 2026.
echo.
exit /b 0


