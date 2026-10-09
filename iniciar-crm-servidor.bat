@echo off
setlocal
title CRM - prototipo na rede interna

rem Abre o prototipo (dados ficticios) para outros aparelhos da rede interna: o celular no mesmo
rem Wi-Fi ou outro computador. Por seguranca, nao expoe o servidor de desenvolvimento: monta o
rem site e serve so os arquivos prontos, no IP desta maquina na rede interna.
rem Mudou o codigo? Feche e rode de novo. Para trabalhar so neste computador, com recarga
rem automatica: npm run dev:web (porta 5175).

set "PORTA=4175"
set "REGRA_DO_FIREWALL=CRM prototipo (rede interna)"

rem Garante Node no PATH (instalacao tipica)
set "PATH=%ProgramFiles%\nodejs;%PATH%"

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node 24 LTS e tente de novo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=v." %%V in ('node --version') do set "VERSAO_DO_NODE=%%V"
if not "%VERSAO_DO_NODE%"=="24" (
  echo Aviso: o projeto usa o Node 24, e este computador tem outra versao. Se algo falhar, instale o Node 24 LTS.
)

if not exist "node_modules\" (
  echo Instalando as dependencias ^(primeira vez^)...
  call npm ci
  if errorlevel 1 (
    echo Falha ao instalar as dependencias.
    pause
    exit /b 1
  )
)

rem O IP da placa de rede que leva a internet (a de menor metrica), como no ipconfig.
set "IP_NA_REDE="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$rota = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object { $_.RouteMetric + $_.InterfaceMetric } | Select-Object -First 1; if ($rota) { (Get-NetIPAddress -InterfaceIndex $rota.ifIndex -AddressFamily IPv4 | Select-Object -First 1).IPAddress }"`) do set "IP_NA_REDE=%%I"

if not defined IP_NA_REDE (
  echo Nao achei o IP desta maquina na rede. Conecte o cabo ou o Wi-Fi e tente de novo.
  pause
  exit /b 1
)

rem So rede interna: com um IP publico, o prototipo ficaria aberto para a internet.
echo %IP_NA_REDE%| findstr /R /C:"^10\." /C:"^192\.168\." /C:"^172\.1[6-9]\." /C:"^172\.2[0-9]\." /C:"^172\.3[01]\." >nul
if errorlevel 1 (
  echo O IP desta maquina ^(%IP_NA_REDE%^) nao e de rede interna. Por seguranca, o prototipo nao sobe.
  pause
  exit /b 1
)

echo Montando o site...
call npm run build --workspace web
if errorlevel 1 (
  echo A montagem falhou: veja o erro acima. Se faltar alguma dependencia, rode npm ci e tente de novo.
  pause
  exit /b 1
)

echo Encerrando instancia anterior na porta %PORTA% ^(se houver^)...
for /f "tokens=5" %%A in ('netstat -ano ^| findstr /C:":%PORTA% " ^| findstr "LISTENING"') do (
  echo Finalizando PID %%A...
  taskkill /PID %%A /F >nul 2>&1
)

rem Como administrador, libera a porta no Firewall so para a rede interna: perfis de dominio e
rem privado, e so aparelhos da mesma sub-rede. Sem administrador, o Windows pergunta na primeira vez.
net session >nul 2>&1
if not errorlevel 1 (
  netsh advfirewall firewall delete rule name="%REGRA_DO_FIREWALL%" >nul 2>&1
  netsh advfirewall firewall add rule name="%REGRA_DO_FIREWALL%" dir=in action=allow protocol=TCP localport=%PORTA% remoteip=localsubnet profile=domain,private >nul
)

echo.
echo Prototipo do CRM ^(dados ficticios^), so na rede interna:
echo.
echo   http://%IP_NA_REDE%:%PORTA%/
echo.
echo No celular, use o Wi-Fi da empresa ^(nao a rede de convidados^) e abra esse endereco.
echo Se o outro aparelho nao conectar, permita o Node.js quando o Windows perguntar, ou rode
echo este arquivo uma vez como administrador: ele libera a porta %PORTA% so para a rede interna.
echo Para desligar, feche esta janela ou aperte Ctrl+C.
echo.

rem Abre o navegador assim que o site responder.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 60; $i++) { $conexao = New-Object System.Net.Sockets.TcpClient; try { $conexao.Connect('%IP_NA_REDE%', %PORTA%); $conexao.Close(); Start-Process 'http://%IP_NA_REDE%:%PORTA%/'; break } catch {}; Start-Sleep -Milliseconds 500 }"

call npm run preview --workspace web -- --host %IP_NA_REDE% --port %PORTA% --strictPort
pause
