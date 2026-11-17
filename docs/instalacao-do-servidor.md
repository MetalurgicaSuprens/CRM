# Instalação do servidor do CRM: passo a passo para o TI

Situação em 2026-11-17. Quem instala é o TI da Suprens; as dúvidas sobre o CRM ficam com o Lucas.

O CRM fica numa VPS Linux da Locaweb, exposta na internet. Ela guarda a carteira dos representantes. O servidor **nunca** fala com o banco nem com a rede da empresa: quem leva os dados até ele é o extrator, numa VM da empresa.

## Os dados desta instalação

| O quê | Valor |
|---|---|
| VPS | `crm-representantes`, vps74205.publiccloud.com.br, 4 GB, 2 vCPU, 70 GB |
| IP público da VPS | `177.153.193.33` |
| Endereço do CRM | `https://crm.suprens.com.br`. Não muda depois: as chaves de acesso dos celulares ficam presas a ele |
| IP de saída da empresa | `<IP_DA_EMPRESA>`: o IP público com que a VM do extrator sai para a internet. Se houver mais de um link, todos |

## Como as peças se falam

```
Celular do representante ──443──► Apache ──► API do CRM (127.0.0.1:5176)
VM do extrator (empresa) ──22───► conta crm-troca (SFTP, presa em /srv/crm-troca)
TI ou Lucas ──22, túnel SSH──► administração (127.0.0.1:5179 → API 127.0.0.1:5178)
VPS ──► rede da empresa: nunca
```

Só duas portas abertas: **443 para todos** e **22 só para `<IP_DA_EMPRESA>`**. A porta 80 fica fechada.

## 0. Antes de começar

1. **DNS:** no DNS do suprens.com.br, um registro **A**, nome `crm`, apontando para `177.153.193.33`. O certificado só sai depois que esse registro responde.
2. **Locaweb:** confirmar se o painel tem firewall por IP, quantos snapshots o plano inclui, se o datacenter fica no Brasil e se há termo de tratamento de dados (LGPD).
3. **Sistema:** os comandos abaixo são para Ubuntu Server 24.04 LTS. Se a imagem da VPS for outra, ajuste os nomes dos pacotes.
4. **Snapshot** da VPS limpa, pelo painel, antes de qualquer passo.

## 1. Acesso e proteção básica

1. Troque a senha de root pelo painel e guarde num cofre de senhas. Ela não vai para e-mail nem chat.
2. Crie um usuário de administração com sudo e entre só por chave SSH (ed25519):
   ```bash
   adduser --disabled-password ti-crm
   usermod -aG sudo ti-crm
   install -d -m 700 -o ti-crm -g ti-crm /home/ti-crm/.ssh
   # cole a chave pública em /home/ti-crm/.ssh/authorized_keys (dono ti-crm, modo 600)
   ```
3. Em `/etc/ssh/sshd_config.d/10-crm.conf`:
   ```
   PermitRootLogin no
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   AllowUsers ti-crm crm-troca
   ```
   Teste o login com a chave **numa segunda janela** antes de fechar a primeira. Depois, `systemctl reload ssh`.
4. Atualizações de segurança automáticas:
   ```bash
   apt update && apt full-upgrade -y
   apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
   timedatectl set-timezone America/Sao_Paulo
   ```

## 2. Firewall

```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 443/tcp
ufw allow from <IP_DA_EMPRESA> to any port 22 proto tcp
ufw enable
```

Se o painel da Locaweb tiver firewall, repita lá as mesmas duas regras: elas viram duas camadas.

Antes do `ufw enable`, confirme que você está entrando a partir do IP da empresa. Senão, o acesso cai e só volta pelo console do painel.

## 3. Node.js 24 e o usuário do serviço

1. Node 24 LTS, pelo pacote oficial do nodejs.org (binário linux-x64), conferido com o `SHASUMS256.txt` publicado ao lado, instalado em `/opt/node24`, com link em `/usr/local/bin/node`. O servidor não usa npm.
2. Usuário do serviço, sem login:
   ```bash
   adduser --system --group --home /srv/crm --shell /usr/sbin/nologin crm
   install -d -m 750 -o crm -g crm /srv/crm/dados /srv/crm/dados/fotos-conferidas
   install -d -m 755 -o root -g root /srv/crm/versoes
   ```

## 4. Conta de troca de arquivos (`crm-troca`)

É por ela que o extrator entrega as fotos dos dados. Ela só enxerga a própria pasta.

```bash
adduser --disabled-password --shell /usr/sbin/nologin --gecos "" crm-troca
install -d -m 755 -o root -g root /srv/crm-troca           # o chroot tem de ser do root
install -d -m 2750 -o crm-troca -g crm /srv/crm-troca/entrada
install -d -m 700 -o crm-troca -g crm-troca /home/crm-troca/.ssh
```

Ao fim do mesmo `/etc/ssh/sshd_config.d/10-crm.conf`:

```
Match User crm-troca
    ChrootDirectory /srv/crm-troca
    ForceCommand internal-sftp -u 0027
    AllowTcpForwarding no
    X11Forwarding no
    PermitTTY no
```

Em `/home/crm-troca/.ssh/authorized_keys` (dono crm-troca, modo 600), uma linha com a chave **pública** do extrator, que o Lucas entrega:

```
restrict,from="<IP_DA_EMPRESA>" ssh-ed25519 AAAA... extrator-crm
```

O `2750` com o grupo `crm` deixa o serviço do CRM **ler** as fotos, sem gravar. Só o extrator escreve na entrada.

## 5. Apache

```bash
apt install -y apache2
a2enmod ssl md headers proxy proxy_http reqtimeout
a2dissite 000-default
```

Em `/etc/apache2/conf-available/crm-seguranca.conf` (ative com `a2enconf crm-seguranca`):

```
ServerTokens Prod
ServerSignature Off
TraceEnable off
```

Em `/etc/apache2/ports.conf`, troque o `Listen 80` por `Listen 443` e `Listen 127.0.0.1:5179`.

Em `/etc/apache2/sites-available/crm.conf` (ative com `a2ensite crm`):

```apache
MDomain crm.suprens.com.br
MDCertificateAgreement accepted
MDCAChallenges tls-alpn-01
MDContactEmail <e-mail do TI>

<VirtualHost *:443>
    ServerName crm.suprens.com.br
    Protocols h2 http/1.1 acme-tls/1
    SSLEngine on
    SSLProtocol -all +TLSv1.2 +TLSv1.3

    DocumentRoot /srv/crm/atual/web
    <Directory /srv/crm/atual/web>
        Options -Indexes
        AllowOverride None
        Require all granted
        FallbackResource /index.html
    </Directory>

    # A API: o Apache apaga o X-Forwarded-For de fora e põe o dele; a API só confia nele.
    RequestHeader unset X-Forwarded-For early
    ProxyPass        /api/ http://127.0.0.1:5176/api/
    ProxyPassReverse /api/ http://127.0.0.1:5176/api/

    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"
    Header always set Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "no-referrer"
    Header always set Cross-Origin-Opener-Policy "same-origin"
    Header always set Cross-Origin-Resource-Policy "same-origin"
    Header always set Permissions-Policy "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()"
</VirtualHost>

# A administração: só nesta máquina, aberta por túnel SSH.
<VirtualHost 127.0.0.1:5179>
    ServerName localhost
    DocumentRoot /srv/crm/atual/web-admin
    <Directory /srv/crm/atual/web-admin>
        Options -Indexes
        AllowOverride None
        Require local
        FallbackResource /index.html
    </Directory>
    ProxyPass        /api/ http://127.0.0.1:5178/api/
    ProxyPassReverse /api/ http://127.0.0.1:5178/api/
</VirtualHost>
```

O `Permissions-Policy` deixa a localização ligada porque o "Perto de mim" do mapa pede a posição ao celular.

Depois do primeiro `systemctl restart apache2`, o mod_md pede o certificado sozinho. Um segundo `restart` o coloca em uso. Ele também renova sozinho.

## 6. O CRM

### O pacote

O código chega como um pacote `.tar.gz`. O pacote é montado num computador da empresa a partir do repositório https://github.com/MetalurgicaSuprens/CRM, e o servidor **nunca** roda `git` nem `npm`. O pacote traz:

- `server/` e `dominio/`, com as dependências de produção;
- `web/`, o site montado com os dados reais;
- `web-admin/`, o site da administração.

Para montar (Node 24, numa pasta limpa):

```bash
git clone https://github.com/MetalurgicaSuprens/CRM crm && cd crm
npm ci
npm run typecheck && npm test                 # tudo tem de passar
npm run build --workspace web -- --mode real  # web/dist: o site com os dados reais
npm run build:admin --workspace web           # web/dist-admin: a administração
npm ci --omit=dev --ignore-scripts --workspace server --workspace dominio
```

Monte o `.tar.gz` com uma pasta `<versao>` contendo:
- `server/` sem `.env` e sem testes;
- `dominio/`;
- `node_modules/`;
- `web/dist`, renomeada para `web/`;
- `web/dist-admin`, renomeada para `web-admin/`.

**Confira antes de mandar:** o pacote não pode ter `oracledb`, `ssh2` nem nenhum `.env`, `.db` ou chave. O driver do Oracle só existe na VM do extrator.

Cada versão vai para uma pasta própria, e o link `atual` aponta para a que está no ar:

```bash
tar -xzf crm-<versao>.tar.gz -C /srv/crm/versoes/   # cria /srv/crm/versoes/<versao>
ln -s /etc/crm/crm.env /srv/crm/versoes/<versao>/server/.env
ln -sfn /srv/crm/versoes/<versao> /srv/crm/atual
systemctl restart crm
```

O CRM lê a configuração só do arquivo `server/.env` da versão, por isso o link para `/etc/crm/crm.env` em cada versão nova.

Para voltar uma versão, aponte o `atual` para a anterior e reinicie.

### A configuração

Em `/etc/crm/crm.env` (dono root, grupo crm, modo 640). Nada disso é segredo, e o servidor não tem senha de banco nenhuma:

```
CRM_PORTA=5176
CRM_PORTA_DO_ADMIN=5178
CRM_ORIGEM=https://crm.suprens.com.br
CRM_ORIGEM_DO_ADMIN=http://localhost:5179
CRM_PASTA_DE_ENTRADA=/srv/crm-troca/entrada
CRM_PASTA_DAS_FOTOS_CONFERIDAS=/srv/crm/dados/fotos-conferidas
CRM_ARQUIVO_DO_APP=/srv/crm/dados/app.db
```

### O serviço

Em `/etc/systemd/system/crm.service`:

```ini
[Unit]
Description=CRM dos representantes
After=network.target

[Service]
User=crm
Group=crm
Environment=NODE_ENV=production
WorkingDirectory=/srv/crm/atual/server
ExecStart=/usr/local/bin/node src/principal.ts
Restart=on-failure
RestartSec=5

NoNewPrivileges=yes
CapabilityBoundingSet=
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ReadWritePaths=/srv/crm/dados
ReadOnlyPaths=/srv/crm-troca/entrada
IPAddressDeny=any
IPAddressAllow=localhost
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now crm
journalctl -u crm -n 20   # deve mostrar as duas APIs em 127.0.0.1
```

O `IPAddressDeny=any` impede o CRM de abrir conexão para fora da própria máquina, nem que alguém o invada.

### A chave de acesso do Lucas

```bash
cd /srv/crm/atual/server
sudo -u crm NODE_ENV=production node src/admin/linhaDeComando.ts criar-admin --nome "Lucas"
```

O comando escreve um link. O Lucas abre esse link pelo túnel da administração (abaixo) e cria a chave de acesso dele.

## 7. Abrir a administração

Do computador do Lucas ou do TI, na rede da empresa:

```bash
ssh -N -L 5179:127.0.0.1:5179 ti-crm@177.153.193.33
```

Com a janela aberta, abra http://localhost:5179 no Chrome ou no Edge. A administração nunca fica na internet.

## 8. Conferir antes de liberar aos representantes

- [ ] `https://crm.suprens.com.br` abre com cadeado e mostra a tela de entrar.
- [ ] https://www.ssllabs.com/ssltest/: nota **A+**.
- [ ] https://securityheaders.com: nota **A** ou melhor.
- [ ] De fora da empresa, uma varredura de portas (ex.: `nmap 177.153.193.33`) mostra **só a 443** aberta.
- [ ] Da VM do extrator, `sftp crm-troca@177.153.193.33` entra e só vê `/entrada`; um `ssh` comum com a mesma conta é recusado.
- [ ] Depois do primeiro envio do extrator, em até 30 s o `journalctl -u crm` não mostra recusa, e a tela mostra a hora dos dados.
- [ ] `systemctl show crm -p IPAddressDeny -p IPAddressAllow` mostra o bloqueio: o serviço não sai da máquina.
- [ ] Snapshot da VPS pronta, pelo painel.

## 9. Depois: o que entra com os pedidos (F5)

Quando o envio de pedidos ficar pronto, entram:

- uma pasta de saída dos pedidos, que o extrator busca pela mesma conta `crm-troca`;
- a cópia da auditoria para a empresa;
- o backup do `app.db`.

Este roteiro será atualizado nessa hora. Nada disso abre porta nova: é sempre a VM da empresa que chama o servidor.
