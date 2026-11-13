#!/usr/bin/env bash
# Prepara a VPS da Locaweb (Ubuntu Server 24.04 LTS limpo) para o CRM (deploy/README.md):
#   sudo bash preparar-servidor.sh servidor.conf
# Instala o Apache e o Node 24, cria as contas, a pasta de troca da foto, o serviço confinado da API e o
# firewall, e fecha o SSH para só chave e só o IP da Suprens. Pode rodar de novo: cada passo deixa o
# servidor no estado descrito aqui, por exemplo depois de preencher a chave do extrator.
set -euo pipefail

readonly PASTA="$(cd "$(dirname "$0")" && pwd)"
readonly CHAVE_VALIDA='^ssh-ed25519 [A-Za-z0-9+/]+=*( [^"]*)?$'

principal() {
  [[ $EUID -eq 0 ]] || falhar "Rode como root: sudo bash preparar-servidor.sh servidor.conf"
  carregar_configuracao "${1:-}"
  conferir_de_onde_vem_a_conexao
  instalar_pacotes
  instalar_node
  criar_contas
  criar_pastas
  configurar_ssh
  configurar_apache
  instalar_servicos
  configurar_firewall
  mostrar_proximos_passos
}

carregar_configuracao() {
  local arquivo="$1"
  [[ -f "$arquivo" ]] || falhar "Diga o arquivo de configuração (copie o servidor.conf.example para servidor.conf e preencha)."
  # shellcheck source=/dev/null
  source "$arquivo"
  [[ "${DOMINIO:-}" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$ ]] || falhar "DOMINIO inválido: use só o nome, como crm.suprens.com.br."
  [[ "${IP_DA_EMPRESA:-}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || falhar "IP_DA_EMPRESA inválido: o IP fixo da internet da Suprens, como 200.150.10.20."
  [[ "${EMAIL_DO_CERTIFICADO:-}" =~ ^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[a-z]{2,}$ ]] || falhar "EMAIL_DO_CERTIFICADO inválido."
  [[ "${USUARIO_ADMIN:-}" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || falhar "USUARIO_ADMIN inválido: letras minúsculas, números e hífen."
  [[ "$USUARIO_ADMIN" != "root" && "$USUARIO_ADMIN" != crm* ]] || falhar "USUARIO_ADMIN não pode ser root nem começar com crm."
  [[ "${CHAVE_DO_ADMIN:-}" =~ $CHAVE_VALIDA ]] || falhar "CHAVE_DO_ADMIN inválida: uma linha \"ssh-ed25519 AAAA... nome\"."
  [[ -z "${CHAVE_DO_EXTRATOR:-}" || "$CHAVE_DO_EXTRATOR" =~ $CHAVE_VALIDA ]] || falhar "CHAVE_DO_EXTRATOR inválida: uma linha \"ssh-ed25519 AAAA... nome\", ou vazia."
  grep -q 'VERSION_ID="24.04"' /etc/os-release || echo "Aviso: o CRM foi preparado para o Ubuntu 24.04; este servidor é outro." >&2
}

# O firewall vai aceitar SSH só do IP da Suprens. Quem roda isto de outro IP ficaria trancado para fora.
conferir_de_onde_vem_a_conexao() {
  local ip_da_conexao="${SSH_CONNECTION%% *}"
  [[ -z "${SSH_CONNECTION:-}" || "$ip_da_conexao" == "$IP_DA_EMPRESA" ]] || falhar \
    "Você está conectado do IP $ip_da_conexao, e o servidor vai aceitar SSH só de $IP_DA_EMPRESA. Conecte pela rede da Suprens (ou pela VPN) ou pelo console da Locaweb e rode de novo."
}

instalar_pacotes() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get -y upgrade
  apt-get -y install apache2 ufw unattended-upgrades curl ca-certificates gnupg
}

# Node 24 do repositório da NodeSource, assinado, que só traz versões 24.x. As atualizações de
# segurança dele entram junto com as do Ubuntu.
instalar_node() {
  if ! node --version 2>/dev/null | grep -q '^v24\.'; then
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update
    apt-get -y install nodejs
  fi
  cat > /etc/apt/apt.conf.d/52crm-atualizacoes <<'FIM'
Unattended-Upgrade::Origins-Pattern { "site=deb.nodesource.com"; };
FIM
  dpkg-reconfigure -f noninteractive unattended-upgrades
}

criar_contas() {
  id crm >/dev/null 2>&1 || useradd --system --home-dir /var/lib/crm --shell /usr/sbin/nologin crm
  # Sem senha, mas não bloqueada: o SSH recusa a chave de conta bloqueada.
  id crm-troca >/dev/null 2>&1 || useradd --system --home-dir /entrada --shell /usr/sbin/nologin crm-troca
  usermod -p '*' crm-troca
  id "$USUARIO_ADMIN" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash --groups sudo "$USUARIO_ADMIN"
  install -d -o "$USUARIO_ADMIN" -g "$USUARIO_ADMIN" -m 0700 "/home/$USUARIO_ADMIN/.ssh"
  echo "$CHAVE_DO_ADMIN" > "/home/$USUARIO_ADMIN/.ssh/authorized_keys"
  chown "$USUARIO_ADMIN:$USUARIO_ADMIN" "/home/$USUARIO_ADMIN/.ssh/authorized_keys"
  chmod 0600 "/home/$USUARIO_ADMIN/.ssh/authorized_keys"
  if [[ "$(passwd --status "$USUARIO_ADMIN" | awk '{print $2}')" != "P" ]]; then
    echo "Crie a senha do $USUARIO_ADMIN. Ela só serve para o sudo; a entrada pela rede é só com a chave."
    passwd "$USUARIO_ADMIN"
  fi
}

# A foto chega em /srv/crm-troca/entrada, que só o crm-troca grava e o grupo crm (a API) lê. O app.db e
# as fotos conferidas ficam em /var/lib/crm, só da conta crm.
criar_pastas() {
  install -d -o root -g root -m 0755 /opt/crm /opt/crm/versoes
  install -d -o root -g crm -m 0750 /etc/crm
  install -d -o crm -g crm -m 0700 /var/lib/crm
  install -d -o root -g root -m 0755 /srv/crm-troca
  install -d -o crm-troca -g crm -m 2750 /srv/crm-troca/entrada
  gravar_configuracao_da_api
  gravar_chave_do_extrator
  install -o root -g root -m 0755 "$PASTA/publicar.sh" /opt/crm/publicar.sh
  install -o root -g root -m 0755 "$PASTA/crm-admin" /usr/local/bin/crm-admin
}

gravar_configuracao_da_api() {
  install -o root -g crm -m 0640 /dev/null /etc/crm/server.env
  cat > /etc/crm/server.env <<FIM
# Gerado pelo preparar-servidor.sh; as chaves estão em server/.env.example.
CRM_PORTA=5176
CRM_PASTA_DE_ENTRADA=/srv/crm-troca/entrada
CRM_PASTA_DAS_FOTOS_CONFERIDAS=/var/lib/crm/fotos-conferidas
CRM_ARQUIVO_DO_APP=/var/lib/crm/app.db
CRM_ORIGEM=https://$DOMINIO
CRM_PORTA_DO_ADMIN=5178
CRM_ORIGEM_DO_ADMIN=http://localhost:5179
FIM
}

# restrict: sem terminal, túnel nem repasse. from=: só do IP da Suprens, mesmo com a chave roubada.
gravar_chave_do_extrator() {
  install -o root -g root -m 0644 /dev/null /etc/crm/troca-authorized_keys
  if [[ -n "${CHAVE_DO_EXTRATOR:-}" ]]; then
    echo "restrict,from=\"$IP_DA_EMPRESA\" $CHAVE_DO_EXTRATOR" > /etc/crm/troca-authorized_keys
  fi
}

configurar_ssh() {
  sed "s/@USUARIO_ADMIN@/$USUARIO_ADMIN/g" "$PASTA/ssh/10-crm.conf" > /etc/ssh/sshd_config.d/10-crm.conf
  chmod 0644 /etc/ssh/sshd_config.d/10-crm.conf
  sshd -t || falhar "A configuração do SSH tem erro; o SSH não foi reiniciado."
  sshd -T -C "user=crm-troca,host=extrator,addr=$IP_DA_EMPRESA" | grep -q '^chrootdirectory /srv/crm-troca$' \
    || falhar "O SSH não prendeu o crm-troca na pasta de troca; o SSH não foi reiniciado."
  systemctl restart ssh
}

configurar_apache() {
  a2enmod -q ssl md headers proxy proxy_http http2 reqtimeout
  a2dismod -q -f autoindex status cgi 2>/dev/null || true
  a2dissite -q 000-default default-ssl 2>/dev/null || true
  a2disconf -q security serve-cgi-bin 2>/dev/null || true
  install -m 0644 "$PASTA/apache/ports.conf" /etc/apache2/ports.conf
  install -m 0644 "$PASTA/apache/crm-seguranca.conf" /etc/apache2/conf-available/crm-seguranca.conf
  install -d -m 0755 /etc/apache2/crm
  install -m 0644 "$PASTA/apache/cabecalhos.conf" /etc/apache2/crm/cabecalhos.conf
  sed -e "s/@DOMINIO@/$DOMINIO/g" -e "s/@EMAIL_DO_CERTIFICADO@/$EMAIL_DO_CERTIFICADO/g" "$PASTA/apache/crm.conf" > /etc/apache2/sites-available/crm.conf
  install -m 0644 "$PASTA/apache/crm-admin.conf" /etc/apache2/sites-available/crm-admin.conf
  a2enconf -q crm-seguranca
  a2ensite -q crm crm-admin
  apache2ctl configtest || falhar "A configuração do Apache tem erro."
  systemctl restart apache2
}

instalar_servicos() {
  install -m 0644 "$PASTA/systemd/crm.service" "$PASTA/systemd/crm-recarregar-apache.service" "$PASTA/systemd/crm-recarregar-apache.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable crm.service
  systemctl enable --now crm-recarregar-apache.timer
}

# Entra: o site (443) de qualquer lugar; o SSH (22) só da Suprens. Sai: só DNS, hora certa e HTTPS/HTTP
# (atualizações e certificado). A porta 80 não abre para entrar.
configurar_firewall() {
  ufw --force reset >/dev/null
  ufw default deny incoming
  ufw default deny outgoing
  ufw allow in 443/tcp comment "site do CRM"
  ufw allow in from "$IP_DA_EMPRESA" to any port 22 proto tcp comment "SSH e foto, so da Suprens"
  ufw allow out 53 comment "DNS"
  ufw allow out 123/udp comment "hora certa"
  ufw allow out 80/tcp comment "atualizacoes"
  ufw allow out 443/tcp comment "atualizacoes e certificado"
  ufw --force enable
}

mostrar_proximos_passos() {
  cat <<FIM

Servidor preparado. Antes de fechar esta janela, abra outra e confira que entra com a chave:
  ssh $USUARIO_ADMIN@$DOMINIO

A linha do servidor para o extrator (data/envio/servidor-conhecido, na máquina do extrator):
  crm-servidor $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)

Próximos passos (deploy/README.md):
  1. No computador de desenvolvimento: npm run pacote. Leve o pacote ao servidor e rode
     sudo /opt/crm/publicar.sh <pacote>.
  2. Crie o primeiro admin: sudo crm-admin criar-admin --nome "Seu nome".
FIM
  [[ -n "${CHAVE_DO_EXTRATOR:-}" ]] || echo "  Falta a chave do extrator: preencha CHAVE_DO_EXTRATOR e rode este script de novo."
}

falhar() {
  echo "$1" >&2
  exit 1
}

principal "$@"
