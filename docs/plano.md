# CRM Representantes — recomeço do zero

## Contexto

O protótipo atual foi feito antes do acesso ao banco, a partir de exportações `.txt`, e serviu só para testes internos. O Lucas decidiu recomeçar do zero e aproveitar apenas o módulo de mapa, que usa a base do IBGE.

Objetivo: uma ferramenta, acessível pela **internet aberta**, para os **representantes externos**:
- acompanharem a própria carteira;
- analisarem o desempenho dos clientes: quem parou de comprar, quem compra mais, quem compra menos;
- lançarem pedidos que chegam ao ERP **pelo mesmo caminho de hoje**.

Requisitos:
- Segurança máxima.
- Servidor Linux + Apache **dentro da empresa**.
- O site **nunca** acessa o banco.
- Visual bonito, caprichado e sóbrio.

**Decisões já tomadas com o Lucas**
- Login por chave de acesso (passkey), desbloqueada pelo bloqueio de tela do aparelho: digital, rosto, PIN ou padrão. No notebook sem biometria, o PIN do Windows Hello ou o celular via QR code.
- Sem contatos de cliente nem CPF no CRM. O CNPJ da empresa, que é público, aparece como o código do ERP. A pessoa física entra no CRM sem código à mostra, porque o código dela no ERP é o CPF (decisão do Lucas em 2026-10-13).
- O protótipo fica arquivado só para consulta das regras do ERP: sem dados e sem histórico do git. O mapa sai de lá.
- O repositório vai para a conta **SUPRENS** do GitHub. O `Godcrack93/CRM` será apagado.
- Não haverá perfil "vê tudo"; isso vai para o sistema interno.

**Base do projeto**
- Stack do Gestao: Node 24, Fastify 5, React 19, Vite, React Router, lucide-react, gráficos SVG feitos à mão.
- SQLite pelo `node:sqlite`, como no Gestao (`Gestao/server/src/producao/foto/`).
- Faturamento definido como no Gestao, que bate com o relatório RELCUS001 (`Gestao/server/src/producao/foto/moduloVendasEntradas.ts`).
- Consultas e regras do ERP de referência: `OracleDB/docs`, `SGI12CodigoFonte` e o protótipo arquivado.

## Princípios de segurança

1. **O servidor exposto não conhece a rede interna.** Não tem driver Oracle, credencial de banco nem rota para a LAN. Toda conexão parte da LAN.
2. **O servidor não guarda segredo que abra outra coisa.** Só a chave do certificado TLS e as chaves do SSH.
3. **Minimização de dados.** Só os campos que as telas usam e só os representantes autorizados. O histórico de troca de vendedor (CRCLH) fica na LAN.
4. **Tudo o que vem da internet é hostil:**
   - um pedido só entra no ERP depois da revalidação na LAN, pelo importador do SGI, que recalcula os preços;
   - todo pedido nasce **bloqueado** e passa pelas aprovações humanas, inclusive o de montadora.
5. **Escopo seguro por padrão:**
   - toda rota declara `acesso` (`publico`, `representante` ou `admin`) e o servidor não sobe se alguma rota não declarar;
   - os códigos do representante vêm sempre da sessão. Um login pode ter mais de um código, e as telas somam todos (decisão do Lucas em 2026-10-13);
   - nenhuma rota `publico` ou `representante` aceita código de representante ou de tabela vindo do navegador. A única exceção é a rota de admin que liga o login aos códigos: só existe na API de admin (só LAN), confere o código contra a lista de autorizados da foto e grava auditoria;
   - um teste percorre todas as rotas e confirma que o login A recebe 404 em tudo o que é dos códigos de B.
6. **Defesa em camadas, revisada pelo checklist OWASP ASVS 5.0 nível 2.** Rede isolada → Apache → API → serviço systemd confinado.

## Arquitetura

```
LAN (confiável)                                     Servidor (VM dedicada, rede isolada)
Oracle ─leitura─► extrator ──SFTP──► entrada/foto-<data>.db + manifesto ──► API pública (127.0.0.1)
pasta de cargas do SGI ◄─ validação ◄─ extrator ◄──SFTP── saida/pedidos, saida/auditoria, backup
Lucas (LAN) ──────────────────────────────────────────────────────────────► API de admin (só LAN)
```

### `extrator/` (Node/TS, numa máquina da LAN, conta própria do Windows)

- Conta Oracle **própria**, só com SELECT em views do CRM com as colunas necessárias (ver Pendências), obrigatória **antes do piloto da F4**, quando o extrator passa a rodar sozinho na LAN.
  - Na F2 o desenvolvimento usa o `LUCAS_RO` (decisão do Lucas em 2026-10-09), com quatro cuidados:
    - a senha fica num `extrator/.env` local, que o git ignora e que só o Lucas preenche;
    - só o `extrator/` usa a conexão;
    - o extrator roda à mão, na máquina do Lucas;
    - os dados reais ficam num arquivo local fora do git. O `.bat` da rede continua com os fictícios.
- Gera a `foto.db` já com as regras de negócio calculadas, como a "tela servida pronta" do Gestao: situação, ciclo, análises, mix e município IBGE. A API só faz leituras com escopo e somas simples.
- Antes de gravar:
  - compara a impressão digital com a da última foto;
  - recusa a carga se o volume cair mais de 50% ou subir mais de 50%, ou se a data mais recente voltar no tempo.
- Datas sempre via `TO_CHAR`, para evitar o deslocamento de fuso.
- Fixa a chave do servidor SSH (sem aceitar qualquer servidor).
- Trata os pedidos que chegam do servidor (ver "Pedidos").

### `server/` (Fastify)

São **dois processos/ouvintes**:
- a API pública, que só escuta em `127.0.0.1` atrás do Apache;
- a API de admin, num vhost que só a LAN alcança. O primeiro admin é criado por linha de comando via SSH.

Bancos:
- **`foto.db`**: somente leitura.
- **`app.db`** (o que o próprio CRM produz): usuários, chaves, convites, sessões, auditoria e pré-pedidos.
  - Gravação: modo WAL, `synchronous=FULL`, `foreign_keys=ON`, migrações por `user_version`.
  - Backup diário por `VACUUM INTO`.

Troca da foto:
1. O extrator envia o arquivo como `.part`, renomeia e envia o manifesto por último (sha256, tamanho, versão do esquema, data de geração e contagens).
2. A API copia o arquivo para uma pasta privada e confere hash, `quick_check`, versão, data mais nova que a atual e contagens.
3. A troca é só uma referência em memória, sem janela sem dados. O arquivo antigo é fechado depois.

Outras regras:
- Validação com o schema do próprio Fastify (`additionalProperties:false`). Esquemas de resposta funcionam como lista do que pode sair.
- Erros 5xx sem detalhes para o navegador.
- `trustProxy: '127.0.0.1'`.
- Limite de requisições por IP no login e nos convites, e por usuário no resto.
- Corpo da requisição de até 64 KB.

### `web/`

- Build estático servido pelo Apache, compatível com CSP estrita: sem script ou estilo inline (`assetsInlineLimit: 0`).
- Fontes hospedadas no próprio servidor.
- Sem CORS, porque tudo fica na mesma origem.

### `deploy/` (testado no WSL2 antes do servidor)

Rede:
- Internet → 443.
- LAN → 22 e admin, só do IP do extrator e do Lucas.
- **Servidor → LAN: tudo bloqueado.**
- Saída só para DNS público, NTP, atualizações do sistema e certificado.

Apache:
- Certificado via mod_md, sem porta 80.
- HSTS, CSP (`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`), nosniff, `Referrer-Policy: no-referrer`, COOP/CORP.
- `ServerTokens Prod`, `TraceEnable off`, `mod_reqtimeout`.
- Apaga o `X-Forwarded-For` vindo do cliente.

Serviço systemd confinado:
- `ProtectSystem=strict`, `IPAddressDeny=any` (com localhost liberado), `NoNewPrivileges`, sem capabilities.

SFTP:
- Conta `crm-troca` com chroot, `internal-sftp` e chave `restrict,from=<IP>`.
- Um único escritor por pasta.

Publicação:
- Um pacote montado no PC de desenvolvimento (`npm ci --omit=dev --ignore-scripts`).
- O servidor nunca roda npm nem git. Versões fixas e Dependabot.

## Login e sessão

**Convite**
- O admin cria o usuário do representante, liga a ele os códigos do ERP e gera um convite de uso único, válido por 24–48 h.
  - O login puxa todos os códigos ligados a ele, e as telas mostram tudo somado (decisão do Lucas em 2026-10-13).
  - Exemplo: a Star Vendas tem dois códigos, porque um contrato novo tem outra comissão, e vê os dois no mesmo login.
- O token vai depois do `#` da URL, para não aparecer em logs.
- Ele só é consumido depois que a chave é criada (as prévias de link do WhatsApp abrem o endereço sozinhas).
- Se o link for aberto no navegador interno do WhatsApp, a tela orienta a abrir no Chrome ou no Safari.

**Chave de acesso**
- O rpID é o domínio exato do CRM.
- Exige verificação do usuário (biometria ou PIN) e chave residente (entra sem digitar nada).
- Sem atestação; identificador de usuário aleatório; aceita contador 0 (chaves sincronizadas).
- Cada chave é listada pelo nome do provedor (Google, Apple, Windows), porque uma chave sincronizada vale em vários aparelhos.

**Sessão**
- Cookie `__Host-` com `HttpOnly`, `Secure` e `SameSite=Strict`. Token aleatório de 256 bits, guardado só como hash, conferido a cada requisição contra usuário ativo e chave não revogada.
- Expira com 60 min sem uso e 12 h no máximo.
- Requisições que alteram algo só são aceitas com `Origin` ou `Sec-Fetch-Site` da mesma origem.
- Respostas da API com `no-store`; `Clear-Site-Data` ao sair.

**Ao enviar um pedido**, o sistema pede a digital ou o PIN de novo. A assinatura fica vinculada ao hash do pedido.

**Recuperação**: o admin revoga a chave antiga e manda um novo convite. Não há recuperação por e-mail ou SMS. Opcional: 2–3 chaves físicas FIDO2/NFC de reserva.

**Auditoria**
- Eventos: login (sucesso e falha), convites, chaves, ficha consultada, pedido criado e enviado, ações de admin, foto trocada ou recusada.
- Vai para o `app.db` e para `saida/auditoria/*.jsonl`, de onde a LAN busca a cada 5 min.
- Guardada por 6–12 meses (o Marco Civil exige 6). Os representantes são avisados de que os acessos são registrados.
- Logs da aplicação sem PII: só rota, status, tempo e id do usuário.

## Pedidos: caminho até o ERP

O caminho de hoje: SGI → "Incluir Pedido Por Carga Arquivo" → `PEDIDO BLOQUEADO` → aprovações → "Exportar Pedido Omega".

**Especificação v0 do layout "CRM"** (alteração no Delphi, em `untVenPvd_PvdIncluirCarga.pas`):
- parser genérico, que não depende do código do cliente;
- **sempre `PEDIDO BLOQUEADO`, inclusive para os tipos 320, 325 e 326**;
- origem `REPRESENTANTE`: o CPV já entende essa origem, e o código atual não grava pedidos com ela. Confirmar com quem mantém o SGI que ela não é usada por outro caminho;
- número CRM num campo livre (`PV1_LR1`, a confirmar), com índice único;
- importação de todos os arquivos pendentes de uma vez, com pastas `processados\` e `erros\` (com o motivo);
- codificação CP1252.

**Na LAN, antes de gravar na pasta do SGI**, a rotina do extrator:
- só aceita arquivos com nome no padrão, até 64 KB, com limite de quantidade por execução e por representante por dia;
- valida o schema estrito: limites de tamanho, conjunto de caracteres permitido e datas válidas pelas regras do SGI;
- **revalida no Oracle** que o representante está ativo, que o cliente é de um dos códigos do login e não está suspenso (pelo status do SGI, `NVL(CLI3_STA,'ATIVO')`, sem ler `CRCL.SUSPENSO` nem a restrição financeira; decisão do Lucas em 2026-10-09), que cada produto é vendável e tem preço, e que as quantidades estão dentro dos limites. O pedido vai para o SGI com o código dono do cliente (`VEND_1`), escolhido na LAN e nunca pelo navegador;
- manda pedidos acima de um valor-teto para revisão manual;
- monta o arquivo do SGI **só com os campos validados**, gravando `.tmp` e depois renomeando;
- mantém um registro de idempotência e uma quarentena;
- tem um arquivo "pausar" que suspende a entrada de pedidos.

**Situação do pedido**
- No `app.db`, o próprio CRM controla duas etapas:
  - `rascunho`;
  - `enviado`: imutável, já com número CRM.
- O resto volta pela foto, sempre ligado pelo número CRM (o número do SGI recomeça depois de 2.999.999):
  1. recebido, ou recusado com o motivo, ou erro na importação;
  2. em aprovação (`PEDIDO BLOQUEADO`), com o total recalculado pelo SGI ao lado da estimativa do CRM;
  3. aprovado;
  4. no ERP (`PEDIDO OMEGA`, com `VEPM.NUMERO = PV1_NPE`);
  5. faturado parcial ou faturado;
  6. cancelado.
- Na v1 não há edição nem cancelamento depois do envio.

## Telas

1. **Início** (tela grande): mês até hoje contra o mesmo dia útil do ano anterior, projeção (faturado + o ritmo dos últimos 6 meses fechados, por dia útil, nos dias úteis que faltam; os pedidos em aberto com entrega no mês são o piso; decisão do Lucas em 2026-10-13), acumulado do ano e os destaques das análises.
2. **Clientes** (celular primeiro): carteira com busca e filtros. Mostra dias desde a última compra, faturamento em 12 meses com a variação, tendência e situação.
3. **Ficha do cliente** (celular primeiro): evolução mensal, famílias, produtos, ciclo de compra, pedidos em aberto e oportunidades de mix.
4. **Análises:** parou de comprar, comprando menos, comprando mais, novos e reativados, mix.
5. **Pedidos** (celular primeiro): catálogo com busca por código, família, medidas e o código do produto no cliente; montagem do pedido com o preço da tabela do cliente (informativo); rascunhos; envio; acompanhamento da situação; pedidos em aberto no ERP; histórico faturado.
6. **Mapa**, portado do protótipo, só com a carteira do representante: saem as classes "atendida" e "carteira de outros", que olham os outros representantes (decisão do Lucas em 2026-10-09). Na portabilidade:
   - usar o código IBGE do município, se o cadastro de clientes tiver (a NF-e exige);
   - corrigir os 48 nomes de município desatualizados;
   - corrigir os valores que aparecem nos tooltips mesmo com "ocultar valores".
7. **Admin** (só LAN): representantes, convites, chaves, auditoria e situação das cargas.

**Dois escopos, sempre explícitos**
- **Visão do cliente** (o histórico completo do cliente, de qualquer representante): Clientes, Ficha, Análises e Mapa.
- **Visão do representante** (só as vendas atribuídas aos códigos do login, somadas): os indicadores do Início, os pedidos em aberto, no Início, em Pedidos e na Ficha, e as notas da aba Faturados. O pedido é atribuído por `VEPM.VENDEDOR` e, sem ele, pelo dono atual do cliente (`VEND_1`), com a conta na LAN (decisão do Lucas em 2026-10-09). A nota segue a regra da Atribuição (decisão do Lucas em 2026-10-13).
- A carteira do login é a soma das carteiras dos seus códigos.
- Isso evita que um cliente transferido apareça como "novo" ou "parado" para o novo representante.

## Regras de negócio (validadas com o Lucas na fase de análises)

- **Faturamento** (igual ao Gestao/RELCUS001):
  - tipos de movimento 310, 315, 316, 317, 320, 325 e 326;
  - data `NFME.DT_EMISSAO`;
  - valor `VLR_TOTAL − Z_FRANCA_DESC`;
  - exclui cancelada (`ID_CANCEL='S'`); devoluções ficam de fora, como no relatório;
  - unidade CT = 100 peças, numa única função de conversão.
- **Atribuição:** o vendedor da nota; se não houver, o dono do cliente na data, pelo CRCLH.
- **Evento de compra:** notas do mesmo cliente com até 7 dias de diferença contam como uma só compra.
- **Ciclo típico:** mediana dos intervalos em 24 meses. Exige pelo menos 4 compras e fica entre 30 e 180 dias; fora disso, o cliente é "irregular".
- **Parou de comprar:**
  - sem compra há mais que o maior entre 60 dias e 2× o ciclo (ou mais de 180 dias se o cliente for irregular);
  - não conta se o cliente tem pedido em aberto;
  - depois de 24 meses sem compra, vai para "inativo";
  - ordenado pela média mensal dos 12 meses anteriores à última compra.
- **Comprando menos / mais:**
  - últimos 6 meses fechados contra os mesmos 6 meses do ano anterior;
  - exige base de R$ 3 mil no semestre do ano anterior e pelo menos 3 compras nos dois períodos;
  - variação a partir de 20% e diferença de pelo menos R$ 2 mil;
  - mostra a variação em peças ao lado da variação em R$ (reajuste de preço infla o R$);
  - "Em risco" (situação do cliente) é quem está comprando menos e não está parado nem é novo.
- **Alerta rápido de queda** (regra que o Lucas usou no protótipo): para clientes com compra em pelo menos 8 dos últimos 12 meses, o mês fechado abaixo de 70% da média dos 3 meses anteriores, por dia útil.
- **Novo:** primeira compra da história nos últimos 12 meses. **Reativado:** voltou a comprar nos últimos 12 meses depois de 12 meses ou mais sem comprar.
- As regras acima estão em `web/src/dados/analises.ts`, com testes; o extrator (F2) precisa chegar aos mesmos resultados.
- **Mix** (critério confirmado com o Lucas em 2026-10-08):
  - parecidos = clientes ativos (com compra em 12 meses) de toda a Suprens, do mesmo mercado e da mesma faixa de porte. A faixa é o tercil do faturado em 12 meses dentro do mercado: pequeno, médio ou grande;
  - com menos de 20 clientes na faixa, compara com o mercado inteiro; com menos de 20 no mercado, a ficha avisa que não há com quem comparar;
  - sugere a família comprada em 12 meses por pelo menos 50% dos parecidos e que o cliente não compra há 24 meses, da mais comum para a menos comum;
  - a ficha diz com quem o cliente foi comparado (mercado e faixa);
  - a conta é feita pelo extrator na LAN. Para a foto vão só a família, o percentual e a faixa usada, nada dos clientes dos outros representantes;
  - quando Vendas entregar a classificação por ramo de atividade (ver Pendências), "parecidos" passa a ser do mesmo ramo.
- **Baixo volume:** mostra "dados insuficientes" em vez de percentuais exagerados.
- **Grupos:** filiais do mesmo CNPJ raiz são analisadas juntas, para a compra que muda de filial não parecer cliente perdido.

## Identidade visual

- Paleta do site da Suprens:
  - grafite `#161616` e aço `#5c5f63`;
  - cinzas quentes `#ececea`, `#d8d9d6` e `#c5c6c2`;
  - óxido `#d22c12` só como marca ou item ativo, nunca como cor de dado.
- Fontes: IBM Plex Sans com números tabulares e Oswald nos títulos.
- Bordas finas, sem sombras pesadas, muito respiro e um único destaque por tela.
- Gráficos em grafite e aço. Para alta e queda, um verde e um vermelho dessaturados e acessíveis.
- CSS próprio com tokens, sem framework de UI.

## Fases

São duas trilhas em paralelo. Cada etapa termina com commit e push em `SUPRENS/CRM`, direto no `main`, com commits pequenos e sem `--force`. Telas novas ficam escondidas até a aprovação do Lucas.

**Fase 0 — Preparação e decisões** (eu, logo após a aprovação)
- Arquivar o protótipo:
  - antes de apagar o `.git`, resumir em `CRM-prototipo/REGRAS.md` o histórico das regras de negócio validadas;
  - mover o código para `C:\ProjetosCursor\CRM-prototipo`, com `data/geo`, sem `node_modules` e sem dados;
  - apagar os dados locais, o `.git` antigo e o backup temporário da limpeza.
- Novo repositório em `C:\ProjetosCursor\CRM`:
  - pastas `extrator/`, `server/`, `web/`, `deploy/`;
  - `CLAUDE.md` com as regras de código e de git do Gestao e os princípios de segurança acima. **Não** copia três regras do Gestao: `.env` no git, publicar com `git pull` e Oracle ao vivo;
  - `CLEAN_CODE.md` copiado do Gestao, com vitest como harness de testes;
  - `.gitignore` que bloqueia dados e `.env` por padrão;
  - TypeScript estrito.
- O Lucas apaga o `Godcrack93/CRM` (Settings → Danger Zone) e cria o repositório privado **vazio** `SUPRENS/CRM`. O login daqui não tem acesso à conta SUPRENS.
- Primeiro push, assim que o `SUPRENS/CRM` existir.

**Trilha do produto**
- **F1 — Protótipo navegável com dados fictícios**, no celular e no desktop, para aprovar o visual. Junto, a lista de dados que cada tela usa, que fecha o esquema da foto: [`docs/dados-por-tela.md`](dados-por-tela.md), com as perguntas que a F2 precisa responder.
- **F2 — Extrator e foto:**
  - SQL de faturamento do Gestao;
  - totais conferidos com o RELCUS001, inclusive o relatório por representante;
  - listagem das unidades e dos tipos de movimento reais.
- **F3 — Login, sessões, escopo e auditoria**, com testes automáticos.
- **F4 — Carteira e análises.** Termina com um piloto só de leitura com 2–3 representantes.
- **F5 — Pedidos.** Termina com um piloto de ponta a ponta: CRM → SGI → aprovações → Omega.
- **F6 — Mapa:** portado do protótipo. Pode vir antes, se o Lucas preferir.
- **F7 — Disponibilidade de estoque** (futuro, depois dos pedidos):
  - uma carga rápida e separada (`estoque-<data>.db` + manifesto, mesmo canal SFTP), enviada a cada 2–5 min e só quando o estoque mudou;
  - a tela de pedido mostra a situação do item ("disponível", "parcial: consulte a fábrica", "sob encomenda"), e não a quantidade exata, com a hora do dado;
  - a regra de "disponível" (físico menos o reservado para pedidos) é definida com o Lucas e o DBA. A view de reserva do SGI ficou legível para o `LUCAS_RO` com o `READ ANY TABLE` (2026-10-09); a conta do extrator vai precisar de uma view do CRM sobre ela, como os outros objetos (ver Pendências).

**Trilha da infraestrutura**
- **I1 — Esqueleto publicado**, assim que a VM, a rede e o domínio existirem:
  - Apache com TLS, cabeçalhos e CSP; vhost de admin; systemd;
  - `/api/saude` e chave de admin;
  - SFTP com uma foto de teste e um pedido de teste numa pasta TESTE do SGI;
  - busca do backup pela LAN e alertas.
  - As checagens de segurança da I2 já rodam aqui.
- **I2 — Liberação geral:**
  - revisão ASVS L2;
  - simulação de restauração do backup;
  - roteiros de incidente (revogar tudo e reconvidar, trocar chaves, reconstruir pelo `deploy/`, revisar os pedidos com origem CRM), de desligamento de representante e de celular perdido.

**Agenda do extrator** (horário de Brasília). Atraso máximo de cada dado na tela, que sempre mostra a hora do dado:
- A cada 5 min, 24/7: busca pedidos, auditoria e sinal de vida do servidor. Pedido enviado chega ao SGI em até 5 min.
- A cada 2–5 min (quando a F7 entrar): estoque disponível, só se mudou.
- A cada 20–30 min em horário comercial (de hora em hora fora dele): foto nova, se algo mudou no ERP. O intervalo pode diminuir depois de medir o tempo da carga na F2.
- 00:10: reconstrução forçada da foto, porque a data vira.
- 02:30: `VACUUM INTO`. 03:00: a LAN busca o backup e confere a integridade.
- Alertas:
  - foto com mais de 2 h de atraso;
  - servidor sem sinal de vida;
  - pedido parado na saída por mais de 15 min;
  - recusas;
  - disco cheio.

## Pendências (dono: Lucas, salvo indicação)

- **Antes da I1 e da F3:**
  - domínio (ex.: `crm.suprens.com.br`) e quem controla o DNS. Ele vira a identidade das chaves e não pode mudar depois;
  - VM dedicada no servidor da empresa (não compartilhar com o site);
  - quem administra a rede e o firewall, para as regras da seção Arquitetura.
- **Antes do piloto da F4:**
  - a conta Oracle própria do extrator. O DBA cria, num esquema do CRM, uma view por objeto da lista que a F2 fecha, só com as colunas listadas, inclusive sobre a view de preço líquido `SGI5_VIEW_VEN_TP2_VLR_LIQ_CLI`, e concede à conta SELECT só nessas views (decisão do Lucas em 2026-10-09). O esquema do CRM é o dono das views e não tem login (conta bloqueada). Ele recebe do ABC71 SELECT WITH GRANT OPTION, por grant direto, em cada objeto da lista; sem isso, o GRANT na view falha (ORA-01720). Como o Oracle não concede SELECT por coluna, são as views que impedem a conta de ler CNPJ, contatos e restrição financeira. O `LUCAS_RO` lê a view de preço líquido desde 2026-10-09, quando ganhou `READ ANY TABLE`; a conta do extrator não ganha esse privilégio;
  - qual máquina da LAN roda o extrator (o servidor do Gestao?).
- **Antes da F5:**
  - quem mantém o código do SGI (layout "CRM");
  - quem importa os arquivos do CRM e com que frequência;
  - como os pedidos dos representantes chegam hoje;
  - levantamento dos celulares dos representantes (Android 9+ / iOS 16+).
- **Vendas (em elaboração desde 2026-10-08):** classificação dos clientes por ramo de atividade, para o critério de clientes parecidos do mix.
  - O ERP não tem essa informação hoje: `GRUPO_1`, `SUB_GRUPO_1` e `SEGMENTO` do cadastro de clientes vêm vazios.
  - Sugestão: registrar o ramo no próprio SGI, no campo `SEGMENTO`, se a tela de cadastro permitir. Assim o extrator lê direto do ERP e cliente novo já nasce classificado.
- **A conferir nos dados (F2):**
  - cadastro de representantes (`SGI5_TAB_FIN_VEN`: tipo e situação);
  - significado de `ATIVO-DB`;
  - escolha da tabela quando o cliente tem principal e secundária;
  - metas (tabela `SGI5_TAB_VEN_MT1` ou meta calculada).

## Verificação

- **Sempre:** `tsc --noEmit` e vitest passando; telas conferidas no navegador do app, no desktop e no celular.
- **Escopo e sessão (F3):** o teste que percorre todas as rotas (A nunca lê B); sessão expirada; convite reutilizado; chave revogada; `X-Forwarded-For` forjado sendo ignorado.
- **Extrator (F2):** totais mensais por representante batendo com o RELCUS001; recusa de foto antiga ou encolhida.
- **Pedidos (F5):** arquivo malicioso de teste (campos extras, cliente de outro representante, quantidade absurda) **recusado** na LAN; pedido válido percorrendo CRM → SGI bloqueado → aprovações → Omega → situação visível no CRM.
- **Infra (I1/I2):**
  - SSL Labs A+ e cabeçalhos em nota A;
  - varredura de portas mostrando só a 443 aberta para a internet;
  - teste confirmando que o servidor **não** alcança 1521, 445 nem 53 da LAN;
  - `systemd-analyze security` com nota baixa (= bem isolado);
  - backup restaurado.
