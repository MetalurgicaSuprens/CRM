# Instalação do servidor do CRM

O CRM fica numa VPS Linux da Locaweb (4 GB, 2 vCPU, 70 GB), com Ubuntu Server 24.04 LTS limpo, sem as
"imagens de aplicações" do painel. O servidor recebe o código por um pacote montado no computador de
desenvolvimento: ele nunca roda npm nem git.

| Pasta ou arquivo | O que é |
|---|---|
| `src/montarPacote.ts` | `npm run pacote`: monta o pacote da versão, com a API, as dependências e os dois sites prontos |
| `servidor/preparar-servidor.sh` | Roda uma vez no servidor: Apache, Node 24, contas, SFTP, serviço e firewall |
| `servidor/publicar.sh` | Põe no ar uma versão do pacote, ou volta para a anterior |
| `servidor/crm-admin` | Os comandos de admin no servidor (`sudo crm-admin usuarios`) |
| `servidor/apache/`, `ssh/`, `systemd/` | As configurações que o `preparar-servidor.sh` instala |

## Como fica o servidor

- **Entrada pela internet:** só a porta 443, com o site do CRM. A 80 fica fechada: o certificado do Let's
  Encrypt é pedido pela própria 443.
- **Porta 22 (SSH):** só do IP fixo da Suprens. Quem mexe no servidor de fora entra antes na VPN da empresa.
  - O root não entra pela rede, e a senha não serve: só a chave.
  - Duas contas entram: a de quem administra e a `crm-troca`, por onde o extrator entrega a foto. A
    `crm-troca` fica presa em `/srv/crm-troca`, só com SFTP.
- **Saída:** só DNS, hora certa e HTTP/HTTPS, para as atualizações e o certificado. A API do CRM não sai
  da máquina.
- **API:** o serviço `crm`, confinado pelo systemd. Escuta só em 127.0.0.1 e grava só em `/var/lib/crm`
  (o `app.db` e as fotos conferidas).
- **Administração:** um site só da máquina (127.0.0.1:5179). Abre por túnel SSH:
  `ssh -L 5179:127.0.0.1:5179 <conta>@<domínio>` e, no navegador, http://localhost:5179.
- **Atualizações de segurança:** automáticas, do Ubuntu e do Node 24.

| Caminho | Conteúdo |
|---|---|
| `/opt/crm/versoes/<versão>` | Cada versão publicada; ficam as 5 mais novas |
| `/opt/crm/atual` | Atalho para a versão no ar |
| `/etc/crm/server.env` | A configuração da API, gerada pelo `preparar-servidor.sh` |
| `/var/lib/crm` | O `app.db` e as fotos conferidas, só da conta `crm` |
| `/srv/crm-troca/entrada` | Onde o extrator entrega a foto e o manifesto |

## Antes de começar

1. **O domínio:** o registro DNS do CRM (por exemplo `crm.suprens.com.br`) aponta para o IP da VPS. A chave
   de acesso dos representantes fica presa a ele, então ele não muda depois.
2. **O IP fixo da internet da Suprens.**
3. **A chave de quem administra:** no computador dela, `ssh-keygen -t ed25519`. A chave pública é o arquivo
   `.pub`.
4. **A chave do extrator:** pode ficar para depois, quando a máquina do extrator for escolhida.

## Preparar o servidor (uma vez)

1. Copie `servidor/servidor.conf.example` para `servidor.conf` e preencha.
2. Leve a pasta `servidor/` para a VPS e entre como root. Use a rede da Suprens ou a VPN: o script se recusa
   a fechar o SSH para quem está conectado de outro IP. O console da Locaweb também serve.
   ```bash
   scp -r deploy/servidor root@<ip-da-vps>:/root/crm-servidor
   ```
3. Na VPS:
   ```bash
   sudo bash /root/crm-servidor/preparar-servidor.sh /root/crm-servidor/servidor.conf
   ```
   Ele pede a senha da conta de quem administra, que serve só para o `sudo`.
4. **Antes de fechar a janela do root,** abra outra e confira que entra com a chave:
   `ssh <conta>@<domínio>`.
5. Guarde a linha `crm-servidor ssh-ed25519 ...` que ele mostra no fim. Ela vai para
   `data/envio/servidor-conhecido` na máquina do extrator, que assim só envia a foto para este servidor.

O certificado chega em alguns minutos, depois que o DNS aponta para a VPS. Para ele valer na hora, rode
`sudo systemctl reload apache2`; senão, ele vale na recarga automática da madrugada.

## Publicar uma versão

1. No computador de desenvolvimento, com tudo em commit:
   ```bash
   npm run pacote
   ```
   O pacote sai em `deploy/pacotes/`. A montagem para se o pacote fosse levar segredo, banco de dados, o
   extrator ou o driver do Oracle.
2. Leve o pacote e publique:
   ```bash
   scp deploy/pacotes/crm-<versão>.tar.gz <conta>@<domínio>:
   ```
   ```bash
   ssh -t <conta>@<domínio> sudo /opt/crm/publicar.sh crm-<versão>.tar.gz
   ```
   Se a API não responder com a versão nova, ele volta sozinho para a anterior. Para voltar à mão:
   `sudo /opt/crm/publicar.sh --voltar`. A versão anterior pode não abrir o `app.db` se a nova o mudou.
3. Na primeira vez, crie o seu login de admin e abra o link do convite pelo túnel:
   ```bash
   sudo crm-admin criar-admin --nome "Seu nome"
   ```

## Conferir

- `systemctl status crm` e `journalctl -u crm`: a API.
- `systemd-analyze security crm`: o confinamento (quanto menor a nota, melhor).
- `sudo ufw status verbose`: o firewall.
- De fora: o SSL Labs deve dar nota A+, e uma varredura de portas só deve achar a 443.

## Ainda não está aqui

- A busca dos pedidos, da auditoria e do backup pela rede interna, que entram com a F5. Até lá, use os
  snapshots da Locaweb.
- A rota `/api/saude` e os alertas do plano (foto atrasada, servidor sem sinal de vida, disco cheio).
- Os scripts do servidor ainda não rodaram num Ubuntu de verdade: confira cada passo na primeira instalação.
