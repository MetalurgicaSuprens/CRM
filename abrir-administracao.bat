@echo off
setlocal
title CRM - administracao

rem Abre a administracao do CRM neste computador: os logins dos representantes, as chaves de
rem acesso, os convites e o registro de acessos. Sobe a API (se ainda nao estiver aberta), que
rem ja traz a da administracao, o site da administracao e o site do CRM, onde abre o link do
rem convite de um representante, e abre o navegador.
rem So voce entra, com a sua chave de acesso de admin. Na primeira vez, crie o seu login de admin
rem e abra no Chrome ou no Edge o link do convite que ele escreve:
rem   npm run admin -- criar-admin --nome "Seu nome"
rem Para fechar, feche as janelas "CRM - API", "CRM - site" e "CRM - administracao".

rem Garante Node no PATH (instalacao tipica)
set "PATH=%ProgramFiles%\nodejs;%PATH%"

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node nao encontrado. Instale o Node 24 e rode de novo.
  pause
  exit /b 1
)

echo Logins do CRM neste computador:
call npm run admin --silent -- usuarios

call :abrirSeFechado 5176 "CRM - API" dev:servidor
call :abrirSeFechado 5175 "CRM - site" dev:real
call :abrirSeFechado 5179 "CRM - administracao" dev:admin
timeout /t 6 /nobreak >nul
start "" http://localhost:5179
exit /b 0

rem Abre a janela so se ninguem estiver escutando na porta: a API e o site podem ja estar abertos
rem pelo ver-crm-com-dados-reais.bat.
:abrirSeFechado
netstat -ano | findstr /r /c:"127\.0\.0\.1:%~1 .*LISTENING" /c:"127\.0\.0\.1:%~1 .*ESCUTANDO" >nul
if errorlevel 1 start "%~2" cmd /k npm run %~3
exit /b 0
