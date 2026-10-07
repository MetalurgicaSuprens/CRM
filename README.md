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
| `extrator/` | LAN | Lê o Oracle, gera a `foto.db`, envia ao servidor e leva os pedidos ao SGI |
| `server/` | Servidor | API sem acesso ao banco: lê a foto e guarda usuários, sessões e pedidos no `app.db` |
| `web/` | Navegador | Telas (React), servidas pelo Apache |
| `deploy/` | Servidor | Apache, systemd, SFTP e firewall |
