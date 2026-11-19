# Uma passada do extrator, que o Agendador de Tarefas roda (agendar.ps1), numa de duas rotinas:
# - foto: gera a foto e leva a mais nova ao servidor do CRM. O envio roda mesmo quando a foto falha ou nada
#   mudou, para entregar uma foto que ficou para tras numa queda da rede;
# - pedidos: traz os pedidos que os representantes enviaram pelo CRM (F5).
# Cada passada vai para <dados>\registro\<rotina>-<ano>-<mes>.log, so com o que o extrator escreve:
# contagens, numeros de pedido do CRM e mensagens de erro, nunca nomes nem valores do .env.
# Os textos ficam sem acento: o PowerShell 5.1 do Windows le o arquivo como ANSI.
param(
  [Parameter(Mandatory)][string]$Dados,
  [ValidateSet('foto', 'pedidos')][string]$Rotina = 'foto'
)

$ErrorActionPreference = 'Stop'
$MESES_DE_REGISTRO = 3
# As etapas de cada rotina, em ordem: o nome no registro e o programa do extrator.
$ETAPAS = @{
  foto    = @(@('foto', 'src/principal.ts'), @('envio', 'src/enviar.ts'))
  pedidos = @(, @('pedidos', 'src/pedidos.ts'))
}
# O node escreve em UTF-8; sem isto, os acentos das mensagens dele chegam trocados ao registro.
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$pastaDoExtrator = Split-Path -Parent $PSScriptRoot
$arquivoEnv = Join-Path $Dados 'extrator.env'
$pastaDoRegistro = Join-Path $Dados 'registro'
New-Item -ItemType Directory -Force $pastaDoRegistro | Out-Null
$registro = Join-Path $pastaDoRegistro ('{0}-{1:yyyy-MM}.log' -f $Rotina, (Get-Date))

function Escrever([string]$texto) {
  Add-Content -LiteralPath $registro -Value ('{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $texto) -Encoding UTF8
}

function Rodar([string]$etapa, [string]$programa) {
  Escrever "$etapa comecou"
  # O cmd junta o stderr do node ao stdout: com o 2>&1 do PowerShell 5.1, cada linha de erro vira um
  # registro de erro do PowerShell, e as linhas em branco aparecem como "RemoteException".
  & cmd.exe /d /c "node `"$programa`" --env `"$arquivoEnv`" --dados `"$Dados`" 2>&1" |
    Where-Object { $_.Trim() } | ForEach-Object { Escrever "  $_" }
  $codigo = $LASTEXITCODE
  Escrever "$etapa terminou com codigo $codigo"
  return $codigo
}

function ApagarRegistrosAntigos {
  $limite = (Get-Date).AddMonths(-$MESES_DE_REGISTRO)
  Get-ChildItem -LiteralPath $pastaDoRegistro -Filter '*.log' | Where-Object LastWriteTime -lt $limite | Remove-Item
}

Set-Location $pastaDoExtrator
# Todas as etapas rodam, mesmo depois de uma que falhou.
$codigos = @(foreach ($etapa in $ETAPAS[$Rotina]) { Rodar $etapa[0] $etapa[1] })
ApagarRegistrosAntigos
# O Agendador mostra o resultado da ultima execucao: diferente de 0 quando uma das etapas falhou.
exit [int](@($codigos | Where-Object { $_ -ne 0 }).Count -gt 0)
