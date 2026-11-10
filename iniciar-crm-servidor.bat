@echo off
setlocal
title CRM - teste na rede interna

rem Abre o CRM com os dados reais do ERP para outros aparelhos da rede interna: o celular no mesmo
rem Wi-Fi ou outro computador. Gera uma foto nova do ERP, sobe a API so nesta maquina e serve o site
rem pronto no IP desta maquina na rede interna. Por seguranca, nao expoe o servidor de desenvolvimento.
rem
rem O login e o provisorio, por senha: a chave de acesso nao funciona por http no IP da maquina. A
rem senha e os codigos de representante que ele puxa ficam em data\rede-interna.env (fora do git):
rem   CRM_SENHA_PROVISORIA=...
rem   CRM_LOGIN_PROVISORIO_CODIGOS=1401,1402
rem Esse teste tem logins e registro proprios (data\app-rede-interna.db): o login seguro, por chave
rem de acesso, continua no ver-crm-com-dados-reais.bat, so neste computador.
rem Antes da primeira vez, crie tambem o extrator\.env, com o acesso ao Oracle.
rem Mudou o codigo ou quer dados mais novos? Feche e rode de novo.

set "PORTA=4175"
set "PORTA_DA_API=5186"
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

if not exist "extrator\.env" (
  echo Falta extrator\.env com o acesso ao Oracle. Veja as chaves em extrator\.env.example.
  pause
  exit /b 1
)
if not exist "data\rede-interna.env" (
  echo Falta data\rede-interna.env, com a senha provisoria e os codigos do login:
  echo   CRM_SENHA_PROVISORIA=...
  echo   CRM_LOGIN_PROVISORIO_CODIGOS=1401,1402
  pause
  exit /b 1
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

rem So rede interna: com um IP publico, os dados ficariam abertos para a internet.
echo %IP_NA_REDE%| findstr /R /C:"^10\." /C:"^192\.168\." /C:"^172\.1[6-9]\." /C:"^172\.2[0-9]\." /C:"^172\.3[01]\." >nul
if errorlevel 1 (
  echo O IP desta maquina ^(%IP_NA_REDE%^) nao e de rede interna. Por seguranca, o CRM nao sobe.
  pause
  exit /b 1
)

echo Gerando a foto do ERP...
call npm run foto
if errorlevel 1 (
  echo A foto nao foi gerada. Veja a mensagem acima.
  pause
  exit /b 1
)

echo Montando o site...
call npm run build --workspace web -- --mode rede-interna
if errorlevel 1 (
  echo A montagem falhou: veja o erro acima. Se faltar alguma dependencia, rode npm ci e tente de novo.
  pause
  exit /b 1
)

echo Encerrando instancia anterior nas portas %PORTA% e %PORTA_DA_API% ^(se houver^)...
for %%P in (%PORTA% %PORTA_DA_API%) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /C:":%%P " ^| findstr "LISTENING ESCUTANDO"') do (
    echo Finalizando PID %%A...
    taskkill /PID %%A /F >nul 2>&1
  )
)

rem A API escuta so nesta maquina; o site da rede interna repassa a ela os pedidos de /api.
set "CRM_ORIGEM_DA_REDE_INTERNA=http://%IP_NA_REDE%:%PORTA%"
start "CRM - API da rede interna" cmd /k npm run rede-interna --workspace server

rem Como administrador, libera a porta no Firewall so para a rede interna: perfis de dominio e
rem privado, e so aparelhos da mesma sub-rede. Sem administrador, o Windows pergunta na primeira vez.
net session >nul 2>&1
if not errorlevel 1 (
  netsh advfirewall firewall delete rule name="%REGRA_DO_FIREWALL%" >nul 2>&1
  netsh advfirewall firewall add rule name="%REGRA_DO_FIREWALL%" dir=in action=allow protocol=TCP localport=%PORTA% remoteip=localsubnet profile=domain,private >nul
)

echo.
echo CRM com os dados reais do ERP, so na rede interna:
echo.
echo   http://%IP_NA_REDE%:%PORTA%/
echo.
echo Entre com a senha provisoria de data\rede-interna.env.
echo No celular, use o Wi-Fi da empresa ^(nao a rede de convidados^) e abra esse endereco.
echo Se o outro aparelho nao conectar, permita o Node.js quando o Windows perguntar, ou rode
echo este arquivo uma vez como administrador: ele libera a porta %PORTA% so para a rede interna.
echo Para desligar, feche esta janela e a "CRM - API da rede interna".
echo.

rem Abre o navegador assim que o site responder.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 60; $i++) { $conexao = New-Object System.Net.Sockets.TcpClient; try { $conexao.Connect('%IP_NA_REDE%', %PORTA%); $conexao.Close(); Start-Process 'http://%IP_NA_REDE%:%PORTA%/'; break } catch {}; Start-Sleep -Milliseconds 500 }"

call npm run preview --workspace web -- --mode rede-interna --host %IP_NA_REDE% --port %PORTA% --strictPort
pause
