@echo off
setlocal
title CRM - dados reais neste computador

rem Abre o CRM com os dados reais do ERP, so neste computador: a API e o site escutam so nesta
rem maquina. Gera uma foto nova do ERP, sobe a API e o site e abre o navegador. Para entrar, a
rem chave de acesso (F3).
rem Antes da primeira vez:
rem   extrator\.env  com o acesso ao Oracle (chaves em extrator\.env.example);
rem   data\representantes-autorizados.txt  com os codigos que entram na foto, um por linha.
rem Depois da primeira foto, crie o seu login uma vez e abra no Chrome ou no Edge o link do convite:
rem   npm run admin -- convidar --nome "Star Vendas" --codigos 1401,1402
rem Para atualizar os dados, rode de novo: com o CRM aberto, so a foto muda, e a API passa a
rem usa-la em ate meio minuto. Para fechar, feche as janelas "CRM - API" e "CRM - site".

rem Garante Node no PATH (instalacao tipica)
set "PATH=%ProgramFiles%\nodejs;%PATH%"

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node nao encontrado. Instale o Node 24 e rode de novo.
  pause
  exit /b 1
)
if not exist "extrator\.env" (
  echo Falta extrator\.env com o acesso ao Oracle. Veja as chaves em extrator\.env.example.
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

echo Logins do CRM neste computador:
call npm run admin --silent -- usuarios

call :abrirSeFechado 5176 "CRM - API" dev:servidor
call :abrirSeFechado 5175 "CRM - site" dev:real
timeout /t 6 /nobreak >nul
start "" http://localhost:5175
exit /b 0

rem Abre a janela so se ninguem estiver escutando na porta: o CRM pode ja estar aberto.
:abrirSeFechado
netstat -ano | findstr /r /c:"127\.0\.0\.1:%~1 .*LISTENING" /c:"127\.0\.0\.1:%~1 .*ESCUTANDO" >nul
if errorlevel 1 start "%~2" cmd /k npm run %~3
exit /b 0
