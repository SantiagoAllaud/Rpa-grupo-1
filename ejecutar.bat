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

:: Si se envio un argumento por linea de comandos (ej: ejecutar.bat cafe)
if not "%~1"=="" (
    set "ARG1=%~1"
    goto :evaluar_arg
)

:menu
echo Selecciona una opcion:
echo   [1] Procesar todos los productos de input.csv
echo   [2] Buscar un producto especifico manualmente
echo.
set "OPCION=1"
set /p "OPCION=Elige una opcion [1]: "

if "%OPCION%"=="2" (
    echo.
    set /p "PROD_MANUAL=Ingresa el nombre del producto (ej: cafe, azucar, galletitas): "
    goto :buscar_manual
) else (
    goto :ejecutar_csv
)

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
echo [INFO] Iniciando automatizacion con TagUI para: "%PROD_MANUAL%"...
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
echo ==============================================================================
echo [FIN] Proceso completado exitosamente.
echo Revisa los resultados guardados en el archivo resultados.csv.
echo ==============================================================================
echo.
pause
