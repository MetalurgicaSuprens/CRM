#!/usr/bin/env bash
# Põe no ar uma versão do CRM, montada no computador de desenvolvimento com o npm run pacote:
#   sudo /opt/crm/publicar.sh crm-20261113-1530-abc1234.tar.gz
# Volta para a versão anterior:
#   sudo /opt/crm/publicar.sh --voltar
# Cada versão fica na sua pasta em /opt/crm/versoes; /opt/crm/atual aponta para a que está no ar. Se a
# API não responder depois da troca, volta sozinho para a anterior.
set -euo pipefail

readonly VERSOES=/opt/crm/versoes
readonly ATUAL=/opt/crm/atual
readonly VERSOES_GUARDADAS=5
# A mesma porta do CRM_PORTA em /etc/crm/server.env.
readonly ENDERECO_DA_API=http://127.0.0.1:5176/api/
readonly NOME_VALIDO='^crm-[0-9]{8}-[0-9]{4}-[0-9a-f]{7,40}(-rascunho)?$'

principal() {
  [[ $EUID -eq 0 ]] || falhar "Rode com sudo."
  case "${1:-}" in
    "") falhar "Diga o pacote: sudo /opt/crm/publicar.sh crm-....tar.gz (ou --voltar)." ;;
    --voltar) voltar ;;
    *) publicar "$1" ;;
  esac
}

publicar() {
  local pacote="$1" nome
  [[ -f "$pacote" ]] || falhar "Não achei o pacote $pacote."
  nome="$(basename "$pacote" .tar.gz)"
  [[ "$nome" =~ $NOME_VALIDO ]] || falhar "O nome $nome não é de um pacote do CRM (npm run pacote)."
  [[ ! -e "$VERSOES/$nome" ]] || falhar "A versão $nome já está no servidor. Para voltar a ela, publique de novo depois de apagar $VERSOES/$nome."
  desempacotar "$pacote" "$nome"
  preparar_versao "$VERSOES/$nome"
  local anterior
  anterior="$(versao_no_ar)"
  trocar_para "$nome"
  if ! api_respondendo; then
    echo "A API não respondeu com a versão $nome. Últimas linhas do serviço:" >&2
    journalctl -u crm -n 30 --no-pager >&2 || true
    [[ -n "$anterior" ]] && trocar_para "$anterior" && echo "Voltei para a versão $anterior." >&2
    exit 1
  fi
  apagar_versoes_antigas
  echo "No ar: $nome."
}

voltar() {
  local no_ar anterior
  no_ar="$(versao_no_ar)"
  anterior="$(ls -1 "$VERSOES" | grep -E "$NOME_VALIDO" | sort | awk -v atual="$no_ar" '$0 < atual' | tail -n 1)"
  [[ -n "$anterior" ]] || falhar "Não há versão anterior a $no_ar no servidor."
  trocar_para "$anterior"
  api_respondendo || falhar "A API não respondeu com a versão $anterior: journalctl -u crm."
  echo "No ar: $anterior. Atenção: se a versão mais nova mudou o app.db, a anterior pode não abri-lo."
}

desempacotar() {
  local pacote="$1" nome="$2" chegando
  chegando="$(mktemp -d "$VERSOES/.chegando-XXXXXX")"
  # O tar do Windows grava cabeçalhos que o do Linux não conhece e só avisa; o aviso não interessa.
  tar -xzf "$pacote" --no-same-owner --warning=no-unknown-keyword -C "$chegando"
  [[ -d "$chegando/$nome" ]] || { rm -rf "$chegando"; falhar "O pacote não tem a pasta $nome."; }
  [[ "$(cat "$chegando/$nome/VERSAO")" == "$nome" ]] || { rm -rf "$chegando"; falhar "O arquivo VERSAO não bate com o nome do pacote."; }
  mv "$chegando/$nome" "$VERSOES/$nome"
  rmdir "$chegando"
}

# Os arquivos são do root e só leitura para os outros; o tar não leva os atalhos, que nascem aqui.
preparar_versao() {
  local pasta="$1"
  chown -R root:root "$pasta"
  chmod -R u=rwX,go=rX "$pasta"
  ln -s ../dominio "$pasta/node_modules/dominio"
  ln -s /etc/crm/server.env "$pasta/server/.env"
}

versao_no_ar() {
  if [[ -L "$ATUAL" ]]; then basename "$(readlink "$ATUAL")"; fi
}

# A troca do atalho é atômica: o Apache nunca vê a pasta pela metade.
trocar_para() {
  ln -sfn "versoes/$1" "$ATUAL.novo"
  mv -T "$ATUAL.novo" "$ATUAL"
  systemctl restart crm
}

# Qualquer resposta HTTP serve: a API está de pé.
api_respondendo() {
  local tentativa status
  for tentativa in $(seq 1 20); do
    status="$(curl -s -o /dev/null -w '%{http_code}' "$ENDERECO_DA_API" || true)"
    [[ "$status" != "000" ]] && return 0
    sleep 1
  done
  return 1
}

apagar_versoes_antigas() {
  local no_ar velha
  no_ar="$(versao_no_ar)"
  for velha in $(ls -1 "$VERSOES" | grep -E "$NOME_VALIDO" | sort -r | tail -n +$((VERSOES_GUARDADAS + 1))); do
    if [[ "$velha" != "$no_ar" ]]; then rm -rf "${VERSOES:?}/$velha"; fi
  done
}

falhar() {
  echo "$1" >&2
  exit 1
}

principal "$@"
