# Cria (ou refaz) no Agendador de Tarefas a tarefa "CRM - extrator", que roda o passada.ps1 na agenda do
# plano (docs/plano.md, "Agenda do extrator"): a cada 30 min das 7h as 19h e de hora em hora fora disso.
# Roda na conta de quem executa este script, mesmo sem ninguem logado, sem guardar a senha (S4U): o
# extrator so usa a rede pelo Oracle e pelo SFTP, que nao dependem da senha do Windows.
# Uso, num PowerShell aberto como administrador, na conta do extrator:
#   powershell -ExecutionPolicy Bypass -File extrator\agenda\agendar.ps1 [-Dados <pasta de dados>]
param(
  [string]$Dados = (Join-Path $env:USERPROFILE 'crm-dados')
)

$ErrorActionPreference = 'Stop'
$NOME_DA_TAREFA = 'CRM - extrator'

function ExigirAdministrador {
  $identidade = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $identidade.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Abra o PowerShell como administrador: o Windows so cria tarefa sem senha guardada assim.'
  }
}

function ExigirPastaDeDados {
  if (-not (Test-Path -LiteralPath (Join-Path $Dados 'extrator.env'))) {
    throw "Nao achei $Dados\extrator.env. Passe a pasta de dados do extrator em -Dados."
  }
}

# Um gatilho diario que se repete a cada $minutosEntrePassadas durante $horasDeDuracao.
function GatilhoDiario([string]$hora, [int]$minutosEntrePassadas, [int]$horasDeDuracao) {
  $repeticao = New-ScheduledTaskTrigger -Once -At $hora `
    -RepetitionInterval (New-TimeSpan -Minutes $minutosEntrePassadas) -RepetitionDuration (New-TimeSpan -Hours $horasDeDuracao)
  $gatilho = New-ScheduledTaskTrigger -Daily -At $hora
  $gatilho.Repetition = $repeticao.Repetition
  return $gatilho
}

ExigirAdministrador
ExigirPastaDeDados
$Dados = (Resolve-Path -LiteralPath $Dados).Path
$passada = Join-Path $PSScriptRoot 'passada.ps1'

$acao = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$passada`" -Dados `"$Dados`""
$gatilhos = @(
  (GatilhoDiario '07:00' 30 12),
  (GatilhoDiario '19:00' 60 12)
)
$conta = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited
# Uma passada por vez: se uma demorar, a seguinte e pulada. Mais de 1 hora e travamento.
$regras = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $NOME_DA_TAREFA -Action $acao -Trigger $gatilhos -Principal $conta -Settings $regras `
  -Description "Gera a foto do ERP e a envia ao servidor do CRM ($passada)." -Force | Out-Null

Write-Host "Tarefa '$NOME_DA_TAREFA' criada para $env:USERNAME, com os dados em $Dados."
Write-Host "Rode agora uma vez:  Start-ScheduledTask -TaskName '$NOME_DA_TAREFA'"
Write-Host "Registro de cada passada: $Dados\registro\"
