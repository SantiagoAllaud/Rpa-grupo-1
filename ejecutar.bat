@echo off
chcp 65001 >nul
title RPA Comparador de Precios - UTN FRCU

echo ==============================================================================
echo       UTN FRCU - Tecnologias para la Automatizacion (Ano 2026)
echo          Trabajo Practico Integrador: Bot RPA de Supermercados
echo ==============================================================================
echo.

:: Verificar si TagUI esta disponible en PATH o en %USERPROFILE%\tagui\src
where tagui >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "%USERPROFILE%\tagui\src\tagui.cmd" (
        set "PATH=%USERPROFILE%\tagui\src;%PATH%"
    ) else if exist "C:\tagui\src\tagui.cmd" (
        set "PATH=C:\tagui\src;%PATH%"
    ) else (
        echo [ERROR] No se encontro TagUI instalado en el sistema.
        echo Por favor revisa el archivo README.md para ver los pasos de instalacion.
        echo.
        pause
        exit /b 1
    )
)

:: Si se envio un argumento por linea de comandos (ej: ejecutar.bat galletitas oreo)
if not "%~1"=="" (
    set "ARG1=%~1"
    goto :evaluar_arg
)

:menu
echo Selecciona una opcion:
echo   [1] Procesar la lista completa de productos desde input.csv
echo   [2] Escribir el nombre de un producto para buscarlo ahora
echo.
echo (Tip: Tambien puedes escribir directamente el producto aqui y presionar Enter)
echo.
set "OPCION=1"
set /p "OPCION=Elige opcion o escribe el producto [1]: "

if "%OPCION%"=="1" (
    goto :ejecutar_csv
)
if "%OPCION%"=="2" (
    echo.
    set /p "PROD_MANUAL=Ingresa el producto a buscar (ej: galletitas oreo, cafe): "
    goto :buscar_manual
)

:: Si el usuario escribio directamente el nombre del producto (ej: galletitas oreo)
set "PROD_MANUAL=%OPCION%"
goto :buscar_manual

:evaluar_arg
if "%ARG1:~0,1%"=="-" (
    goto :ejecutar_csv_con_args
) else (
    set "PROD_MANUAL=%*"
    goto :buscar_manual
)

:buscar_manual
if "%PROD_MANUAL%"=="" (
    echo [ERROR] No se ingreso ningun producto.
    pause
    exit /b 1
)

echo producto> temp_input.csv
echo %PROD_MANUAL%>> temp_input.csv

echo.
echo [INFO] Iniciando automatizacion con TagUI para el producto: "%PROD_MANUAL%"...
echo.
call tagui supermercados.tag temp_input.csv
if exist "temp_input.csv" del "temp_input.csv"
goto :fin

:ejecutar_csv
if not exist "input.csv" (
    echo [ERROR] No se encontro el archivo input.csv con los productos.
    pause
    exit /b 1
)
echo.
echo [INFO] Iniciando automatizacion con TagUI sobre Google Chrome...
echo [INFO] Leyendo productos desde input.csv...
echo.
call tagui supermercados.tag input.csv
goto :fin

:ejecutar_csv_con_args
if not exist "input.csv" (
    echo [ERROR] No se encontro el archivo input.csv con los productos.
    pause
    exit /b 1
)
echo.
echo [INFO] Iniciando automatizacion con opciones [%*]...
echo [INFO] Leyendo productos desde input.csv...
echo.
call tagui supermercados.tag input.csv %*
goto :fin

:fin
echo.
echo [INFO] Generando reporte visual en Excel con colores, conclusiones y ranking...
node generar_excel.js

:: Abrir el Excel inmediatamente en pantalla apenas termina
if exist "reporte_supermercados.xlsx" (
    echo [INFO] Abriendo reporte_supermercados.xlsx en Microsoft Excel...
    start "" "reporte_supermercados.xlsx"
)

echo.
echo ==============================================================================
echo [FIN] Proceso completado exitosamente!
echo.
echo Archivos actualizados:
echo   - reporte_supermercados.xlsx (Excel interactivo con colores, medallas y conclusion)
echo   - resultados.csv             (Persistencia local requerida por la catedra)
echo ==============================================================================
echo.
pause

