@echo off
setlocal
title CRM - dados reais neste computador

rem Abre o CRM com os dados reais do ERP, so neste computador: ainda nao ha login (F3), entao
rem nada fica exposto na rede. Gera uma foto nova do ERP, sobe a API e o site e abre o navegador.
rem Antes da primeira vez:
rem   extrator\.env  com o acesso ao Oracle (chaves em extrator\.env.example);
rem   server\.env    com o login de teste e os codigos dele (chaves em server\.env.example);
rem   data\representantes-autorizados.txt  com os codigos que entram na foto, um por linha.
rem Para atualizar os dados depois, rode de novo, ou so: npm run foto

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
if not exist "server\.env" (
  echo Falta server\.env com o login de teste. Veja as chaves em server\.env.example.
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

start "CRM - API" cmd /k npm run dev:servidor
start "CRM - site" cmd /k npm run dev:real
timeout /t 6 /nobreak >nul
start "" http://localhost:5175
