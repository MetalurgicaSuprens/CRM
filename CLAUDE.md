## O que é

CRM dos representantes comerciais da Suprens, acessado pela internet.
O plano aprovado está em `docs/plano.md`: arquitetura, fases, regras de negócio e pendências. Leia antes de começar uma fase.
Quem continua o projeto lê também `docs/passagem.md`: onde paramos, as decisões do Lucas, o ERP e os cuidados no Windows.

## Estilo de código

Ao escrever ou editar qualquer código (extrator, server, web), siga @CLEAN_CODE.md como guideline padrão.

## Segurança: regras inegociáveis

O sistema fica exposto na internet e guarda dados comerciais da Suprens. Na dúvida, escolha o mais seguro e avise o Lucas.

1. **Só o `extrator/` fala com o Oracle.**
   - `server/` e `web/` nunca importam o driver Oracle, não leem credencial de banco e não acessam a rede interna.
   - Os dados chegam pela `foto.db`, somente leitura.
2. **Nenhum segredo no git.**
   - `.env`, chaves SSH, certificados e bancos (`*.db`) ficam fora; o `.gitignore` bloqueia.
   - Não leia nem imprima valores de `.env`, só os nomes das chaves.
3. **Minimização de dados.**
   - Só entra na foto o campo que alguma tela usa.
   - Nunca extrair: contatos, telefones, e-mails, CPF, restrição financeira, dados bancários, senhas, endereço de pessoa física.
   - O código do cliente no ERP só sai da LAN quando é de empresa: ele contém o CNPJ, que é público. Na pessoa física ele é o CPF, e a tela mostra "Pessoa física".
   - O endereço também só sai quando é de empresa, porque é público no CNPJ (decisão do Lucas em 2026-10-19). O ponto no mapa sai do Cadastro de Endereços do IBGE, buscado aqui dentro: o extrator não manda endereço a serviço de fora. Só o link do Google Maps leva um endereço ao Google, quando o representante clica.
4. **Escopo seguro por padrão.**
   - Toda rota declara `config.acesso` (`publico`, `representante` ou `admin`).
   - Os códigos do representante vêm sempre da sessão. Um login pode ter mais de um código, e as telas somam todos.
   - Nenhuma rota `publico` ou `representante` aceita código de representante ou de tabela de preço vindo do navegador.
   - Única exceção: a rota de admin que liga o login aos códigos. Ela só existe na API de admin (só LAN), confere o código contra a lista de autorizados da foto e grava auditoria.
   - Rota nova entra no teste que confere que o login A recebe 404 nos dados dos códigos de B.
5. **Entrada é hostil.**
   - Valide na borda com o schema do Fastify (`additionalProperties: false`).
   - Pedido só chega ao ERP pela LAN, revalidado no Oracle, e nasce bloqueado no SGI.
6. **Logs sem dados pessoais.**
   - Registre só rota, status, tempo e id do usuário.
   - Nunca query string, corpo, cookie ou nome de cliente.
7. **Dependências com motivo.**
   - Versões fixas; prefira o que o Node e o Fastify já oferecem.
   - Pacote fora do que o plano prevê: pergunte ao Lucas antes.
8. **Frontend compatível com CSP estrita.**
   - Sem script ou estilo inline e sem `dangerouslySetInnerHTML`.
   - Nenhum recurso de outro domínio: fontes e imagens são hospedadas aqui.

## Dados

- Tudo o que a tela mostra vem da `foto.db`, gerada pelo extrator na LAN. Não existe consulta ao vivo no Oracle, ao contrário do Gestao.
- O que o próprio CRM produz (usuários, chaves, sessões, auditoria, pré-pedidos) fica no `app.db`.
- Toda tela mostra a hora do dado.
- O faturamento segue a definição do Gestao/RELCUS001 (`docs/plano.md`).

## Git: commit e push a cada etapa

- Sem branches: todo trabalho vai direto no `main`.
- Ao terminar cada etapa, faça commit e `git push` para o `origin` (https://github.com/MetalurgicaSuprens/CRM).
- Antes do push, rode `git fetch`. Só se estiver "behind", rode `git pull --rebase`.
- Se o pull recusar por mudança sem commit de outro agente, não faça stash: avise o Lucas.
- Commits pequenos, só com os arquivos que você alterou. Nunca use `--force`.
- Tela nova fica fora do menu até o Lucas aprovar.
- O servidor recebe o código por pacote montado aqui (`deploy/`), nunca por `git pull` no servidor.
