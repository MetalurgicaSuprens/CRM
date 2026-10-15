# CRM Representantes — Suprens

Ferramenta para os representantes comerciais da Suprens:
- acompanhar a carteira;
- analisar o desempenho dos clientes;
- lançar pedidos que seguem para o ERP pelo caminho de sempre.

O acesso é pela internet. O site nunca fala com o banco: os dados chegam por uma foto gerada na rede interna.

- Plano, arquitetura e fases: [docs/plano.md](docs/plano.md)
- Regras de trabalho: [CLAUDE.md](CLAUDE.md) e [CLEAN_CODE.md](CLEAN_CODE.md)

## Estrutura

Cada pasta é criada na fase em que começa a ser usada.

| Pasta | Onde roda | Papel |
|---|---|---|
| `dominio/` | Todos | Regras do negócio e formatos compartilhados: análises, mix, ciclo, datas e o esquema da foto |
| `extrator/` | LAN | Lê o Oracle, gera a `foto.db`, envia ao servidor e leva os pedidos ao SGI |
| `server/` | Servidor | API sem acesso ao banco: lê a foto e guarda usuários, sessões e pedidos no `app.db` |
| `web/` | Navegador | Telas (React), servidas pelo Apache |
| `deploy/` | Servidor | Apache, systemd, SFTP e firewall |

## Como rodar

- **Protótipo com dados fictícios:** `npm run dev:web` (http://localhost:5175). Para o celular na rede interna, `iniciar-crm-servidor.bat`.
- **Dados reais, só neste computador:** `ver-crm-com-dados-reais.bat`. Ele gera a foto, sobe a API e o site e abre o navegador. Para entrar, a chave de acesso (F3). Antes da primeira vez, crie:
  - `extrator/.env`, com o acesso ao Oracle (chaves em `extrator/.env.example`);
  - `data/representantes-autorizados.txt`, com os códigos que entram na foto, um por linha;
  - depois da primeira foto, o seu login: `npm run admin -- convidar --nome "Star Vendas" --codigos 1401,1402`. Abra no Chrome ou no Edge o link do convite que ele escreve e crie a chave com o PIN ou a digital do Windows.
  - O `server/.env` é opcional neste computador (chaves em `server/.env.example`).
- **Logins:** `npm run admin` mostra os comandos: `convidar`, `novo-convite` (aparelho novo ou perdido), `usuarios`, `revogar` e `desativar`. Na produção, rodam no servidor, por SSH.
- **Só a foto:** `npm run foto` (ou `npm run foto -- --env <outro .env>`). A foto vai para `data/fotos/`, e a API passa a usar a mais nova em até 30 s.
- **Testes e tipos:** `npm test` e `npm run typecheck`.
