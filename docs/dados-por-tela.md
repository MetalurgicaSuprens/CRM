# Dados por tela

Versão de 2026-10-13, com as decisões do Lucas de 2026-10-09 e 2026-10-13. Entrega da F1: "a lista de dados que cada tela usa, que fecha o esquema da foto" (`docs/plano.md`, F1). A F2 constrói o extrator a partir dela.

## O que é

- Para cada tela: o que ela mostra, a regra, de onde vem no ERP e onde é calculado.
- Base:
  - os tipos que as telas consomem (`web/src/dados/tipos.ts`);
  - as regras do plano e de `web/src/dados/analises.ts` e `mix.ts`;
  - o catálogo do Oracle (`OracleDB/catalogo`);
  - o fonte do SGI (`SGI12CodigoFonte`).
- O que está marcado "a confirmar" depende dos dados reais e entra na F2.

**Dois bancos**
- `foto.db`: gerada pelo extrator na LAN, já com as regras calculadas, como a "tela servida pronta" do Gestao (plano.md:63). No servidor é somente leitura. A API só faz leituras com o escopo da sessão e somas simples.
- `app.db`: o que o próprio CRM produz. São usuários, chaves, convites, sessões, auditoria, rascunhos e pedidos enviados (plano.md:79).

**Dois escopos** (plano.md:205-209)
- **Visão do cliente:** o histórico completo dos clientes da carteira, de qualquer representante. Vale para Clientes, Ficha, Análises, Mapa e os destaques do Início.
- **Visão do representante:** só as vendas atribuídas aos códigos do login, somadas. Vale para todos os indicadores do Início, inclusive pedidos em aberto e projeção, para os pedidos em aberto de Pedidos e da Ficha e para a aba Faturados.
- Decidido em 2026-10-09 (pergunta 22): pedidos são sempre só os do representante. O pedido é atribuído por `VEPM.VENDEDOR` e, sem ele, pelo dono atual do cliente (`VEND_1`), com a conta na LAN. O servidor nunca recebe vendedor do navegador.
- Decidido em 2026-10-13 (pergunta 23): a aba Faturados mostra só as notas atribuídas aos códigos do login.
- **Login com mais de um código** (decidido em 2026-10-13, pergunta 20).
  - O admin liga ao usuário os códigos do representante, e o login puxa todos. Exemplo do Lucas: a Star Vendas tem dois códigos, porque um contrato novo tem outra comissão, e vê os dois no mesmo login. No banco, o 1118 e o 1119 têm o mesmo nome, MAURO.
  - A carteira do login é a soma das carteiras dos códigos. A visão do representante soma as vendas de todos eles.
  - A foto continua por código e não conhece os logins. O servidor lê as linhas com `representante` entre os códigos do login da sessão, que vêm do app.db.
  - Cliente que passa de um código para outro do mesmo login continua na carteira, sem nenhuma mudança na tela.
- A carteira (quem é cliente de quem, pelo `VEND_1` atual) define as telas da visão do cliente.
- A visão do representante não se limita à carteira atual. Ela soma as notas atribuídas a ele (plano.md:219), inclusive as de clientes que hoje são de outro representante. O mesmo vale para os pedidos.
- Por isso os indicadores de faturamento da visão do representante vão para a foto só como somas por representante e mês (`painel_mes`). Os pedidos em aberto e as notas de Faturados vão um a um, com o representante já atribuído na LAN (`pedido_aberto` e `nota`). Quando o cliente é de outra carteira, a linha vai sem o cliente (ver Pedidos).

**Minimização** (CLAUDE.md, regra 3; plano.md:35)
- Só entra na foto o campo que alguma tela usa, e só dos representantes autorizados.
- O que serve só para calcular fica na LAN:
  - os itens das notas e o histórico de notas e de datas de compra;
  - o CRCLH;
  - os clientes que não estão na carteira de nenhum representante autorizado.
- Das notas e datas, a foto leva só o que as telas mostram: última compra, ano da primeira compra, o "desde" de novos e reativados, a última compra de cada produto da Ficha e as notas da aba Faturados.
- Campo do contrato que nenhuma tela mostra sai do contrato (ver "Perguntas para a F2").

**Como ler**
- "Onde é calculado" tem quatro valores:
  - extrator: vai pronto na foto;
  - servidor: leitura com escopo ou soma simples sobre a foto;
  - navegador;
  - app.db: o CRM produz.
- **RF** é o faturamento pela definição do Gestao/RELCUS001 (plano.md:213-218):
  - itens `NFDE` ligados a `NFME` pela chave completa (EMP_FIL, N_FISCAL, SERIE, FORNEC, TIPO_MOVTO);
  - tipos 310, 315, 316, 317, 320, 325 e 326;
  - `NVL(TRIM(NFME.ID_CANCEL),'N') <> 'S'`;
  - data `NFME.DT_EMISSAO`;
  - valor `NFDE.VLR_TOTAL − NVL(NFDE.Z_FRANCA_DESC,0)`, com o desconto do item e não o do cabeçalho;
  - peças com CT ×100.
  - Fonte: `Gestao/server/src/producao/foto/moduloVendasEntradas.ts:13, 25-26 e 32-43` e `moduloVendasClientes.ts:25-36`.
- **Código do cliente** é o código do ERP que a tela mostra, só de empresa (`codigoErp`). O identificador interno do cliente, no endereço da ficha e nos rascunhos, é outro: o id opaco (decidido em 2026-10-13, ver Clientes).

## 1. Barra superior (todas as telas)

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Hora do dado (`atualizadoEm`) | "Dados de hoje, 14:32", com a dica "Hora em que os dados foram copiados do ERP" (Layout.tsx:66 e 117-125) | Início da leitura do ERP que gerou a foto | `TO_CHAR(SYSDATE)` no Oracle; nenhuma tabela | extrator |
| Data da foto (`hoje`) | Base de "há 12 dias" e das datas relativas que vêm do ERP, em todas as telas | Data de referência das regras | `TO_CHAR(SYSDATE,'YYYY-MM-DD')` | extrator |
| Relógio (`relogio`) | O "hoje" da barra, a entrega mínima, a data e a saudação do Início e os momentos que o CRM grava | Relógio do servidor em Brasília, a cada resposta | nenhuma | servidor |
| Códigos do representante | "Representante 1401" ou "Representantes 1401 e 1402" no menu (Layout.tsx:51; formato.ts:121) | Vêm da sessão, nunca do navegador. Um login pode ter mais de um código | É o mesmo número em `CRVN.VENDEDOR`, `SGI5_TAB_FIN_VEN.FIN_VEN`, `CRCL.VEND_1`, `NFME.VENDEDOR` e `VEPM.VENDEDOR` (este a confirmar, pergunta 1) | app.db |
| Nome | Nome e iniciais no menu (Layout.tsx:47-50) | Proposta: o nome do usuário, digitado no Admin ao criar o login (pergunta 20) | nenhuma | app.db |
| Ocultar valores | "R$ ••••" (valores.tsx:11) | Começa oculto em toda sessão e não é lembrado | nenhuma | navegador |
| Incluir pedido | Botão verde no alto do menu, logo abaixo da marca; no celular, o último item da barra de baixo, com a pílula verde (pedido do Lucas em 2026-10-20, quando saiu do lado da saudação do Início; Layout.tsx:28-32 e 83-86) | Leva à escolha do cliente do pedido (`/pedidos/novo`). Todo "Incluir pedido" é verde, também em Pedidos e na ficha (`--cor-positivo`, tokens.css): a ação boa, que no grafite passava a impressão errada | nenhuma | navegador |
| Sair | Botão do menu (Layout.tsx:52-55) | Na F3 vira POST, revoga a sessão e manda `Clear-Site-Data` (plano.md:146) | nenhuma | app.db |

- **Data da foto e relógio (corrigido em 2026-10-09).** A barra comparava `atualizadoEm` com o `hoje` da própria foto, e a foto parada desde ontem aparecia como "hoje, 23:50". Agora o contrato traz `SituacaoDosDados.relogio`, o relógio do servidor em Brasília (tipos.ts:25-30), e a barra compara com ele (Layout.tsx:117-125).
  - A data da foto vale para as regras do extrator e para as datas que vêm do ERP.
  - O relógio vale para:
    - o rótulo "hoje" da barra;
    - a data mínima de entrega (MontarPedido.tsx:72 e 127; pedido.ts:104-114);
    - o dia por extenso e a saudação do Início (Inicio.tsx:29-30 e 219-230);
    - todo momento gravado no app.db: "Enviado" e "Atualizado" em Pedidos, "Rascunho salvo" e o cabeçalho e o Andamento do Detalhe (formato.ts:144-156).
- A CRVN tem uma linha por gerente e supervisor (PK em ABC71-CR.md:5475). Por isso o nome é agrupado por VENDEDOR.
- O SGI só lê a CRVN na empresa 20210001 (`untDmVenPvd.dfm:499-503`). Sem esse filtro, o nome pode vir de outra EMP_FIL.
- O alerta de foto com mais de 2 h de atraso já existe na LAN (plano.md:309).

## 2. Início

**Indicadores**

Todos os indicadores usam a visão do representante. Projeção e pedidos em aberto seguem a decisão de 2026-10-09 (pergunta 22).

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Faturado no mês | "Faturado em outubro" (Inicio.tsx:105-120) | RF do mês até hoje, atribuída ao representante | NFME, NFDE, `NFME.VENDEDOR`, CRCLH | extrator |
| Mesmo dia útil do ano anterior | "+82% vs R$ 172 mil até o 7º dia útil de out/25", com a base à mostra (Inicio.tsx:110-119) | RF atribuída no mesmo mês do ano anterior, até o Nº dia útil | o mesmo; dias úteis pelo calendário padrão (`dominio/calendario.ts`) | extrator |
| Dia útil e dias úteis | "8º de 22 dias úteis" (Inicio.tsx:219-222) | Decidido em 2026-10-14: o calendário padrão, segunda a sexta menos os feriados nacionais (`dominio/calendario.ts`), até o Lucas definir o calendário personalizado. Antes, era o calendário do SGI (`CAL_DUT_COM`), que marcava 7/10 como não útil: em 14/10, o 8º de 20 virou o 9º de 21 | nenhuma (SGI5_TAB_DP_CALEND` | extrator |
| Projeção | "Projeção de outubro", com "no ritmo dos últimos 6 meses" (ou "pelos pedidos em carteira para o mês") e "faltam X para igualar out/25" (Inicio.tsx:121-131 e 182-209) | Decidido em 2026-10-13: faturado do mês mais o ritmo dos últimos 6 meses fechados (faturado por dia útil) nos dias úteis que faltam. A carteira com entrega no mês é o piso: se passar do que o ritmo prevê, vale ela (`dominio/projecao.ts`). A segunda linha compara a projeção com o mesmo mês inteiro do ano anterior; acima dele, mostra "X acima de out/25" | NFME e NFDE para o ritmo, com os dias úteis do calendário padrão; VEPM, VEPD para a carteira | ritmo: extrator; projeção: servidor, somando os códigos do login |
| Acumulado do ano | "Acumulado de 2026" | Soma dos meses do ano corrente | (foto) | servidor |
| Acumulado do ano anterior | "vs 2025" | Janeiro até o mês anterior inteiros, mais o mesmo dia útil do mês corrente | (foto) | servidor |
| Pedidos em aberto | Valor e "N pedidos" (Inicio.tsx:138-143) | Contagem e soma dos pedidos em aberto atribuídos ao representante | VEPM, VEPD; atribuição por `VEPM.VENDEDOR`, na LAN | servidor, sobre os pedidos do representante |
| Gráfico mensal | Barras do ano, comparação com o ano anterior e "A faturar no mês" (BarrasMensais.tsx:156-170) | Mês sem dado ainda é nulo. O ano anterior usa o mês inteiro; na dica do mês corrente, ele aparece como "2025, mês inteiro" (BarrasMensais.tsx:214-240) | NFME, NFDE, VEPD | extrator; a faturar: servidor |
| Tendência | No mesmo cartão do gráfico mensal, a segunda vista do seletor "Mensal | Tendência"; o Mensal é o padrão (pedido do Lucas em 2026-10-19; paginas/FaturamentoDoInicio.tsx). A linha da média por mês nos 12 meses até cada um dos últimos 48 meses, com "Desde out/22: +X% na média por mês", no mesmo desenho da Tendência da ficha | Cada ponto é a média por mês dos 12 meses fechados até ele (dados/faturamentoDoCliente.ts, `montarTendencia`, com teste); o mês corrente, aberto, fica de fora. Visão do representante, como os números do alto | NFME, NFDE, `NFME.VENDEDOR`, CRCLH (foto: `painel_historico`) | extrator (60 meses fechados); a soma: navegador |
| Saudação | "Boa tarde, Carlos" (Inicio.tsx:29) | Primeiro nome do usuário; "Bom dia", "Boa tarde" ou "Boa noite" pela hora de Brasília | nenhuma (proposta da pergunta 20) | nome: app.db; parte do dia: navegador, pelo `relogio` do servidor (Inicio.tsx:224-230) |

**Destaques (visão do cliente, sobre a carteira)**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Atenção na carteira | Quantidade e total de Pararam, Comprando menos, Comprando mais e Novos (Inicio.tsx:153-180) | Soma de todos os clientes da lista, não só dos 5 mostrados | listas das Análises | servidor |
| Cartão "Pararam de comprar" | 5 primeiros: nome, cidade/UF, "última compra há X" e o valor por mês, com link para a ficha (Inicio.tsx:44-63) | Ordem da análise | listas das Análises e `cliente` | servidor |
| Cartão "Comprando menos" | 5 primeiros: nome, cidade/UF, variação e diferença, com link para a ficha (Inicio.tsx:64-83) | Ordem da análise | listas das Análises e `cliente` | servidor |

- **Atribuição (plano.md:219).**
  - Vale o vendedor da nota (`NFME.VENDEDOR`).
  - Se ele vier nulo ou 0, vale o dono do cliente na data da nota, pelas trocas de `VEND_1` no CRCLH.
  - Antes da primeira troca, vale o "de" dela. Sem trocas, vale o `VEND_1` atual.
  - O extrator aplica a regra na LAN. Para os indicadores, grava as somas por representante e mês (`painel_mes`). Para a aba Faturados, grava só o representante já atribuído de cada nota (`nota.representante`, pergunta 23). Nada do CRCLH vai para a foto (plano.md:35).
- **Mesmo dia útil (proposta a confirmar).** Em 2026-10-13, o Lucas estranhou o "+82%" ao lado dos R$ 610 mil de out/25 no gráfico: a base (R$ 172 mil até o 7º dia útil) não aparecia. Desde então o cartão mostra a base, e a dica do gráfico diz "mês inteiro". Com N = dia útil de hoje, soma-se o mesmo mês do ano anterior até antes do (N+1)º dia útil. Assim entram as notas de sábado ou de feriado logo depois do Nº. Se o mês do ano anterior tiver menos de N dias úteis, entra o mês inteiro. O fictício faz só uma proporção (ficticio.ts:562) e não serve de regra.
- **A faturar no mês.**
  - Entram os itens com saldo e `VEPD.DT_ENTREGA` até o último dia do mês, inclusive os vencidos.
  - Conta a entrega de cada item, como no protótipo (CRM-prototipo/REGRAS.md:52). O fictício usa a entrega do pedido inteiro.
  - O extrator grava em cada pedido o valor com entrega até o fim do mês, e o servidor soma os pedidos do representante.
  - A reconstrução das 00:10 resolve a virada do mês (plano.md:306).
  - No gráfico, o mês corrente é o único com `aFaturar` como número, inclusive 0; nos outros ele é nulo (tipos.ts:144-148). O fictício manda 0 quando não há nada a faturar (ficticio.ts:621).
  - Corrigido em 2026-10-09: antes a tela pedia `aFaturar` diferente de zero, e com 0 a faturar o mês parcial passava por fechado. Agora ela testa `aFaturar != null` (BarrasMensais.tsx:22-25). O teste é frouxo de propósito, porque a Ficha usa o mesmo gráfico sem mandar `aFaturar`.
- **Escopo dos pedidos em aberto e da projeção (decidido em 2026-10-09, pergunta 22).**
  - Visão do representante, como os outros indicadores do Início (plano.md:207). A carteira dele é o piso da projeção (plano.md:194).
  - Atribuição: `VEPM.VENDEDOR`; se vier nulo ou 0, o dono do cliente pelo `VEND_1` atual. O extrator faz a conta na LAN e grava o representante em cada linha de `pedido_aberto`.
  - O servidor soma `pedido_aberto` só pelo representante da sessão. Nenhuma rota recebe vendedor do navegador.
  - A mesma regra vale para a aba "Em aberto no ERP" e para a Ficha. Com um escopo só, o total do Início bate com a aba.
  - O fictício ainda usa a carteira.
- **Valor de cada destaque:**
  - Pararam: perda mensal.
  - Menos e mais: semestre menos o semestre do ano anterior.
  - Novos: faturado desde então.
  - Os itens de "mais" e "novos" não aparecem em nenhuma tela. Proposta: a resposta leva só as contagens e os totais deles.
- **Calendário (decidido em 2026-10-14).** Por enquanto, o padrão: segunda a sexta menos os feriados nacionais, os de data fixa, a Sexta-feira Santa (pela Páscoa) e a Consciência Negra desde 2024. Carnaval e Corpus Christi são ponto facultativo e contam como úteis. É o mesmo no extrator e no fictício (`dominio/calendario.ts`). Antes de o CRM ficar pronto, o Lucas define um calendário personalizado, com os dias úteis que ele disser. O calendário do SGI (`SGI5_TAB_DP_CALEND`, o "Calendário Suprens") deixou de ser lido.

## 3. Clientes

- **Página travada (2026-10-20, pedido do Lucas; vale também para Análises e Pedidos).** No computador, a página fica do tamanho da janela: o cabeçalho e os filtros ficam parados, só a lista rola, e o título das colunas gruda no alto dela (componentes/PaginaTravada.module.css). No celular e no tablet, a página rola inteira, como antes, porque a lista ficaria espremida. O estado de antes está na tag `listas-com-rolagem-da-pagina`.

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Carteira | "N clientes na carteira" (Clientes.tsx:71) | Clientes com `VEND_1` igual ao código da sessão (decidido em 2026-10-09) | `CRCL.EMP_FIL`, `CLIENTE`, `VEND_1` | extrator |
| Código | "Ribeirão Preto/SP · 123456780001" ou "Bauru/SP · Pessoa física" (Clientes.tsx:140; formato.ts:133) e busca | Empresa: o código do ERP. Pessoa física: nenhum, porque o código dela é o CPF (decisão do Lucas em 2026-10-13). O código é a raiz do CNPJ e a filial, sem os verificadores, e o ERP o guarda como número: perde os zeros da esquerda (61 dos 178 clientes da Star Vendas têm 10 ou 11 dígitos, em 2026-10-15). A busca completa os zeros | `CRCL.CLIENTE`, só com `FIS_JURID = 'J'` | extrator |
| Grupo | Uma linha só, com o selo "Grupo" ao lado do nome e "8 CNPJs" no lugar da cidade e do código; os números são a soma dos CNPJs. O selo aparece também em Análises e no Início (pedido do Lucas em 2026-10-17: indicação clara de que o cliente é um grupo; componentes/NomeDoCliente.tsx). A busca acha o grupo também pelo nome, pelo CNPJ ou pela cidade de um CNPJ dele (dados/busca.ts) | Ver "Grupos do SGI", abaixo | `SGI5_TAB_VEN_CLI3.CLI3_GRP` | extrator |
| Identificador | URL `/clientes/:codigo`, rascunhos e pedidos | Id opaco para todos os clientes (decidido em 2026-10-13); nunca aparece na tela | nenhuma; gerado na LAN | extrator |
| Nome | Título da linha, busca, ordem A–Z | Fantasia; se vazio, razão social; razão completa quando o fantasia vem cortado | `CRCL.NOM_FANTAS`, `RAZ_SOCIAL`, `COMPLEM_RZ` | extrator |
| Cidade e UF | "Ribeirão Preto/SP" | `TRIM(CIDADE)`, cortada em 20 letras. Proposta: o nome do IBGE pelo código de `RESERVADO7`, confirmado em 2026-10-15 (pergunta 5). Exterior: "EX" | `CRCL.CIDADE`, `ESTADO` | extrator |
| Status | Coluna logo depois do cliente: "Ativo" em texto discreto, "Inativo" e "Substituído" no selo vermelho. No cartão do celular, só o selo, embaixo do nome (Clientes.tsx:38, 96 e 136-145; componentes/StatusDoCliente.tsx) | O status do cadastro do SGI, com os nomes de lá; sem linha, ATIVO, como no SGI (decisões do Lucas em 2026-10-14 e 2026-10-15). Fora de ativo, o cliente fica na carteira, mas não recebe pedido (dominio/statusDoCadastro.ts). Na Star Vendas, em 15/10, os 178 estão ativos | `SGI5_TAB_VEN_CLI3.CLI3_STA` | extrator |
| Situação | Selo e filtros com contagem (Clientes.tsx:27-33, 73-78 e 146-149) | Ver Análises | NFME, NFDE, VEPM, VEPD | extrator |
| Motivo do risco | Embaixo do selo "Em risco": "−23% em abr–set/26 vs abr–set/25" (Clientes.tsx:148; componentes/SituacaoCliente.tsx:27-40) | A variação do semestre que pôs o cliente em risco, com os meses comparados (pedido do Lucas em 2026-10-14). Sem a base à mostra, a queda do semestre parecia contradizer a variação de 12 meses ao lado | NFME, NFDE | extrator (`analise_ritmo`); texto: navegador |
| Última compra | "há 12 dias", com a data na dica | Última nota válida, no histórico inteiro; nulo se nunca comprou | `MAX(NFME.DT_EMISSAO)` com a RF | extrator |
| Faturado 12 meses | Coluna e ordem de abertura, no navegador (Clientes.tsx:45 e 58) | RF dos 12 últimos meses fechados, sem o corrente | NFME, NFDE | extrator |
| Variação | Coluna, ordenável pelo título (Clientes.tsx:42 e 107-109) | 12 meses ÷ 12 meses anteriores − 1; nulo com base pequena | NFME, NFDE | extrator |
| Tendência | Minigráfico de 13 pontos (Clientes.tsx:161-163) | Faturado em 12 meses recalculado no fim de cada mês fechado, de um ano atrás até o mês passado | NFME, NFDE | extrator |
| Busca, filtros e ordem | Campo de busca ao lado do título, na altura do subtítulo (desde 2026-10-20), botões e títulos das colunas (Clientes.tsx) | Sobre a lista recebida. A busca acha o nome, a cidade e o CNPJ, com ou sem pontuação e verificadores (dados/busca.ts) | nenhuma | navegador |

- **Carteira (decidida em 2026-10-09; filtro de empresa e exclusões ainda em aberto).**
  - Clientes da `CRCL` com `VEND_1`, o campo vendedor do cliente, igual a um dos códigos da sessão. Proposta: também `EMP_FIL = 20210001`.
  - É a mesma regra que a LAN usa na revalidação do pedido, "o cliente é de um dos códigos do login" (plano.md:173).
  - A tela Representantes - Clientes do SGI usa `VEND_1` de representante com `FIN_STA = 'ATIVO'` e `TRIM(FIS_JURID) = 'J'`, sem filtro de EMP_FIL (`Representantes - Clientes {REPCLI}/untDmVenRepCli.dfm:626-631`). A exportação para os representantes usa o mesmo filtro (`untDmRepAbd.dfm:159-164`). Incluir pessoa física diverge do SGI.
  - Há pessoa física com vendedor. A contagem de 2026-10-09 no banco, só de quantidades e sem dado pessoal, achou 196 clientes com `FIS_JURID = 'F'` e vendedor, 46 deles com venda nos últimos 24 meses. Pessoa jurídica com vendedor: 17.602, das quais 3.469 com venda em 24 meses. Segue em aberto se a pessoa física entra, junto com o código do cliente (perguntas 17 e 18).
  - O cliente transferido aparece só para o dono atual, com todo o histórico.
  - A pessoa física fica na carteira, com o nome e sem o código do ERP (decisão do Lucas em 2026-10-13). O SGI faz diferente: tira a pessoa física da tela e da exportação para os representantes.
  - Ficam em aberto as exclusões: `TIPO_CAD` diferente de 'C' e cliente sem compra há anos. O cliente fora de ativo no `CLI3_STA` fica, com o status à mostra (decidido em 2026-10-14).
- **Código do cliente (decisão do Lucas em 2026-10-13).**
  - Na empresa, `CRCL.CLIENTE` é a raiz do CNPJ em 8 dígitos mais a filial em 4 (OracleDB/docs/licoes.md:97). Os dígitos verificadores se calculam a partir dos 12, então mostrar o código é mostrar o CNPJ. O CNPJ é público, e o Lucas decidiu mostrá-lo (CLAUDE.md, regra 3; plano.md:20).
  - Na pessoa física, o código é o CPF. Em 193 dos 196 clientes com vendedor, `CRCL.CLIENTE` são os 9 primeiros dígitos do CPF, "00" e os 2 dígitos verificadores (contagem de 2026-10-13, sem exibir dados). Ele nunca sai da LAN, e a tela mostra "Pessoa física".
  - O endereço da ficha também não pode levar o CPF. Decidido em 2026-10-13 (opção A), para todos os clientes, empresa ou pessoa física:
    - o extrator gera um id opaco, estável entre fotos: um HMAC de EMP_FIL + CLIENTE com uma chave que só existe na LAN. Não precisa de tabela de correspondência: a LAN recalcula o id dos clientes da carteira;
    - ele precisa ser estável porque rascunhos e pedidos no app.db o guardam;
    - a LAN converte de volta para `CRCL.CLIENTE` só ao montar o arquivo do SGI (`PV1_CLI`);
    - mesmo opaco, o código que chega do navegador (URL ou rascunho) é entrada hostil: fora da carteira da sessão, a resposta é 404.
- **Nome.**
  - Regra do Gestao: `NVL(TRIM(NOM_FANTAS), TRIM(RAZ_SOCIAL))` (OracleDB/docs/modulos/produto-acabado.md:36).
  - O fantasia tem 25 caracteres e costuma vir cortado. Quando ele tem 24 ou mais e a razão é mais longa, mostra-se a razão completa. Regra validada no protótipo (CRM-prototipo/REGRAS.md:54; `clienteNome.ts:13-25`).
  - Para pessoa física, o nome é dado pessoal: fica restrito à carteira e nunca vai para log.
- **Cidade.**
  - `CRCL.CIDADE` é CHAR(20) e vem cortada ("SAO JOSE DO RIO PRET").
  - `CRCL.RESERVADO7` é o código IBGE (conferido em 2026-10-15; ver Mapa). Pistas da GNRE, que levaram a ele:
    - ela lê `RESERVADO7` como código da cidade do cliente (`untDmContGnre.dfm:348-352`);
    - ela manda como município `Copy(CLI_CCI,3,5)` (`untContGnre_Gnre.pas:496`), e `CLI_CCI` vem de `POS_CLI_CCI` (`untContGnre_GnreGerarXML.pas:410`), que é `B.RESERVADO7` (`untDmContGnre.dfm:348-349`). É o formato do código IBGE de 7 dígitos: 2 da UF e 5 do município.
  - Proposta: o nome vem da lista do IBGE, e `CIDADE` fica para quando o código faltar. `TPMU.NOME_CIDADE` não resolve, porque também é CHAR(20) (omega/ABC71-TP.md:3066).
  - O código vai para a foto desde a versão 9 (`cliente.municipio_ibge`), para o Mapa. É um dado público do município, não do cliente.
  - Cliente do exterior vem com `ESTADO='EX'` e o país em `COD_PAIS`, que é um número (licoes.md:98; omega/ABC71-CR.md:1079). Proposta: a tela mostra "EX" na UF. Se a pergunta 5 decidir mostrar o país, o nome vem de `ABC71.TGPA.NOME_PAIS` por `COD_PAIS` (omega/ABC71-TG.md:437-455). A confirmar na F2: qual EMPRESA/FILIAL usar e se 12 = Uruguai e 10 = Paraguai (licoes.md:98).
- **Variação.** O piso de R$ 2 mil que deixa a variação nula existe só no fictício (ficticio.ts:437). O plano diz só "dados insuficientes" (plano.md:243).
- **Grupos do SGI (pedido do Lucas em 2026-10-17).**
  - O grupo é o campo Grupo da tela Vendas → Clientes do SGI, gravado em `SGI5_TAB_VEN_CLI3.CLI3_GRP` (untVenCli_CliMov.pas:148-151 e 183). Os campos de grupo do Omega (`CRCL.GRUPO_1`, `SUB_GRUPO_1`, `SEGMENTO`) estão zerados.
  - Com o campo vazio, a tela grava o nome fantasia, e nada atualiza o campo quando o fantasia muda no Omega. Em 17/10, 17.629 dos 17.834 clientes tinham o próprio fantasia no grupo.
  - Os clientes com o mesmo texto no campo são um grupo, digitado ou não (decisão do Lucas em 2026-10-17, ao ver as duas Valmont separadas; extrator/src/calculo/grupos.ts). Antes, só valia o texto que alguém digitou, diferente do fantasia de ao menos um cliente.
  - Por isso, empresas sem relação com o mesmo fantasia também viram um grupo, e quem as separa é o cadastro do SGI, com outro texto no campo. Na foto de 17/10, os grupos novos com razão social e raiz de CNPJ diferentes eram CASA DOS PARAFUSOS (1302), CELSAO AUTO PECAS (1120), FRESH CAR PRODUTOS AUTOMO (1310), MILVO PADILHA (1211) e as duas MACEDO (1600).
  - O grupo existe dentro da carteira de cada código: com dois ou mais CNPJs do mesmo grupo no mesmo código, eles viram uma linha só, com as compras somadas e analisada como um cliente (extrator/src/calculo/grupos.ts). Com um CNPJ só no código, o cliente aparece sozinho.
  - Os CNPJs do grupo que estão com outro representante ficam de fora, porque são clientes de outra carteira (CLAUDE.md, regra 4). Em 17/10: a OVD tem 8 CNPJs no 1302 e 1 no 1310, que aparece sozinho lá.
  - A conta é por código, porque o extrator não conhece os logins: um grupo com CNPJs em dois códigos do mesmo login apareceria duas vezes. Em 17/10, já com o critério novo, nenhum texto de grupo tinha clientes nos dois códigos de uma representação (CORENO, MARKA, STAR VENDAS e VALDEZ).
  - Na foto de 17/10, 104 grupos, com 292 dos 3.233 CNPJs da carteira, em 16 códigos; 14 juntam mais de uma raiz de CNPJ. Só com o texto digitado eram 8: ARICAN, MORELATE e UNIFORT (1109), FW (1120), OVD (1302), FG (1310), MOBIT (1502) e NORTE COM VAREJ (1603).
- **Tendência.** Exige 24 meses fechados de notas.

## 4. Ficha do cliente

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Nome e situação | Título e selos: no grupo, o selo "Grupo"; a situação e, no cliente fora de ativo, o status, "Inativo" ou "Substituído" (FichaCliente.tsx:58-64) | Como em Clientes | (ver Clientes) | extrator |
| Voltar | Leva para a tela de onde se veio, como ela estava: a análise na mesma aba, com a mesma ordem e na mesma altura da página; no CNPJ aberto pelo grupo, a ficha do grupo. Sem origem conhecida (a ficha aberta direto ou recarregada), vai para o grupo ou para Clientes (pedido do Lucas em 2026-10-17; componentes/navegacao.ts) | Volta pelo histórico do navegador. O CRM guarda a rolagem de cada entrada do histórico e a devolve ao voltar, em qualquer tela; a memória é da aba e some ao recarregar | nenhuma | navegador |
| Razão social e motivo do risco | Embaixo do nome, a razão social, que some quando é igual a ele, como na pessoa física. O motivo do selo "Em risco", como em Clientes, fica ao lado do selo e quebra a linha junto com ele (pedido do Lucas em 2026-10-19; FichaCliente.tsx, `situacaoComMotivo`) | `RAZ_SOCIAL` + `COMPLEM_RZ`; motivo: ver Clientes | `CRCL.RAZ_SOCIAL`, `COMPLEM_RZ` | extrator |
| Grupo | No grupo: "Grupo do cadastro do SGI: 8 CNPJs, com os números somados" embaixo do nome, e os cartões CNPJs e Municípios no lugar de Cidade e Código. No CNPJ de um grupo: "CNPJ do grupo OVD" embaixo do nome, e o "Voltar" leva ao grupo (FichaCliente.tsx) | Ver Clientes, "Grupos do SGI". Todos os números do grupo são a soma dos CNPJs: faturado, meses, famílias, produtos, ciclo e situação | `SGI5_TAB_VEN_CLI3.CLI3_GRP` | extrator |
| Por CNPJ | Só no grupo, depois do faturamento mensal: cada CNPJ com cidade e código, situação, última compra, faturado em 12 meses, a parte dele no faturado do grupo e a variação; a linha abre a ficha do CNPJ (FichaCliente.tsx, `TabelaDosCnpjs`) | Os números de cada CNPJ, como se ele estivesse sozinho; a situação é a dele (pedido do Lucas em 2026-10-17) | (ver Clientes) | extrator; a parte, no navegador |
| Endereço | Embaixo do nome, só na empresa: "AV. JUSCELINO KUBITSCHEK DE OLIVEIRA, 3900 · CIDADE INDUSTRIAL · 81260-000", com "Google Maps" e "Pôr no roteiro" do Mapa (FichaCliente.tsx, `EnderecoDaFicha`; 2026-10-19) | O texto do cadastro como está, com o número e o complemento; o CEP com o zero que o ERP perde. Pessoa física e grupo ficam sem endereço. O link do Google Maps leva o endereço, a cidade e o CEP, e só sai quando o representante clica | `CRCL.ENDERECO`, `BAIRRO`, `CEP`, só com `FIS_JURID = 'J'` | extrator |
| Cidade, Mercado e Código | Cartões (FichaCliente.tsx:129-131) | Mercado: M = montadora, E = exportação, o resto é praça. Código: como em Clientes, "Pessoa física" sem número | `CRCL.TIPO_CLI`; código: `CRCL.CLIENTE` só de empresa | extrator |
| Cliente desde | Só o ano (FichaCliente.tsx:132) | Ano da primeira nota válida da história; nulo se nunca comprou | `MIN(NFME.DT_EMISSAO)` com a RF | extrator; vai só o ano |
| Última visita | Número ao lado da "Última compra": "Hoje", "há 12 dias" ou "Nenhuma", com o botão "Visitei hoje" ou "Desfazer a de hoje". No grupo, a visita mais recente a algum CNPJ, e a marca fica na ficha de cada CNPJ (2026-10-18) | O dia vem do relógio de Brasília do servidor, não da data da foto | não é ERP (`app.db`, `visitas`) | servidor |
| Faturado em 12 meses | Indicador, com "vs 12 meses anteriores" | Como em Clientes | NFME, NFDE | extrator |
| Última compra | Indicador | Como em Clientes | NFME | extrator |
| Ciclo de compra | "N dias" ou "Irregular" (FichaCliente.tsx:182-187) | Mediana dos intervalos entre eventos de compra em 24 meses | `NFME.DT_EMISSAO` | extrator |
| Pedidos em aberto (indicador) | Soma e "N pedidos", ou "Nenhum" (FichaCliente.tsx:165-166 e 188-193) | Soma dos pedidos com status Em aberto do histórico abaixo: os do cliente atribuídos ao representante | VEPM, VEPD | navegador |
| Tendência | O faturado dos últimos 4 anos em duas vistas, num seletor (a escolha do Lucas em 2026-10-18, entre quatro modelos; paginas/TendenciaDaFicha.tsx). **12 meses**, o padrão de cada ficha: a linha da média por mês nos 12 meses até cada mês (a média, e não a soma, desde 2026-10-19, pedido do Lucas), com a área clara embaixo e a escala a partir do zero; só o último ponto e o de 1 ano antes têm o valor escrito (graficos/LinhaDeTendencia.tsx). **Por mês**: as barras do faturado de cada um dos mesmos 48 meses, com o ano em cada janeiro (graficos/BarrasMensais.tsx). Nas duas, em cima, "Desde out/22: +X% na média por mês" | Só meses fechados. A média dos 12 meses tira o vaivém dos pedidos e a época do ano, e o último ponto é o "Faturado em 12 meses" do alto da ficha dividido por 12; as barras mostram o vaivém. O ponto sem 12 meses na história e o mês que ela não alcança ficam de fora (dados/faturamentoDoCliente.ts, com teste) | NFME, NFDE | extrator (60 meses fechados e o corrente); a soma: navegador |
| Mês a mês | As barras do ano corrente contra a marca do anterior, mês a mês, e no mês corrente o que falta faturar, no mesmo desenho do Início. Em cima, "2026 até setembro: R$ X, +Y% vs o mesmo período de 2025" | Os meses fechados do ano contra os mesmos do ano anterior. A faturar: o saldo dos pedidos em aberto com entrega até o fim do mês, os atrasados também, como no Início | NFME, NFDE; VEPM e VEPD no a faturar | extrator; as contas: navegador |
| Famílias compradas | Barras com a parte, o valor e as peças (12 meses), do maior valor para o menor, com o cabeçalho das colunas. No celular, o valor sai e as peças ficam; elas não somem com "Ocultar valores" (pedido do Lucas em 2026-10-17; graficos/BarrasHorizontais.tsx) | RF por família nos mesmos 12 meses do faturado; peças com o cento em 100 peças (`emPecas`). No grupo, a soma dos CNPJs | NFDE, família do produto | extrator |
| Produtos mais comprados | Produto, família, peças, valor, última compra (FichaCliente.tsx:263-271) | Os 8 maiores em valor nos 12 meses; no grupo, os 8 maiores da soma dos CNPJs. O extrator lê todos os produtos do ano e corta em 8 depois de somar | Peças: `TRIM(NFDE.C_PROD)`, `QTDE`, `UNIDADE`. Valor: `NFDE.VLR_TOTAL − Z_FRANCA_DESC` com a RF. Última compra: `NFME.DT_EMISSAO`. Família: `PAC_GRC` → `GRP_DES` | extrator, já com o corte em 8 |
| Pedidos (histórico) | Cartão "Pedidos", no lugar de "Pedidos em aberto" (pedido do Lucas em 2026-10-15): pedido, status, emissão, entrega, itens e valor, do mais recente ao mais antigo, ordenados no navegador; a linha abre como nas abas de Pedidos: o resumo por família e os itens, com a entrega de cada um no pedido em aberto; no rascunho, "Continuar o rascunho" e, no enviado, "Ver o andamento" (FichaCliente.tsx:95-97 e 280-301; DetalhesDosPedidos.tsx:70-96) | Os pedidos do cliente atribuídos ao representante: os faturados com nota nos 12 meses fechados e no corrente, e os em aberto de qualquer data. Status: Faturado, Em aberto, Enviado pelo CRM e Rascunho (componentes/StatusDoPedido.tsx). Faturado: o valor e os produtos das notas do pedido no período, e a entrega é a última nota. O pedido do CRM é "Enviado pelo CRM" até chegar ao ERP e, de lá em diante, tem o status de lá; recusado e cancelado não aparecem (pedido.ts:86-100). Rascunho: sem número, com a data do último salvamento | NFME, NFDE e VEPM no faturado; VEPM e VEPD no em aberto | extrator (`pedido_faturado` e `pedido_faturado_item`, `pedido_aberto` e `pedido_aberto_item`); rascunho e enviado: app.db (F3 e F5), hoje só no fictício |
| Oportunidades de mix | Família e "X% dos clientes parecidos compram" | Ver Análises | NFDE, CRCL | extrator |
| Com quem comparou | "mercado Praça, porte médio" ou "Poucos clientes parecidos" | Ver Análises | CRCL, NFDE | extrator |
| Incluir pedido | Botão para Montar pedido (chamado "Novo pedido" até 2026-10-20, quando o Lucas pediu o nome do SGI em todas as telas); no cliente fora de ativo, o botão fica e mostra o aviso do status, para falar com a equipe de vendas da Suprens (FichaCliente.tsx:69-71 e 102-123) | Leva o id do cliente. Só o cliente ativo no cadastro recebe pedido (decisões do Lucas em 2026-10-14 e 2026-10-15). O pedido é sempre de um CNPJ: no grupo, o botão leva à escolha entre os CNPJs dele | nenhuma | navegador |

- **Razão social.** O SGI concatena `TRIM(A.RAZ_SOCIAL||A.COMPLEM_RZ)` (`untDmCrmCli.dfm:32`). Como `RAZ_SOCIAL` é CHAR(35), o extrator junta direto só quando ela ocupa os 35 caracteres. Nos outros casos, separa com um espaço. Quando a razão é igual ao nome mostrado, a ficha pode omitir a linha.
- **Família do produto.**
  - É o nome do grupo de custo de nível 2: `SGI5_TAB_CUS_V3_GRP.GRP_DES` (FLEXIL, PRESIL, TUCHO…; familias.md:9-34).
  - Há dois caminhos até ela:
    - `SGI5_TAB_ENG_PAC.PAC_GRC`, que tem FK para `GRP_GRP` e uma linha por produto;
    - os 4 primeiros dígitos de `ESTQ.GRUPO` seguidos de `0000`, a regra do Gestao (`produtosAcabados.ts:78-81`).
  - Os dois bateram em 100% das vendas de três famílias desde 1994 (licoes.md:99).
  - Proposta: `PAC_GRC`, com a regra do Gestao como conferência na F2.
  - A mesma regra vale para a Ficha, o mix e o catálogo. Senão, "Já comprados" e o mix deixam de bater.
- **Peças por mês.** `FaturamentoMensal.pecas` não aparece em nenhuma tela (FichaCliente.tsx:77), então sai do contrato. As peças por mês ficam no extrator, para a variação em peças das Análises.
- **Cliente sem compra em 12 meses.** Famílias e produtos ficam vazios. O fictício usa 1/3 dos 36 meses (ficticio.ts:448), o que é só um marcador de lugar.
- **Cliente que nunca comprou.** Ele existe na carteira como perdido (dominio/analises.ts:76), e Clientes já mostra "sem compras" (Clientes.tsx:152). Corrigido em 2026-10-09: a Ficha quebrava com a primeira compra nula. Agora o contrato leva só o ano, `clienteDesde: number | null` (tipos.ts:121-122), e o cartão mostra "—" quando ele é nulo (FichaCliente.tsx:132).
- **Ciclo.** Pelo plano (plano.md:221), o extrator usa os intervalos em dias entre eventos. Exige pelo menos 4 compras. Fora de 30 a 180 dias, o valor é nulo (irregular). O fictício prende o valor entre 30 e 180 e conta meses × 30,4 (ficticio.ts:409-418).
- **Pedidos do grupo.** O histórico da ficha do grupo junta os pedidos de todos os CNPJs, e cada linha diz de qual CNPJ é, embaixo do número (servidor: `lerPedidosDoGrupo`).
- **Pedidos em aberto (decidido em 2026-10-09, pergunta 22).** A ficha mostra só os pedidos do cliente atribuídos ao representante da sessão, como em Pedidos. O pedido do cliente atribuído a outro representante não aparece. Pela proposta da pergunta 26, ele ainda impede "parado" (ver Análises). Por isso a ficha pode mostrar "Nenhum" em pedidos em aberto num cliente que não está parado. O histórico de pedidos da ficha (2026-10-15) segue a mesma regra, também nos faturados.
- **Auditoria.** Abrir a ficha é evento auditado (plano.md:153). O registro leva o código opaco, nunca o nome.

## 5. Análises

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Semestre comparado | Títulos das colunas de Comprando menos e mais e o motivo do selo "Em risco" (Analises.tsx:113 e 117-118; formato.ts:83-89) | Os 6 últimos meses fechados e os mesmos do ano anterior (dominio/analises.ts:108-111). Vai também na situação dos dados, para Clientes e a Ficha | data da foto | extrator |
| Cliente | Primeira coluna de todas as listas: nome e cidade/UF, com link para a ficha (Analises.tsx:212-223) | Como em Clientes | (ver Clientes) | extrator |
| Pararam de comprar | Lista, contagem e resumo (Analises.tsx:65-98) | Ordem pela perda mensal | NFME, VEPM, VEPD | extrator |
| Última compra | Coluna da lista Pararam (Analises.tsx:67) | Como em Clientes | `MAX(NFME.DT_EMISSAO)` com a RF | extrator |
| Ciclo típico | Coluna da lista Pararam | Ver Ficha | `NFME.DT_EMISSAO` | extrator |
| Deixou de entrar por mês | Coluna e soma no resumo | Média dos 12 meses até o mês da última compra | RF mensal | extrator; soma do resumo: navegador (Analises.tsx:87); no Início, servidor |
| Comprando menos e Comprando mais | Listas, contagem e resumo | Ver regras abaixo | RF mensal de 18 meses | extrator |
| Semestre, ano anterior e diferença | Colunas | Soma da RF nos dois períodos | NFME, NFDE | extrator; diferença e soma do resumo: navegador (Analises.tsx:119, 129 e 234-236) |
| Variação | Coluna | Semestre ÷ ano anterior − 1 | (derivado) | extrator |
| Em peças | Coluna e a nota sobre reajuste (Analises.tsx:121 e 138) | Peças ÷ peças do ano anterior − 1; nulo quando o ano anterior tem 0 | `NFDE.QTDE`, `UNIDADE` | extrator |
| Novos e reativados | Lista com selo e contagens | Ordem pelo faturado desde então | NFME | extrator; contagem de novos e de reativados: navegador (Analises.tsx:144 e 156) |
| Desde | Data relativa | Primeira compra (novo) ou compra da volta (reativado) | `NFME.DT_EMISSAO` | extrator |
| Faturado desde então | Coluna e soma | RF do mês de "desde" até hoje | NFME, NFDE | extrator; soma do resumo: navegador (Analises.tsx:157) |
| Oportunidades de mix | Lista com contagem (Analises.tsx:170-207) | Fora de parado e perdido, com sugestão; ordem pelo faturado em 12 meses | NFDE, CRCL | extrator |
| Faturado 12 meses | Coluna da lista de mix (Analises.tsx:190) | Como em Clientes | NFME, NFDE | extrator |
| Comparado a | "Praça, porte médio" ou "mercado todo" | Faixa usada na comparação | `CRCL.TIPO_CLI` e RF de toda a Suprens | extrator |
| Famílias a oferecer | Família e % | Ver regras abaixo | NFDE e família do produto | extrator |

As regras são as de `analises.ts` e `mix.ts`, que têm testes, e o extrator precisa chegar aos mesmos resultados (plano.md:235). Duas partes ainda estão fora de `analises.ts`:
- Quem entra em cada lista está só em `montarAnalises`, no fictício (`ficticio.ts:609-652`), sem teste. Antes da F2, essa montagem vai para `analises.ts`, com teste. A ordem de abertura é da tela (Analises.tsx:94, 106-109, 136, 164 e 203) e só importa ao servidor nos 5 primeiros do Início.
- Os grupos por raiz de CNPJ (plano.md:244).

Regras:
- **Situação**, por precedência (dominio/analises.ts:74-81):
  1. perdido: nunca comprou ou está há mais de 730 dias sem comprar. Até 2026-10-15 se chamava "inativo"; o Lucas trocou o nome, que se confundia com o status do cadastro, e o selo continua cinza. O perdido recebe pedido normalmente;
  2. parado;
  3. novo;
  4. em risco: comprando menos, com a queda ainda no último trimestre;
  5. ativo.
  - Reativado não é situação própria.
  - A situação não é o status cadastral (`CLI3_STA`), que decide carteira e aceite de pedido.
- **Evento de compra:** notas do mesmo cliente com até 7 dias de diferença contam como uma compra (plano.md:220). O fictício não aplica a regra (ficticio.ts:327).
- **Parou de comprar:**
  - dias sem comprar acima do maior entre 60 e 2× o ciclo, ou 180 se o cliente é irregular;
  - sem pedido em aberto;
  - até 730 dias (dominio/analises.ts:88-98; plano.md:222-225).
- **Pedido em aberto que impede "parado":** `VEPD.SALDO > 0` nos tipos de venda, com `VEPM` não bloqueado. É a regra da carteira do Gestao (`Gestao/server/src/pcp/emAberto.ts:58-71`). Proposta, a confirmar (pergunta 26): conta qualquer pedido em aberto do cliente, de qualquer representante, porque Análises é visão do cliente e a conta é da LAN. Falta decidir se contam o pedido ainda no SGI e o pedido enviado pelo CRM.
- **Perda mensal:** soma dos 12 meses até o mês da última compra, inclusive, ÷ 12 e arredondada (dominio/analises.ts:100-106).
- **Comprando menos e mais** (dominio/analises.ts:108-148; plano.md:228-232):
  - base de R$ 3 mil no semestre do ano anterior;
  - pelo menos 3 compras nos dois períodos;
  - variação de 20% ou mais e diferença de R$ 2 mil ou mais;
  - a mudança tem de continuar nos 3 últimos meses fechados, contra os mesmos 3 do ano anterior: abaixo deles na queda, acima na alta (decidido pelo Lucas em 2026-10-14, a queda primeiro e a alta logo depois). A Nova Caminhões, da Star Vendas, estava em risco por −23% de abr a set/26, depois de maio e junho sem comprar, mas já tinha voltado: +30% de jul a set e +17% em 12 meses. Na foto de 14/10, a Star Vendas passou de 13 para 9 clientes comprando menos (em risco) e de 20 para 14 comprando mais.
  - Listas só no fictício (`ficticio.ts:633-640`); a ordem de abertura é a da tela (Analises.tsx:106-109 e 136):
    - "menos" é quem está em risco, ordenado pela diferença mais negativa;
    - "mais" é quem está fora de parado, perdido e novo, ordenado pela maior diferença. O plano não diz que "mais" exclui o cliente novo (plano.md:228-232): confirmar com o Lucas.
- **Novo e reativado** (dominio/analises.ts:150-163; plano.md:234):
  - novo: primeira compra há até 365 dias;
  - reativado: alguma compra dos últimos 365 dias veio depois de 365 dias ou mais sem comprar;
  - só entram clientes fora de parado e perdido (`ficticio.ts:609 e 641-646`).
  - O "faturado desde então" existe só no fictício (ficticio.ts:666 e 678-682).
- **Mix** (mix.ts; plano.md:236-242):
  - O porte é o tercil do faturado em 12 meses entre os clientes ativos do mesmo mercado, em toda a Suprens.
  - Com menos de 20 clientes na faixa, compara com o mercado inteiro. Com menos de 20 no mercado, não há comparação.
  - Sugere a família comprada em 12 meses por pelo menos 50% dos parecidos e que o cliente não compra há 24 meses. A ordem é da maior penetração para a menor, com empate pelo nome.
  - A conta usa todos os clientes da Suprens, na LAN. Para a foto vão só a família, o percentual e a faixa usada.
  - A lista de mix leva quem está fora de parado e perdido e tem sugestão, ordenada pelo faturado em 12 meses (`ficticio.ts:647-652`).
- **Grupos (decidido em 2026-10-17; ver Clientes, "Grupos do SGI"):**
  - As listas têm o grupo no lugar dos CNPJs dele, analisado pelas compras somadas: a compra que muda de CNPJ não vira "parado" nem "novo". Em 17/10, o NORTE COM VAREJ (1603) tinha 3 CNPJs parados e 1 novo, e o grupo estava ativo.
  - A regra das análises é a mesma (dominio/analises.ts): o extrator só junta as compras antes (extrator/src/calculo/grupos.ts, `juntarCompras`, com teste em clientes.test.ts).
  - Cada CNPJ continua com a própria situação, que a ficha dele e a parte "Por CNPJ" mostram.
  - O grupo soma só os CNPJs da carteira do mesmo código. Assim, o representante nunca vê as compras do CNPJ que é de outro (plano.md:206).
- **Alerta rápido de queda (plano.md:233):** não tem tela, campo em `tipos.ts` nem implementação. Fica fora da foto até haver tela.
- **Sem tela:** `ClienteParado.diasSemComprar` (tipos.ts:167) não aparece em nenhuma tela e sai do contrato.

## 6. Pedidos (abas)

Os cartões ficam na ordem Faturados, Em aberto no ERP, Enviados pelo CRM e Rascunhos, e a página abre em Faturados (pedido do Lucas em 2026-10-15; Pedidos.tsx:34-36). O nome, o ícone e o tom de cada um são os do status do pedido na Ficha (componentes/StatusDoPedido.tsx).

Ao lado do título, na altura do subtítulo (desde 2026-10-20; antes, abaixo dos cartões), a busca de cliente filtra as quatro abas pelo nome fantasia ou pelo CNPJ, com ou sem pontuação e com ou sem os dígitos verificadores, e o número de cada cartão segue a busca (pedido do Lucas em 2026-10-15; Pedidos.tsx:45-53, 73 e 81-94; dados/busca.ts). A busca fica no endereço (`busca=`) e continua ao trocar de aba; a aba sem resultado mostra "Nada nesta aba para esse cliente."

**Enviados pelo CRM**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Número CRM | "CRM-00106" (Pedidos.tsx:134) | Gerado no envio, sequencial, nunca reutilizado | vai para `PV1_LR1` (a confirmar) | app.db |
| Cliente | Nome abaixo do número | O app.db guarda o código; o nome vem da foto atual | (foto) | servidor |
| Enviado em | "Enviado hoje, 16:42" | Relógio do servidor em Brasília | nenhuma | app.db |
| Situação | Selo da etapa (Pedidos.tsx:136) | Ver Detalhe do pedido | `PV1_STA`, `VIEW_STA_FAT` | extrator; "enviado": app.db |
| Total | Total do SGI com "no SGI", ou a estimativa com "estimado" (Pedidos.tsx:137-147) | Ver Detalhe do pedido | `SGI5_TAB_VEN_PV2_V2` | extrator e app.db |
| Detalhes (ao tocar na linha) | O andamento e os itens com os totais, como no Detalhe do pedido, e o link para a ficha (Pedidos.tsx:130; DetalhesDosPedidos.tsx:20-41) | Ver Detalhe do pedido | os do Detalhe | os do Detalhe |

**Rascunhos**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Cliente | Nome e cidade/UF | O app.db guarda o código; o nome vem da foto atual | (foto) | servidor |
| Itens | "N produtos" | Itens com quantidade maior que zero | nenhuma | app.db |
| Atualizado | Data e hora relativas ("hoje, 16:42") | Relógio do servidor a cada gravação | nenhuma | app.db |
| Total estimado | Coluna | Σ peças ÷ 100 × cento, com os preços da foto atual, na leitura | `VIEW_VLR_LIQ` (pela foto) | servidor |

**Em aberto no ERP (visão do representante)**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Pedido | Número, com o cliente embaixo | Item de venda com saldo e pedido não bloqueado, atribuído ao representante | `VEPM.NUMERO`; atribuição por `VEPM.VENDEDOR`, na LAN | extrator |
| Cliente | Nome; o link para a ficha fica no fim dos detalhes da linha (DetalhesDosPedidos.tsx:140-151) | Cliente do pedido. Nome e link só se o cliente é da carteira do representante (ver abaixo) | `VEPM.CLIENTE` = `CRCL.CLIENTE` na mesma EMP_FIL | extrator; nome: servidor, por junção com `cliente` do representante da sessão |
| Emissão | Data | Data do pedido | `VEPM.DT_PED` | extrator |
| Entrega | Prazo relativo; a lista abre ordenada por ela, no navegador (Pedidos.tsx:208) | Menor entrega entre os itens com saldo (proposta) | `VEPD.DT_ENTREGA` | extrator |
| Itens | Contagem | Linhas com saldo (proposta) | `VEPD.SEQUENCIA`, `SALDO` | extrator |
| Valor | Coluna | Saldo × preço com descontos e Zona Franca (proposta), sem IPI | `VEPD.SALDO`, `VLR_UNIT`, `PORC_DESC*`; `VEPM.Z_FRANCA_DESC` | extrator |
| Itens (ao tocar na linha) | Produto e família, entrega, peças, cento e valor de cada item com saldo, na ordem do pedido (Pedidos.tsx:206; DetalhesDosPedidos.tsx:44-54) | Peças: o saldo em peças. Valor: a conta do valor em aberto, item a item; a soma é o valor do pedido. Cento: valor ÷ centos (pedido.ts:38-40) | `VEPD.C_PROD`, `UNIDADE`, `SALDO`, `DT_ENTREGA`, `SEQUENCIA`; família pelo grupo de custo | extrator; cento: navegador |

**Faturados (visão do representante, a confirmar)**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Nota | "NF 123456", com o cliente (Pedidos.tsx:232) | Notas de venda dos últimos 45 dias atribuídas aos códigos do login (decidido em 2026-10-13), da mais recente à mais antiga (ordem de abertura no navegador, Pedidos.tsx:230). Os 45 dias estão no texto da tela (Pedidos.tsx:223, 225 e 229) e no fictício (ficticio.ts:163); o plano não fixa janela (plano.md:198). A confirmar | `NFME.N_FISCAL`, `SERIE` | extrator |
| Emissão | Data relativa | | `NFME.DT_EMISSAO` | extrator |
| Cliente | Nome; o link para a ficha fica no fim dos detalhes da linha (DetalhesDosPedidos.tsx:140-151) | Cliente da nota. Nome e link só se o cliente é da carteira do representante (ver abaixo) | `NFME.FORNEC` → cliente | extrator; nome: servidor, por junção com `cliente` do representante da sessão |
| Valor | Coluna | RF da nota, sem IPI e sem ICMS-ST | `NFDE.VLR_TOTAL`, `Z_FRANCA_DESC` | extrator |
| Itens (ao tocar na linha) | Produto e família, peças, cento e valor de cada item, na ordem da nota (Pedidos.tsx:228; DetalhesDosPedidos.tsx:57-68) | RF item a item; a soma é o valor da nota. Cento: valor ÷ centos (pedido.ts:38-40) | `NFDE.C_PROD`, `UNIDADE`, `QTDE`, `VLR_TOTAL`, `Z_FRANCA_DESC`, `LINHA`; família pelo grupo de custo | extrator; cento: navegador |
| Pedido de origem | "Pedido 1148170", no fim dos detalhes (DetalhesDosPedidos.tsx:63; formato.ts:124-126) | Os pedidos do Omega da nota, sem repetir e sem o 0. Em 14/10, cada nota da Star Vendas tinha um | `NFME.NRO_PEDIDO` | extrator |

- **Detalhes na própria lista (pedido do Lucas, 2026-10-14).**
  - Nas abas Enviados, Em aberto e Faturados, tocar na linha abre os detalhes logo abaixo dela, sem sair da lista. Tocar de novo fecha.
  - Só uma linha fica aberta: abrir outra fecha a anterior, e a nova vem para a tela, porque a lista sobe quando a de cima fecha (pedido do Lucas em 2026-10-15; componentes/TabelaResponsiva.tsx:62 e 127-159).
  - Aberta, a linha é o cabeçalho dos detalhes, um tom mais escuro que eles (`--cor-superficie-3` sobre `--cor-superficie-2`, pedido do Lucas em 2026-10-15).
  - Os detalhes começam pelo resumo do pedido: as famílias, da de maior valor à de menor, com as peças e o valor de cada uma (pedido do Lucas em 2026-10-15; DetalhesDosPedidos.tsx:98-116; pedido.ts:46-57). Depois vêm os itens, que ordenam pela URL em `ordem-itens`, sem reordenar a lista de fora.
  - Antes, a linha de Enviados levava ao Detalhe do pedido, e as de Em aberto e Faturados, à ficha do cliente. O Detalhe do pedido continua como a tela que abre depois do envio (MontarPedido.tsx:92).
  - Rascunhos não abre: a linha tem os botões Continuar e Descartar, e Continuar já mostra o rascunho inteiro.
  - A aba Em aberto mostra só os itens com saldo, que formam o valor em aberto. O item já faturado fica no pedido do Omega com saldo 0 e não aparece.
- **Pedido em aberto.**
  - É `VEPD.SALDO > 0` com `VEPD.TIPO_MOVTO` nos 7 tipos de venda e `NVL(TRIM(VEPM.BLOQUEADO),'N') <> 'S'` (emAberto.ts:58-71).
  - O protótipo excluía 450, 305 e 430 em vez de filtrar pelos tipos de venda, um erro conhecido (CRM-prototipo/REGRAS.md:80-82).
- **Escopo dos pedidos em aberto (decidido em 2026-10-09, pergunta 22).**
  - Só os pedidos atribuídos ao representante, pela regra do Início: `VEPM.VENDEDOR`; se vier nulo ou 0, o dono do cliente pelo `VEND_1` atual. A conta é da LAN, e a foto leva o representante em cada pedido.
  - O servidor lê `pedido_aberto` só pelo representante da sessão, nunca por vendedor vindo do navegador.
  - O pedido de cliente da carteira atribuído a outro representante não aparece. Pela proposta da pergunta 26, ele ainda impede "parado" (ver Análises).
  - O subtítulo da aba diz "Todos os pedidos da sua carteira" (Pedidos.tsx:200) e muda para falar dos pedidos do representante.
- **Pedido ou nota de cliente de outra carteira.** Pela atribuição, o representante pode ter um pedido ou uma nota de cliente que hoje é de outro (cliente transferido). Proposta, a confirmar com o Lucas (pergunta 33):
  - a linha aparece sem o nome, com o texto "Cliente de outra carteira", e sem link para a ficha, que responderia 404;
  - assim a foto não leva nome nem id de cliente de fora da carteira (`cliente` nulo), e o nome continua vindo só de `cliente` com o representante da sessão;
  - hoje a linha das duas abas abre os detalhes, e o link para a ficha fica no fim deles (DetalhesDosPedidos.tsx:140-151).
- **Valor em aberto.**
  - Na carga do SGI para o Omega, `VEPM.Z_FRANCA_DESC` recebe a alíquota de ICMS (%), só no tipo 315 (`Recebimento {REC}/Carga Pedido Venda e NF {CPV}/untDmRecCpv_Cpv.dfm:915-928`). A mesma `VIEW_PIC` vai para `PORC_ICM` (874-875). Não é um valor em R$.
  - A RF desconta `NFDE.Z_FRANCA_DESC` em R$. Sem o desconto no pedido, o valor em aberto de um pedido 315 fica acima do que ele vai faturar, e a projeção soma duas bases diferentes.
  - Proposta, a conferir contra uma nota 315: a conta por item é SALDO × VLR_UNIT × (1 − PORC_DESC/100) × (1 − PORC_DESC2/100) × (1 − PORC_DESC_CLI/100) × (1 − PORC_DESC_CPAG/100) × (1 − NVL(VEPM.Z_FRANCA_DESC,0)/100).
  - Saldo e preço estão na mesma unidade (CT), então o resultado já sai em R$.
  - Nos pedidos do SGI, os descontos vêm zerados: `PORC_DESC` em `untDmRecCpv_Cpv.dfm:1865-1866`; `PORC_DESC2`, `PORC_DESC_CPAG` e `PORC_DESC_CLI` em 2039-2046.
  - Falta conferir se o total bate com a tela de pedidos do SGI.
- Do VEPM, nunca ler `PEDIDO_CLI`, `CONTATO`, `CONT_FONE`, `CONT_FAX`, `NRO_CARTAO`, `BANCO` nem `AGENCIA`.
- **Faturados.**
  - Escopo (pergunta 23, decidido em 2026-10-13): só as notas atribuídas aos códigos do login, pela regra da Atribuição do Início (`NFME.VENDEDOR`; se vier nulo ou 0, o dono do cliente na data). É a mesma visão dos indicadores de faturamento, e a conta é da LAN.
  - O fictício ainda usa a carteira.
  - No Oracle, a nota é única por (EMP_FIL, N_FISCAL, SERIE, FORNEC, TIPO_MOVTO) (omega/ABC71-NF.md:6655). A foto leva uma linha por nota (N_FISCAL, SERIE), com o valor somado de todas as linhas dela, inclusive de tipos de movimento diferentes. Se houver mais de uma EMP_FIL com notas de venda (pergunta 4), a chave inclui a empresa.
  - Nenhuma tela mostra a série. Corrigido em 2026-10-09: a lista usava só o número como chave, e duas notas de mesmo número em séries diferentes colidiam. Agora `NotaFaturada` tem um `id`, série e número (tipos.ts:343-345), que a lista usa como chave (Pedidos.tsx:227).
- **Rascunho ou pedido enviado de outro login:** responde 404 (plano.md:43).

## 7. Montar pedido

- **Tela travada (2026-10-20, pedido do Lucas).** Com o pedido ao lado do catálogo (960 px úteis ou mais) e altura para isso, a página fica do tamanho da janela, como Clientes, Análises e Pedidos: rolam só a lista de produtos e a dos itens escolhidos. Numa coluna, o pedido vem embaixo do catálogo, e a página rola.
- **O alto do pedido.** Entrega desejada, Observação, Total estimado e Enviar pedido ficam em cima, sempre à vista; os itens vêm embaixo, um por linha, e o "rascunho salvo" e o "Descartar rascunho" no pé (MontarPedido.tsx). A nota de que o SGI recalcula os preços foi para a confirmação do envio.

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Escolha do cliente | O pedido é sempre de um CNPJ: o grupo aparece pelos CNPJs dele, e o "Incluir pedido" da ficha do grupo abre a escolha só entre eles ("Para qual CNPJ de OVD é o pedido?", `/pedidos/novo?grupo=`). O catálogo do grupo responde 404. Nome, código do ERP (ou "Pessoa física"), cidade, status, situação e última compra. Escolher o cliente fora de ativo abre o aviso do status, para falar com a equipe de vendas, e não o catálogo (MontarPedido.tsx:61 e 428-435). Até 2026-10-14, a escolha mostrava e buscava pelo id do cliente, que não deve aparecer na tela. Abre na ordem recebida, sem coluna marcada, e o representante reordena por Cliente, Status, Situação e Última compra (MontarPedido.tsx:405-421) | Clientes da carteira | (ver Clientes) | extrator; ordem de abertura: servidor, por `faturamento_12m` decrescente; busca e reordenação: navegador (MontarPedido.tsx:386 e 405-421) |
| Cliente do pedido | Nome e cidade/UF no cabeçalho e no diálogo de envio (MontarPedido.tsx:107 e 162) | Cliente da carteira, pelo código da URL ou do rascunho | (ver Clientes) | extrator |
| Tabela de preço | O nome da tabela no cabeçalho e em "Preços da …" (MontarPedido.tsx:107 e 120). O fictício junta o mercado ao nome ("Tabela 23 · Praça", pedidosFicticios.ts:41); a tela real mostra só `cliente.tabela_preco` | Uma por cliente, escolhida pelo extrator, nunca pelo navegador: a principal; sem ela, a que não é secundária. Só em real; na montadora, só a ativa (extrator/src/calculo/catalogo.ts). Na Star Vendas, em 14/10: "PADRAO - FEV" para 177 clientes e "MITSUBISHI CATA" para 1 | `SGI5_TAB_VEN_CLI.CLI_TAB` e `CLI_STA`; `SGI5_TAB_VEN_TP1.TP1_NOM`, `TP1_MOE`, `TP1_STA` | extrator |
| Catálogo | Abas "Já comprados" e "Todos", com contagem | Só produto vendável e com preço para o cliente. Clientes com a mesma tabela e os mesmos descontos dividem uma lista de preços: em 14/10, 50 listas para os 178 clientes da Star Vendas | view de preço líquido, ESTQ, view de produto sem árvore | extrator; servidor, por `/api/clientes/:codigo/catalogo`, só de cliente do login e nunca do cliente fora de ativo (409) |
| Código do produto | Título da linha | `TRIM(VIEW_PAC)` | `SGI5_VIEW_VEN_TP2_VLR_LIQ_CLI.VIEW_PAC` | extrator |
| Família | Descrição e busca | Mesma regra da Ficha | `PAC_GRC` → `GRP_DES` | extrator |
| Medida | "14–22 mm" na descrição e na busca | Faixa de aperto em mm; sem as duas pontas, nenhuma (kits, molas). Em 14/10, 470 dos 692 produtos do catálogo tinham | `PAC_DMI_MM`, `PAC_DMA_MM` | extrator |
| Part number | "part number X" na descrição e na busca | Part number formatado; sem ele, o part number; '0' vira nulo. Na tabela da montadora é o código dela; na tabela padrão, a referência do fabricante do veículo (143 dos 742 produtos). Até 2026-10-14 a tela dizia "no cliente: X" | `VIEW_PNU_FOR`, `VIEW_PNU` | extrator |
| Embalagem | "100 pç" e o passo dos botões + e − da quantidade | Peças por embalagem: a quantidade do EAN do produto. Em 14/10, cada produto do catálogo tinha um EAN só (100, 50, 20, 500…); o múltiplo e o lote mínimo da tabela vinham vazios. Sem EAN, qualquer quantidade | `SGI5_TAB_ENG_EAN.EAN_QTD`, pelo `EAN_COD` | extrator |
| Cento | Preço do cento, só referência | Decidido pelo Lucas em 2026-10-14: o preço da tabela do cliente com o desconto do modelo do produto e, sem ele, com o desconto padrão do cliente. É a conta da view do SGI: `TP2_PVE × DES_IND ÷ 100`, com o desconto de `SGI5_TAB_VEN_CLI2` (cliente × `PAC_MOD`) no lugar do `CLI_DES` quando existe. Em 14/10, a conta refeita pelas tabelas deu o mesmo preço nos 122.142 pares de cliente e produto. Sem IPI | `VIEW_VLR_LIQ` | extrator |
| Já comprou | Separa as abas | Produto da lista do cliente que ele comprou nos últimos 24 meses, com o mês corrente (proposta, pergunta 28) | `TRIM(NFDE.C_PROD)` com a RF | extrator (`produto_comprado`) |
| Quantidade | Peças: o que for digitado fica como está; o + vai à próxima embalagem fechada e o − à de baixo (de 300, num item de 500, o + vai a 500 e o − a 0) | Inteira e positiva. Fora da embalagem também vale, porque pedir 300 peças de um item de 500 é o dia a dia (decisão do Lucas em 2026-10-20; antes, a tela arredondava para cima e não enviava) | nenhuma | app.db |
| Valor do item | Ao lado da quantidade (MontarPedido.tsx:290) | Peças ÷ 100 × cento | (foto) | navegador |
| Entrega desejada | Data com mínimo hoje | Não antes de hoje, pelo relógio de Brasília | vira `PV2_DEN` de cada item (no arquivo, `CGA_DEN`) | app.db |
| Observação | "Observação (n/300)" | Até 300 caracteres, conjunto permitido, CP1252 | vira `PV1_OBS` | app.db |
| Total estimado | Barra e fechamento | Σ peças ÷ 100 × cento | (foto) | navegador; ao salvar e enviar: servidor |
| Rascunho salvo | "Rascunho salvo hoje, 16:42." | Grava 700 ms depois da última mudança, quando há item | nenhuma | app.db |
| Confirmar com chave | Diálogo de envio | Nova verificação da chave, ligada ao hash do pedido (plano.md:148) | nenhuma | app.db |

- **Produto vendável.** Os critérios vêm do SGI. A LAN repete a mesma regra ao revalidar (plano.md:173).
  - Há linha na view com `VIEW_CLI` = cliente, `TRIM(VIEW_TAB)` = tabela escolhida e `VIEW_STA LIKE 'ATIVO%'` (`untVenPvd_PosPac.dfm:553-556`). O filtro inclui 'ATIVO-DB', que o protótipo ignorava.
  - O produto está ativo no Omega: `NVL(TRIM(ESTQ.QT_ALT_OBR),'A') <> 'I'` (`untVenPvd_PosPac.dfm:557`). O `PAC_STA` do SGI não entra, porque 345 produtos em PRODUCAO estão inativos no Omega (produto-acabado.md:13).
  - O produto não está na `SGI5_VIEW_ENG_PAC_SEM_ARVORE` (`untVenPvd_PvdIncluirItens.pas:432-443`).
  - O preço não é nulo e é maior que zero (a confirmar; o SGI não confere).
  - A tabela está em REAL (`TP1_MOE`). Para MONTADORA, a tabela não pode estar obsoleta e o cliente não pode estar inativo, que é o que o SGI bloqueia (`untVenPvd_PvdIncluir.pas:1005-1024`).
- **Preço por cento (CT), conferido no fonte.**
  - O relatório de preço líquido rotula as colunas "Tabela (CT)" e "Liquido (CT)" (`untVenRel_RelTabelaPrecoLiquido.dfm:614 e 668`).
  - A tela de item grava a unidade 'CT' com `VIEW_VLR_LIQ` como valor líquido e de venda (`untVenPvd_ItensMov.pas:139-149`).
  - O preço já tem o desconto do cliente e não tem IPI. O SGI aplica o IPI à parte (`untVenPvd_ItensMov.pas:181-185`).
- **Tabela.** Proposta: a linha com `CLI_STA = 'PRINCIPAL'`. O SGI ignora `CLI_STA` e deixa o usuário escolher quando há mais de uma (`untVenPvd_PvdIncluir.pas:1167-1176`). Pendência do plano.md:335.
- **Part number.** A PK da `SGI5_TAB_VEN_TP2` inclui o part number (TP2_COD, TP2_PRO, TP2_CMO). O mesmo produto pode aparecer mais de uma vez na tabela, mas o CRM indexa só pelo código (MontarPedido.tsx:251).
- **O navegador nunca manda preço, tabela nem representante.** `RascunhoParaSalvar` tem só id, código do cliente, itens, entrega e observação (tipos.ts:251-257). O servidor confere:
  - cliente na carteira;
  - produto no catálogo do cliente;
  - quantidade inteira e positiva, também fora da embalagem (2026-10-20);
  - limite de itens;
  - schema estrito.
- **Rascunho com produto que saiu do catálogo** (deixou de ser vendável ou perdeu o preço entre duas fotos).
  - A tela carrega as quantidades de todos os itens do rascunho (MontarPedido.tsx:71-72), mostra só os que estão no catálogo (MontarPedido.tsx:80) e reenvia todos em cada salvamento automático (MontarPedido.tsx:184-186).
  - Com a validação "produto no catálogo do cliente", o servidor recusaria o rascunho inteiro em todo salvamento.
  - A aba Rascunhos conta esse item em "N produtos" (Pedidos.tsx:169), e o total estimado não tem preço para ele (pergunta 33).
- **URL do catálogo.** O catálogo é pedido pelo código do cliente na URL (`/pedidos/novo?cliente=`). Com o id opaco, a query string deixa de levar o CNPJ e, na pessoa física, o CPF.
- **Quantidade.** A única conversão é peças ÷ 100 = CT (pedido.ts:8-9 e 23-25). Ela acontece na LAN, ao montar o arquivo do SGI.
- **Entrega.**
  - Na carga atual, a data do arquivo (`CGA_DEN` → `DET_DEN`) vai para o `PV2_DEN` de cada item (`untDmVenPvd.dfm:6163-6164`; `untVenPvd_PvdIncluirCarga.pas:770-778`). O `PV1_DEN` recebe a data do dia (`untDmVenPvd.dfm:6013-6014`; `untVenPvd_PvdIncluirCarga.pas:685-688 e 704`).
  - A data do arquivo só vale quando quem carrega escolhe PROGRAMADA no combo `cbTen`. Com IMEDIATA, a carga grava hoje no PV1 e no PV2.
  - A carteira que o CRM lê também usa a entrega do item (`VEPD.DT_ENTREGA`).
  - A tela do SGI exige no mínimo hoje+7 para os tipos 310, 315, 316 e 317 com entrega PROGRAMADA (OracleDB/docs/modulos/pedidos-venda.md:33). A confirmar para o layout CRM (pergunta 40).

## 8. Detalhe do pedido

Abre depois do envio (MontarPedido.tsx:92). Na aba Enviados, o mesmo andamento e os mesmos itens aparecem ao tocar na linha (componentes/PedidoEnviado.tsx).

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Número CRM | "Pedido CRM-00106" (DetalheDoPedido.tsx:32) | | nenhuma | app.db |
| Cliente | "Para <cliente>" com link | O nome vem da foto atual | (foto) | servidor |
| Enviado em | "Enviado hoje, 16:42" | Relógio do servidor | nenhuma | app.db |
| Itens | Código, família · medida, peças, cento e valor | Cópia do catálogo da foto no envio | (foto) | app.db; valor da linha: navegador (PedidoEnviado.tsx:64; pedido.ts:33-35) |
| Entrega e observação | Só quando preenchidas | Cópia do rascunho, imutável | nenhuma | app.db |
| Estimativa do CRM | Total | Σ congelada no envio e calculada pelo servidor | (foto) | app.db |
| Total no SGI | Ao lado da estimativa | Σ `PV2_QTD` × `PV2_VLR_VEN`, sem IPI | `SGI5_TAB_VEN_PV2_V2` | extrator |
| Etapa atual | Selo | Ver tabela abaixo | `PV1_STA`, `VIEW_STA_FAT` | extrator |
| Andamento | Data e hora de cada passo (PedidoEnviado.tsx:14-32) | Ver tabela abaixo | `PV1_DCA`, `PV1_DLB_*`, `PV1_DCO`, `NFME.DT_EMISSAO` | extrator; "enviado": app.db |
| Número no SGI | "Número no SGI: N" no passo Recebido | `PV1_NPE` da linha com `TRIM(PV1_LR1)` igual ao número CRM | `PV1_NPE`, `PV1_LR1` | extrator |
| Número no ERP | "Número no ERP: N" no passo No ERP | `VEPM.NUMERO` = `PV1_NPE` | `VEPM.NUMERO` | extrator |
| Motivo da recusa | Texto no passo Recusado (PedidoEnviado.tsx:43-44) | Código de uma lista fechada; na recusa por item, mais o código do produto | registro da LAN | extrator |

| Etapa | Quando | Data do passo |
|---|---|---|
| enviado | O servidor gravou o envio | app.db |
| recebido | A LAN aceitou e gravou o arquivo na pasta do SGI (proposta) | registro da LAN |
| recusado | A LAN recusou (validação ou quarentena) ou o importador moveu o arquivo para `erros\` | registro da LAN |
| em_aprovacao | Achado no PV1 por `PV1_LR1`, com `PV1_STA = 'PEDIDO BLOQUEADO'` | `PV1_DCA` |
| aprovado | `PV1_STA = 'PEDIDO'` | a liberação final de vendas: `PV1_DLB_VD2` (a confirmar) |
| no_erp | `PV1_STA = 'PEDIDO OMEGA'` e existe VEPM com `NUMERO = PV1_NPE` | `PV1_DCO` |
| faturado_parcial | `VIEW_STA_FAT = 'FATURADO PARCIAL'` | emissão da primeira nota do pedido |
| faturado | `VIEW_STA_FAT = 'FATURADO TOTAL'` | emissão da última nota do pedido |
| cancelado | `PV1_STA = 'CANCELADO'` | a confirmar: `PV1_DUA` ou `VEPM_SGI5_LOG.LOG_DTA` |

- **Ligação só pelo número CRM**, porque o número do SGI recomeça depois de 2.999.999 (plano.md:183).
  - Hoje a carga por arquivo grava `PV1_LR1` vazio: a consulta da carga traz `NULL MES_LR1` (`untDmVenPvd.dfm:6061-6063`), que `untVenPvd_PvdIncluirCarga.pas:718` repassa.
  - A origem gravada hoje é 'CARGA PORTAL' (`untDmVenPvd.dfm:5995-5996`).
  - O layout CRM precisa gravar o número e ter índice único (plano.md:166).
  - A carga para o Omega copia `SUBSTR(VIEW_LR1,1,20)` da `SGI5_VIEW_CARGA_PEDIDOS` para `VEPM.LIVRE` (`untDmRecCpv_Cpv.dfm:930-931` e 1071), que é CHAR(20) (omega/ABC71-VE.md:8138). A GNRE lê esse campo (`untDmContGnre.dfm:405-406`).
  - A conferir em DBA_VIEWS: se o `VIEW_LR1` da view é o `PV1_LR1`, `TRIM(VEPM.LIVRE)` igual ao número CRM confere a etapa no_erp sem depender do `PV1_NPE`, que recomeça. Nesse caso, o número CRM fica com no máximo 20 caracteres, e não os 21 do `PV1_LR1`.
- **Recebido e em aprovação.** Com a proposta acima, o número do SGI só aparece quando o pedido chega a "em aprovação". A tela já o mostra sob o passo Recebido quando ele existe (PedidoEnviado.tsx:38).
- **Número no SGI e no ERP são o mesmo.** A tela do SGI liga `VEPM.NUMERO = PV1_NPE` (`untDmVenPvd.dfm:539-540`; pedidos-venda.md:15). Os fictícios sorteiam números diferentes (pedidosFicticios.ts:230-231). Proposta: um campo só.
- **Pedido do CRM nasce bloqueado.** Hoje a carga deixa os tipos 320, 325 e 326 como 'PEDIDO' (`untVenPvd_PvdIncluirCarga.pas:648-666`). O layout CRM nasce sempre bloqueado (plano.md:164).
- **Data de aprovado.** No Oracle, `GREATEST` das datas de liberação dá nulo se alguma for nula. Por isso a proposta é a liberação final de vendas, conferida contra as outras. Entre elas está a sexta liberação, `PV1_DLB_BPV`, do bloqueio de preço abaixo do mínimo (sgi/ABC71-SGI5-TAB_VEN.md:1435), que a tela de pedidos do SGI lê (`untDmVenPvd.dfm:324-325`).
- **Total no SGI.** É a mesma conta da tela de pedidos do SGI (`SOMA_PEDIDO.VLR_S_IPI`, `untDmVenPvd.dfm:111-140`). Estimativa e total do SGI estão os dois sem IPI.
- **Datas de faturado.**
  - Notas do pedido = NFME com `NRO_PEDIDO = VEPM.NUMERO` e `FORNEC = VEPM.CLIENTE`, como na Consulta Pedidos Venda do SGI (`Vendas {VEN}/Consulta Pedidos Venda {CONPVE}/untDmVenConPve_ConPve.dfm:527-528 e 1257-1261`). A GNRE liga só por `NFME.NRO_PEDIDO = VEPM.NUMERO`, sem o cliente (`Contabilidade {CONT}/Geracao GNRE {GNRE}/untDmContGnre.dfm:417-418`), o que o CRM não deve copiar.
  - O filtro pelo cliente é obrigatório, porque o número do pedido recomeça depois de 2.999.999 (OracleDB/docs/licoes.md:30).
  - Por item, a ligação seria `NFDE.NRO_PEDIDO`/`ITEM_PED` = `VEPD.NUMERO`/`SEQUENCIA` (`Vendas {VEN}/Relatorios {REL}/untVenRel_RelMonEntMon.dfm:2029-2033`). Nenhuma tela precisa dela.
  - Na F2, conferir só o preenchimento.
- **Motivo da recusa.**
  - Lista fechada de códigos com frases fixas.
  - Nunca texto do Oracle, crédito, restrição financeira, preço mínimo ou nome de cliente.
  - A recusa por cliente fora de ativo no SGI (`CLI3_STA`) sai com texto genérico. A LAN não recusa por crédito, porque não lê a restrição financeira (pergunta 16).
  - A tela de hoje mostra uma frase que cita o produto ("O produto X saiu de linha…", pedidosFicticios.ts:233). A recusa por item (fora de linha, sem preço, fora do catálogo) leva o código do produto em `pedido_crm.motivo_produto`, único parâmetro da frase fixa. Nenhum outro texto variável entra.
- Não extrair `PV1_ULB_*`, `PV1_JCA`, `PV1_JLB_CRE`, `PV1_JUS_BPV`, `PV1_LIM_CRE`, `PV1_TIT_ABE`, `PV1_PED_ABE`, `PV1_VLR_PED`, `PV1_TRA_*` nem `LOG_USU`.

## 9. Entrar e Convite (feitas em 2026-10-15)

Feitas com a chave de acesso de verdade no modo de dados reais em 2026-10-15 (F3). No protótipo com dados fictícios, os botões continuam simulando. As regras ficam em `server/src/login`, e as telas usam `web/src/acesso/login.ts`.

**Entrar**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Chave de acesso | "Entrar com chave de acesso" (Entrar.tsx) | Chave residente: o aparelho mostra as chaves do CRM que tem, sem digitar nada. Exige a digital, o rosto ou o PIN e fica presa ao domínio do CRM. O servidor confere a assinatura, o desafio de uso único e o dono da chave (`POST /api/entrar/opcoes` e `/api/entrar`) | nenhuma | app.db |
| Motivo da saída | "Você saiu", "60 minutos sem uso", "limite de 12 horas", "acesso encerrado pelo administrador" | O `motivo` da 401 do servidor vira `?motivo=` (saiu, inatividade, limite ou revogada) | nenhuma | app.db |
| Erro da chave | "A chave de acesso não foi usada: o pedido foi cancelado ou o tempo acabou" e outros (acesso/chaveDeAcesso.ts, `explicarErro`) | O erro do aparelho na língua de quem usa, sem detalhe técnico | nenhuma | navegador |
| Aviso de registro | "Os acessos ao CRM são registrados." (TelaDeAcesso.tsx) | Texto fixo | nenhuma | navegador |

**Convite**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Saudação | "Olá, Star Vendas" (Convite.tsx) | O nome do login, só com token válido, pela rota pública `POST /api/convite/consultar`; o token vai no corpo, nunca na URL do pedido | nenhuma (app.db: usuarios) | servidor |
| Validade | "vale até 17/10 às 15:42" | Gravada na criação: 48 horas | nenhuma | app.db |
| Estado do convite | "Convite expirado", "já usado", "trocado" e "Link incompleto" | Uso único, usado só junto com a chave gravada (plano.md:133); o convite novo do mesmo login troca o anterior; token fora do formato nem chega ao servidor | nenhuma | app.db |
| Navegador de aplicativo | Aviso com "Copiar link" (Convite.tsx) | `userAgent`, sem enviar nem guardar | nenhuma | navegador |
| Chave criada | Tela de conclusão e "Ir para o CRM" | Grava a chave pública e já abre a sessão | nenhuma | app.db |

- **Token.** Vai depois do `#` (plano.md:132), com 256 bits, e o banco guarda só o hash. As rotas do login e do convite têm limite de 30 pedidos por IP em 10 minutos (plano.md:92).
- **Prévia do WhatsApp.** Abrir o link só consulta o convite; ele é usado só quando a chave é criada.

## 10. Mapa (feito em 2026-10-15)

Pedido do Lucas em 2026-10-15: mostrar ao representante as regiões que ele poderia atender melhor e de onde vem a receita dele, sem copiar o mapa antigo. Mais tarde, as rotas de visita saem daqui. Tela em `web/src/paginas/Mapa.tsx`; as regras em `web/src/dados/mapa.ts`, com teste.

- **A função do mapa (2026-10-18).** O tempo na estrada é o que o representante tem de mais escasso. O mapa responde "para onde eu vou, e o que faço lá?" e, a médio prazo, "como está meu território?". Valor exato e evolução no tempo ficam em Clientes e Análises.
- **Quatro visões**, nos botões do alto e no endereço (`visao=`), cada uma em `web/src/paginas/mapa/` com os números, o desenho, a legenda, a dica, a lista e as colunas dela:
  - "Onde agir", a que abre: em cada cidade, um círculo do tamanho do dinheiro em jogo por mês nos clientes que pedem ação, vermelho com parado, âmbar com comprando menos ou fora do ciclo, e um ponto azul onde só há mix ou cliente novo. A lista dá as regiões pelo dinheiro em jogo, e a escolha, os clientes com o motivo;
  - "Receita": o círculo é o faturado em 12 meses, e a cor diz se o município cresce (verde), está estável (cinza) ou cai (vermelho) 10% ou mais contra os 12 meses anteriores. Um círculo grande e vermelho é um mercado grande encolhendo;
  - "Esquecidas": a cidade com cliente pintada pelo tempo desde a última compra de algum cliente dela (até 30, 90 e 180 dias, e mais), e a lista das cidades da mais esquecida à mais recente;
  - "Onde crescer": as regiões da área pelo potencial que falta, em 4 tons de verde, e as cidades sem cliente. A recuperação de cliente parado foi para "Onde agir".
- **Fora do mapa.** O cliente sem o município no cadastro não entra; a página diz quantos são.
- **A cidade de perto (2026-10-19).** O clique ou o toque numa cidade aproxima o mapa até ela encher o quadro, com os bairros do Censo 2022 ou, sem eles, os distritos, e um ponto por empresa (dados/cidade.ts e graficos/MapaDoTerritorio.tsx, com teste).
  - O ponto mostra o nome, o motivo e o faturado; o toque abre, ao lado do mapa, o cartão do cliente, com "Abrir a ficha", "Pôr no roteiro" e "Google Maps". O cartão diz quando o ponto é aproximado (na rua ou no meio do CEP).
  - Pessoa física não tem endereço no CRM e fica sem ponto, como o endereço que o IBGE não achou: a legenda diz quantos.
  - Na foto de 19/10, dos 3.187 endereços de empresa, 1.767 caíram no número, 1.033 na rua, 127 no meio do CEP e 260 ficaram sem ponto.
- **Zoom e arraste (2026-10-19, pedido do Lucas: em São Paulo os pontos ficavam pequenos e encavalados).** O representante aproxima e move o mapa por cima do enquadramento que a tela escolhe, até 300 m de largura (graficos/useGestosDoMapa.ts e zoomDoMapa.ts, com teste):
  - no computador, arrastar move, e Ctrl (ou ⌘) com a rolagem aproxima, como o Google Maps dentro de uma página; a rolagem sozinha continua rolando a página e mostra o aviso do Ctrl;
  - no celular, dois dedos movem e aproximam, e um dedo rola a página; a dica aparece no canto do mapa;
  - os botões + e − aproximam do meio, e o de voltar desfaz o ajuste. Escolher outra cidade ou região também desfaz;
  - o ponto do cliente tem o mesmo tamanho em px em qualquer zoom: aproximar separa os pontos. De perto, o que fica fora da cidade escolhida recua, porque o contorno grosso dos vizinhos não casa com o fino dela.
- **Por que o IBGE e não o Google (2026-10-19).** Os termos da Geocoding API proíbem usar o ponto dela fora de um mapa do Google (cláusula 6.2) e mandam apagar a coordenada guardada em 30 dias; o mapa do Google também é de outro domínio, que a CSP não deixa carregar. O CNEFE é público, roda na LAN e não manda endereço de cliente a ninguém.
- **Por estado.** Os botões mostram os estados da carteira, com o número de clientes, e a página abre no que tem mais (`uf=`). Os outros estados da carteira aparecem em volta, mais claros.
- **Escolha.** A lista mostra as 8 primeiras regiões e o "Ver todas". A região escolhida na lista é aproximada no mapa. O clique ou o toque num município mostra os clientes dele, cada um com o caminho para a ficha. O mouse mostra a dica do município.
- **Grupos.** O mapa põe cada CNPJ do grupo no seu município, com os números dele. O dinheiro em jogo de um grupo parado ou comprando menos se divide entre os CNPJs pela parte de cada um no faturado de 12 meses, ou em partes iguais se ele não faturou nada; o mix e o novo valem para todos os CNPJs, e o atraso no ciclo é de cada um (dados/mapa.ts, `acoesDaCarteira`, com teste).
- **Nomes no mapa.** Os 5 municípios que mais pesam têm o nome ao lado do círculo. O nome passa para a esquerda quando à direita encostaria em outro ou sairia do quadro. Se não cabe de nenhum lado, fica de fora (`web/src/graficos/nomesNoMapa.ts`, com teste).

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Ponto do cliente | De perto, um ponto por empresa no endereço dela, na cor da ação mais grave (vermelho parado, âmbar comprando menos ou fora do ciclo, azul mix ou novo, cinza em dia) e do tamanho do faturado em 12 meses entre os da cidade | O CNEFE do IBGE (Censo 2022), buscado pelo extrator na LAN: o mesmo número na mesma rua; o mesmo número no CEP, com a rua escrita diferente; o número mais perto na rua; o meio da rua; o meio do CEP, se ele não for o da cidade toda (extrator/src/localizacao, com teste). Sem achar, o cliente não tem ponto e a legenda conta quantos | `CRCL.ENDERECO`, `BAIRRO`, `CEP` (empresa) e o CNEFE | extrator |
| Município do cliente | Círculo e área com cliente | Código IBGE de 7 dígitos que começa pelo código da UF do cliente. Fora disso, nulo, e o cliente fica fora do mapa (`municipioDoCadastro`, com teste) | `CRCL.RESERVADO7` | extrator |
| Desenho, nome, região imediata, população e PIB | Contornos, nomes, habitantes e potencial | Malha municipal do IBGE, lista dos municípios com a região imediata, Censo 2022 e PIB dos Municípios de 2021, em arquivos estáticos (ver abaixo) | não é ERP | gerador do extrator, uma vez |
| Faturado do município e da região | Círculos, lista e indicadores | Soma do faturado em 12 meses dos clientes da carteira | (foto: `cliente.faturamento_12m`) | navegador |
| Concentração | "N municípios fazem 80% da receita no estado" | Os municípios que mais faturam, somados até 80% | (derivado) | navegador |
| Área | As regiões que entram no potencial | As regiões imediatas com cliente da carteira e as vizinhas delas, no mesmo estado | (derivado; as vizinhas vêm no arquivo do estado) | navegador |
| Potencial e lacuna | Verde do mapa, "Potencial por ano", "Maior oportunidade", lista "Onde crescer" e "Na sua média pelo PIB" | Potencial: o faturado da área por real do PIB agro + indústria dela × o PIB agro + indústria da região. Lacuna: o que falta para o potencial. Fora da área, os dois são 0. Os tons de verde seguem os quartis das lacunas | (derivado) | navegador |
| PIB agro + indústria | Lista "Onde crescer", detalhe da região, dica e cidades sem cliente | O valor adicionado da agropecuária e da indústria do município em 2021, somado por região. Na cidade em que a atividade principal é energia ou extração, só a agropecuária. É dado público e aparece mesmo com os valores ocultos | não é ERP (IBGE) | gerador do extrator, uma vez; a soma, navegador |
| Em jogo por mês ("Onde agir") | Círculos, lista, indicador e a coluna dos clientes | A perda mensal de quem parou, a queda por mês de quem compra menos (as listas de Análises) e a média mensal (faturado em 12 meses ÷ 12) do cliente ativo que passou do próprio ciclo de compra | (foto: `analise_parado`, `analise_ritmo`, `cliente.ciclo_dias`, `ultima_compra`) | navegador |
| Motivo ("Onde agir") | "Parou há 120 dias", "Comprando menos: −45% no semestre", "44 dias sem comprar; costuma a cada 33", "Mix: FLEXIL, MICRO", "Novo desde ago/26" | Parado e comprando menos: as listas de Análises. Fora do ciclo: o cliente ativo com mais dias sem comprar que o ciclo dele, que não está parado nem em risco. Mix e novo: as listas de Análises | (foto: as análises e `cliente.ciclo_dias`) | navegador |
| Direção ("Receita") | Cor do círculo e variação na lista e na dica | O faturado em 12 meses dos clientes do município contra os 12 meses anteriores (o primeiro ponto de `evolucao_12m`), com 10% de folga: o percentual inteiro, o mesmo que a tela escreve | (foto: `cliente.evolucao_12m`) | navegador |
| Tempo sem contato ("Esquecidas") | Cor do município, lista e indicadores | Dias desde o último contato com o município: a compra mais recente de algum cliente dele ou a visita mais recente do login. Esquecida: mais de 90 dias, ou nenhum dos dois | (foto: `cliente.ultima_compra`; app.db: `visitas`) | navegador |
| Última visita (Mapa) | Coluna dos clientes em "Onde agir" e em "Esquecidas", e linha da dica do município | A visita mais recente do login ao cliente, ou a algum cliente do município | (app.db: `visitas`) | servidor; o município, navegador |
| Cidades sem cliente ("Onde crescer") | Indicador e a lista da região escolhida, das de maior PIB agro + indústria, com o PIB e os habitantes de cada uma | Os municípios da área sem cliente da carteira | (derivado) | navegador |

- **Por que a área (2026-10-15).**
  - Com a régua do estado inteiro, a região de São Paulo dominava o fictício: 20,7 milhões de habitantes e nenhum cliente.
  - A média do estado inteiro também diluía a régua com regiões que o representante não atende.
  - Na área, a régua é a média dele onde ele atua, e a região distante, sem cliente por perto, fica de fora.
- **Por que o PIB agro + indústria (2026-10-18).**
  - A população mede o tamanho da cidade, não o do mercado: a cidade grande com pouca lavoura e pouca fábrica pesava mais que a cidade agrícola menor.
  - O Lucas escolheu o valor adicionado da agropecuária e da indústria, do PIB dos Municípios do IBGE, no lugar da população.
  - Na cidade em que a atividade principal é usina ("Eletricidade e gás...") ou extração ("Indústrias extrativas"), conta só a agropecuária, porque essa indústria não compra o que a Suprens vende. São 210 municípios. Sem a regra, os R$ 11,5 bi de indústria de Foz do Iguaçu, quase toda da Itaipu, inflavam o potencial da região.
  - O ano é 2021, o último com os setores. A edição de 12/2025 do IBGE (base de 2010 a 2023) traz só o PIB total de 2022 e 2023, e revisou 2021: o mapa usa os números revisados desde 2026-10-19, a pedido do Lucas. No Paraná e em Goiás, o total não mudou. A maior mudança foi Congonhas (MG): a atividade principal passou de extração para indústria de transformação, e a indústria dela, R$ 5,1 bi, voltou a contar.
- **Com o PIB, nos códigos 1302 e 1109 (18/10; igual com os números revisados, em 19/10).** No Paraná, as maiores oportunidades são Guarapuava, Telêmaco Borba, Ponta Grossa e Paranaguá. São 21 regiões abaixo da média e 281 cidades sem cliente na área; as de maior PIB são Ortigueira e Tibagi.
- **Com os dados reais da Star Vendas (15/10, ainda pela população).**
  - Em Goiás, as 22 regiões estão na área, e Goiânia faz 88% da receita.
  - A maior oportunidade é Luziânia: 738 mil habitantes, 2 clientes e +R$ 448 mil por ano. Em seguida vem Águas Lindas de Goiás.
  - No estado sem faturado (MT, 1 cliente), a tela diz que não há média para medir, em vez de "todas na média".
- **Perto de mim (2026-10-18).** O botão pede a posição ao aparelho. O mapa vai para o estado e para a volta dela (150 km), com o ponto azul, e o cartão "Perto de você" lista as cidades com cliente nesse raio, da mais perto à mais longe, com o que pede ação em cada uma (paginas/mapa/PertoDeMim.tsx).
  - A posição fica só na memória da aba: não vai ao servidor, ao endereço da página nem ao armazenamento do navegador, e some ao recarregar. Sem a permissão, a tela diz como liberar.
  - As distâncias são em linha reta, pela mesma projeção dos arquivos do mapa (dominio/mapa.ts, `distanciaEmKm`, com teste).
- **Roteiro (2026-10-18; o cliente desde 2026-10-19).** A parada é um cliente, no endereço dele, ou uma cidade. O cliente entra pelo cartão do ponto no mapa ou pela ficha; a cidade, pelo "Perto de você" ou pela escolha do município. São até 10 paradas (o limite do link do Google Maps). O cartão "Roteiro" põe as cidades na ordem do vizinho mais perto, de onde o aparelho está ou da primeira escolhida, com os km em linha reta e o que pede ação em cada uma. O mapa numera as paradas e liga o caminho (dados/viagem.ts, com teste).
  - O roteiro fica só neste aparelho (localStorage, `crm:roteiro`): o código do município, dado público, e o id opaco do cliente, sem nome.
  - "Abrir no Google Maps" leva o endereço de cada cliente, público no CNPJ, e o nome de cada cidade, sem a origem: o Google parte de onde o aparelho estiver, e a posição não sai do CRM.
- **Só a carteira** (decidido em 2026-10-09, pergunta 34). Nada de outros representantes entra no mapa, nem para dizer que uma região já é atendida.
- **Visão do cliente** (plano.md:206). O faturado é o histórico dos clientes da carteira, de qualquer representante, como em Clientes.
- **Valores ocultos.** A dica, a lista, os indicadores e a legenda escrevem os valores pelo mesmo componente das outras telas, que obedece "Ocultar valores". Os nomes vêm da lista atual do IBGE, o que resolve os nomes antigos do protótipo.
- **Arquivos do mapa.**
  - `web/public/mapas/<UF>.json` leva:
    - cada município: o caminho SVG, a região imediata, a população, o PIB agro + indústria (`mercado`) e o centro;
    - cada região: o contorno, a caixa e as vizinhas;
    - o contorno do estado.
  - `brasil.json` traz o contorno de cada estado.
  - `cidades/<código>.json`, um por cidade com cliente (766 em 19/10, 17,5 MB; a tela baixa só a que aproxima, uns 85 KB comprimida a maior): o contorno, na qualidade intermediária do IBGE, e os bairros ou os distritos, em unidades de 5 m (dominio/mapa.ts, `projetarNaCidade`). 333 cidades têm bairros, 239 distritos e 194 só o contorno. Gerados por `npm run cidades --workspace extrator` (`extrator/src/mapas/gerarCidades.ts`, com as fontes no cabeçalho); rodam de novo quando entrar cliente em cidade nova.
  - O CNEFE fica na pasta de dados do extrator (`data/cnefe`, um zip por município com cliente, 1,4 GB em 19/10), e os pontos já buscados em `data/pontos-dos-enderecos.db`: a primeira busca levou 4 minutos; depois, só endereço novo ou mudado volta ao CNEFE. O município sem o zip aparece no resumo do extrator, para baixar.
  - A projeção é Mercator, em décimos de km. São 2,3 MB no total, mas a tela baixa só o Brasil e os estados da carteira.
  - Gerados por `npm run mapas --workspace extrator -- <pasta do IBGE> <população> <PIB agro + indústria> <pasta de saída>` (`extrator/src/mapas/gerarMapas.ts`, com as fontes e a regra da usina e da extração no cabeçalho). Os 5.570 municípios acharam a população do Censo e o PIB.
- **Na foto.** `cliente.municipio_ibge` (versão 9). Na Star Vendas, em 15/10: os 178 clientes com município, em 42 municípios. `cliente.endereco`, `bairro`, `cep`, `latitude`, `longitude` e `precisao_do_ponto` (versão 14), só da empresa.
- **Pendente.** A lista de Clientes ainda mostra o `CRCL.CIDADE`, cortado em 20 letras. Com o código confirmado, o nome pode vir do IBGE (pergunta 5).

## 11. Administração (feita em 2026-10-16)

Pedido do Lucas em 2026-10-16: gerenciar os acessos por uma tela, não por comandos, num lugar que só ele usa.

**Como funciona**
- É um site à parte, que nunca vai junto com o do CRM e nunca fica na internet.
  - Entrada em `web/admin`, telas em `web/src/admin`, montado por `web/vite.admin.config.ts` em `web/dist-admin`.
  - Neste computador: `abrir-administracao.bat`, ou `npm run dev:admin`, em http://localhost:5179. O .bat abre também o site do CRM, em http://localhost:5175, porque é lá que abre o link do convite.
- A API dela é um segundo ouvinte do servidor, em 127.0.0.1:5178 (`server/src/admin`).
  - Ela usa as mesmas regras de segurança da do CRM (`criarApi`, em app.ts).
  - Tem cookie próprio (`__Host-crm-admin`) e aceita só login de admin.
  - Convite, chave e sessão de admin não valem no CRM, e os do representante não valem nela. As rotas de um portal respondem 404 no outro.
- O primeiro admin nasce pela linha de comando, no servidor: `npm run admin -- criar-admin --nome "..."`. A tela não cria admin.
- A tela e a linha de comando fazem as mesmas ações, pelo mesmo módulo (`server/src/admin/gestao.ts`), e toda ação vai para a auditoria com quem fez.

| Dado | O que a tela mostra | Regra | Origem | Onde é calculado |
|---|---|---|---|---|
| Logins | Lista com a situação, os códigos, as chaves, o último acesso e o convite; números do alto: ativos, convites pendentes, chaves ativas, sessões abertas | Situação: ativo (chave que vale), convite pendente (sem chave, com convite valendo), sem acesso, desativado | app.db | servidor |
| Novo login e troca de códigos | Nome e os códigos marcados na lista de autorizados, com o faturado de cada código em 12 meses; o link do convite, para copiar | Os códigos vêm da tabela `representante` da foto; o que já está em outro login ativo aparece bloqueado. Faturado: a soma de `painel_mes` nos 12 meses fechados antes do mês da foto, pelas vendas atribuídas ao código (a conta do Início); em outubro de 2026, de out/25 a set/26 | (foto: representante, painel_mes) | servidor |
| Chaves | Provedor, sincronizada ou não, criada, último uso, bloqueada; "Bloquear" uma a uma | Uma chave sincronizada vale em todos os aparelhos da conta Google ou Apple | app.db | servidor |
| Convites | Gerado, situação (valendo, usado, venceu, trocado) e quando | 48 horas, uma vez só; o novo troca o anterior | app.db | servidor |
| Sessões | As últimas 20: aberta, último uso, chave e por que terminou | As regras da entrada: 60 minutos sem uso, 12 horas | app.db | servidor |
| Registro | Os eventos, de 100 em 100, com quem fez e o alvo pelo nome; por login no detalhe | O cliente da ficha consultada sai da foto pelo id | app.db e foto | servidor |
| Foto do ERP | A hora da foto, no alto | Tabela `foto` | foto | servidor |

- **Ações.**
  - Gerar convite novo: para o primeiro acesso ou para um aparelho novo.
  - Trocar os códigos: a sessão aberta do representante já vê os novos.
  - Encerrar as sessões: as chaves continuam valendo, e a entrada explica "o administrador encerrou a sua sessão".
  - Bloquear todas as chaves ou só uma, como a do aparelho perdido.
  - Desativar o login: os códigos ficam livres para outro login.
  - As ações que tiram o acesso pedem confirmação. O admin não age no próprio login pela tela, para não se trancar para fora.
- **Exceção à regra 4 do CLAUDE.md (decidida em 2026-10-13).** As rotas que ligam códigos a um login (criar o login e trocar os códigos) são as únicas que recebem do navegador o código do representante. Elas só existem na API da administração, conferem o código contra a tabela `representante` da foto e gravam auditoria.
- **Lista dos representantes autorizados.** É a tabela `representante` da foto, que o extrator monta a partir de `data/representantes-autorizados.txt`.
- **Dados comerciais: só o faturado de cada código.** Não há perfil "vê tudo" (plano.md:23). A administração mostra nomes de login, códigos, chaves e o registro. O único número de venda é o faturado de cada código em 12 meses, na escolha de códigos, que o Lucas pediu em 2026-10-17 para montar os logins.
- **Na produção, proposta a confirmar com o Lucas.** A administração fica só no servidor, em 127.0.0.1, e o Lucas a abre por um túnel SSH até ele, em http://localhost:5179.
  - Não é preciso porta nova nem certificado: o firewall já só deixa o SSH vir do IP dele.
  - A chave de acesso aceita "localhost" sem https.
  - A alternativa do plano é um vhost só da rede interna, com https.
- **Conferido em 2026-10-16** com 20 testes da API e de ponta a ponta no Chrome, com o autenticador virtual:
  - o admin cria a chave pelo convite, cria o login de um representante e copia o link;
  - o representante cria a chave e entra no CRM;
  - a administração mostra o login ativo; bloquear as chaves derruba a sessão do CRM, com o motivo;
  - o registro mostra tudo com nomes;
  - as quatro telas cabem no celular, sem rolagem para o lado.
- **Conferido em 2026-10-17**, com os 22 representantes ativos da foto real:
  - a coluna do faturado fica alinhada ao título no Novo login e na troca de códigos, no desktop e no celular;
  - no celular, o nome desce para a segunda linha, e nenhum é cortado;
  - a busca da lista, que só aparece com mais de 8 códigos, tem a altura certa (antes saía com 240 px).

## Esquema proposto da foto

Convenções:
- **Datas:** texto ISO ('AAAA-MM-DD'), meses 'AAAA-MM' e momentos 'AAAA-MM-DDTHH:MM', todos gerados por `TO_CHAR` no Oracle (plano.md:67).
- **Cliente:** `cliente` é sempre o id opaco. `CRCL.CLIENTE` só aparece em `cliente.codigo_erp`, e só de empresa. O histórico de vendedores não aparece em nenhuma tabela.
- **Produto:** sempre o código com TRIM (`TRIM(NFDE.C_PROD)`, `TRIM(VIEW_PAC)`, `TRIM(PAC_COD)`, `TRIM(ESTQ.C_PROD)`). `NFDE.C_PROD` é CHAR(14) (omega/ABC71-NF.md:2833). Sem TRIM, a junção do "já comprou" falha. O Gestao lê `TRIM(D.C_PROD)` (moduloVendasEntradas.ts:48), e o SGI liga a view ao ESTQ com TRIM nos dois lados (`untVenPvd_PosPac.dfm:551-552`).
- **Escopo:** toda leitura do servidor parte de `cliente.representante`, `painel_mes.representante`, `pedido_aberto.representante` ou `nota.representante`, entre os códigos do login da sessão. Tabela sem a coluna `representante` só é lida por junção com `cliente` ou, nos itens, com o pedido ou a nota de onde vêm (`pedido_aberto_item` com `pedido_aberto`, `nota_item` com `nota`). O nome do cliente de um pedido ou de uma nota vem só de `cliente` com um dos códigos da sessão.
- **Pedido CRM:** `pedido_crm` e `pedido_crm_etapa` não têm cliente nem representante. O servidor só os lê pelo `numero_crm` de um pedido do usuário da sessão no app.db. Número CRM de outro login, ou inexistente, responde 404 (plano.md:43). Como o número é sequencial (CRM-00106, CRM-00107…), a rota `/pedidos/:numero` (App.tsx:28) entra no teste de escopo da F3.
- **Valores:** R$ com centavos. O arredondamento é da tela.

| Tabela | Grão e chave | Colunas | Telas |
|---|---|---|---|
| `foto` | Uma linha | `versao_esquema`, `gerada_em`, `data_ref`, `mes_atual`, `dia_util`, `dias_uteis`, `semestre_inicio`, `semestre_fim` | todas, Admin |
| `representante` | Representante autorizado; PK `codigo` | `codigo`, `nome` (o da CRVN, para o Admin escolher os códigos) | Admin |
| `cliente` | Cliente (filial) da carteira de um autorizado, e o grupo do SGI com dois ou mais CNPJs no mesmo código; PK `cliente` | `cliente`, `codigo_erp` (nulo na pessoa física e no grupo), `representante`, `nome`, `razao_social`, `cidade`, `uf`, `mercado`, `situacao`, `status`, `ultima_compra`, `cliente_desde`, `ciclo_dias`, `faturamento_12m`, `variacao_12m`, `evolucao_12m`, `grupo_mix`, `tabela_preco`, `municipio_ibge` (código IBGE do município, para o Mapa), `endereco`, `bairro`, `cep`, `latitude`, `longitude`, `precisao_do_ponto` (só da empresa), `queda_no_semestre`, `grupo`, `cnpjs` | Clientes, Ficha, Análises, Início, Pedidos, Montar pedido, Detalhe |
| `cliente_mes` | Cliente × mês (60 fechados + o corrente: a tendência soma os 12 meses até cada um dos últimos 48); PK (`cliente`, `mes`) | `cliente`, `mes`, `valor` | Ficha |
| `cliente_familia` | Cliente × família nos 12 meses fechados; PK (`cliente`, `familia`) | `cliente`, `familia`, `valor`, `participacao`, `pecas` (versão 11) | Ficha |
| `ficha_produto` | Cliente × produto, só os 8 maiores em valor nos 12 meses fechados; PK (`cliente`, `produto`) | `cliente`, `produto`, `pecas_12m`, `valor_12m`, `ultima_compra` | Ficha |
| `cliente_mix` | Cliente × família sugerida; PK (`cliente`, `familia`) | `cliente`, `familia`, `penetracao`, `ordem` | Ficha, Análises |
| `produto` | Produto que aparece em `lista_de_precos`, `ficha_produto`, `pedido_aberto_item` ou `nota_item`; PK `produto` | `produto`, `familia`, `medida`, `embalagem` | Ficha, Pedidos, Montar pedido, Detalhe (cópia no envio) |
| `lista_de_precos` | Lista × produto vendável: clientes com a mesma tabela e os mesmos descontos dividem uma lista; PK (`lista`, `produto`) | `lista`, `produto`, `preco_cento`, `part_number` | Montar pedido; validação do rascunho e do envio |
| `produto_comprado` | Cliente × produto da lista dele comprado nos últimos 24 meses; PK (`cliente`, `produto`) | `cliente`, `produto` | Montar pedido |
| `analise_parado` | Cliente que parou de comprar; PK `cliente` | `cliente`, `perda_mensal`, `ordem` | Análises, Início |
| `analise_ritmo` | Cliente comprando menos ou mais; PK `cliente` | `cliente`, `direcao`, `semestre`, `semestre_ano_anterior`, `variacao`, `variacao_pecas`, `ordem` | Análises, Início |
| `analise_novo` | Cliente novo ou reativado; PK `cliente` | `cliente`, `tipo`, `desde`, `faturado_desde`, `ordem` | Análises, Início |
| `analise_mix` | Cliente da lista de mix; PK `cliente` | `cliente`, `ordem` | Análises |
| `painel_mes` | Representante × mês do ano corrente; PK (`representante`, `mes`) | `representante`, `mes`, `faturado`, `ano_anterior`, `ano_anterior_ate_dia_util`, `ritmo_por_dia_util` | Início |
| `painel_historico` | Representante × mês fechado, os 60 dos meses da ficha (versão 15, 2026-10-19); PK (`representante`, `mes`) | `representante`, `mes`, `faturado` | Início (Tendência) |
| `pedido_aberto` | Pedido do Omega com saldo, atribuído a um representante autorizado; PK `pedido` | `pedido`, `representante`, `cliente`, `emissao`, `entrega`, `itens`, `valor`, `valor_entrega_no_mes` | Pedidos, Ficha, Início |
| `pedido_aberto_item` | Item com saldo de um pedido de `pedido_aberto`, na ordem do pedido; PK (`pedido`, `ordem`) | `pedido`, `ordem`, `produto`, `pecas`, `entrega`, `valor` | Pedidos |
| `pedido_faturado` | Pedido do Omega sem saldo, com nota de venda nos 12 meses fechados e no corrente, de cliente da carteira de um autorizado; PK `pedido` | `pedido`, `representante`, `cliente`, `emissao`, `faturado_em`, `itens`, `valor` | Ficha |
| `pedido_faturado_item` | Produto de um pedido de `pedido_faturado`, um por produto, na ordem em que foi faturado; PK (`pedido`, `ordem`) | `pedido`, `ordem`, `produto`, `pecas`, `valor` | Ficha |
| `nota` | Nota de venda da janela da aba Faturados (45 dias, a confirmar), atribuída a um representante autorizado (pergunta 23); uma linha por nota; PK (`nota`, `serie`) | `nota`, `serie`, `representante`, `cliente`, `emissao`, `valor`, `pedidos` | Pedidos |
| `nota_item` | Item de uma nota de `nota`, na ordem da nota; PK (`nota`, `serie`, `ordem`) | `nota`, `serie`, `ordem`, `produto`, `pecas`, `valor` | Pedidos |
| `pedido_crm` | Pedido enviado pelo CRM que a LAN já tratou; PK `numero_crm` | `numero_crm`, `etapa`, `numero_sgi`, `total_sgi`, `motivo_recusa`, `motivo_produto` | Pedidos, Detalhe |
| `pedido_crm_etapa` | Pedido CRM × etapa alcançada; PK (`numero_crm`, `etapa`) | `numero_crm`, `etapa`, `em` | Detalhe |

Colunas que pedem nota:
- `cliente.evolucao_12m`: texto JSON com 13 números, do mais antigo ao mais recente.
- `cliente.endereco`, `bairro` e `cep` (versão 14, 2026-10-19): só da empresa, que tem o endereço público no CNPJ; na pessoa física e no grupo, nulos (CLAUDE.md, regra 3). `latitude` e `longitude` são do CNEFE do IBGE, e `precisao_do_ponto` diz se o ponto está no número, na rua ou no meio do CEP (dominio/tipos.ts, `PrecisaoDoPonto`); sem ponto, os três ficam nulos.
- `cliente_mes` (versão 13, 2026-10-18): a versão 12 levou as peças de cada mês, para um modelo da tendência que o Lucas não escolheu, e a 13 as tirou. As duas vistas que ficaram usam só o valor.
- `cliente.grupo` e `cliente.cnpjs` (versão 10, 2026-10-17): no CNPJ de um grupo, `grupo` é o id da linha do grupo; na linha do grupo, `cnpjs` diz quantos CNPJs ele tem. A linha do grupo não tem cidade, município, código do ERP nem tabela de preço, e o id dela é um HMAC do código do representante e do nome do grupo, estável entre fotos. As listas das análises (`analise_*`) têm o grupo no lugar dos CNPJs; a ficha (`cliente_mes`, `cliente_familia`, `ficha_produto`, `cliente_mix`) existe para os dois.
- `cliente.queda_no_semestre` (versão 10): a variação do semestre do cliente em risco. Antes, o servidor a tirava de `analise_ritmo`, que não tem mais o CNPJ de um grupo.
- `cliente.grupo_mix`: 'pequeno', 'medio' ou 'grande'. 'mercado' quando a comparação usou o mercado inteiro. Nulo quando nem o mercado tem 20 clientes.
- `cliente.situacao`, `ciclo_dias` e `variacao_12m`: nulos conforme as regras de Análises e Clientes.
- `cliente.status`: o status do cadastro do SGI, 'ativo', 'inativo' ou 'substituido'. Até a versão 5, a foto levava só a marca de fora de ativo (`negativo`); desde 2026-10-15, a coluna Status mostra o status de todo cliente.
- `cliente.cliente_desde`: só o ano (inteiro), que é o que a Ficha mostra (`FichaCliente.clienteDesde`). A data completa fica na LAN. Nulo quando o cliente nunca comprou, e então o cartão "Cliente desde" mostra "—".
- `cliente.uf`: `ESTADO`. Para o cliente do exterior, "EX", até a pergunta 5 decidir sobre o país.
- `cliente.tabela_preco` e `cliente.lista_de_precos`: o nome da tabela escolhida (`TP1_NOM`, ou `TP1_COD` na falta) e a lista dela. Nulos no cliente sem tabela usável, que fica sem catálogo.
- `ficha_produto`: o extrator já faz o corte dos 8. Peças, valor e última compra dos outros produtos não aparecem em nenhuma tela e ficam na LAN.
- `produto_comprado`: só os produtos da lista do cliente, na janela da pergunta 28. É o que o Montar pedido usa (`ProdutoDoCatalogo.jaComprou`, tipos.ts:246; MontarPedido.tsx:228).
- `produto.embalagem` e `produto.medida`: só nos produtos de alguma lista. A embalagem é por produto (`EAN_QTD`), e não por tabela: o `TP2_MVE` vem vazio.
- `painel_mes.faturado`: nulo nos meses que ainda não chegaram. `ano_anterior_ate_dia_util` e `ritmo_por_dia_util` (faturado por dia útil nos 6 meses fechados, base da projeção) só têm valor no mês corrente.
- `pedido_aberto.representante`: atribuído na LAN, `VEPM.VENDEDOR` ou, se vier nulo ou 0, o `VEND_1` atual do cliente. `VEPM.VENDEDOR` não vai para a foto.
- `nota.representante`: atribuído na LAN pela regra do faturamento (plano.md:219). `NFME.VENDEDOR` e o CRCLH não vão para a foto.
- `pedido_aberto.cliente` e `nota.cliente`: o id opaco quando o cliente é da carteira do representante atribuído; nulo nos outros casos, com a conta na LAN. A linha com cliente nulo mostra "Cliente de outra carteira" (proposta, pergunta 33).
- `pedido_aberto.pedido`: o número do Omega. Se houver mais de uma EMP_FIL com pedidos, a chave inclui a empresa.
- `pedido_aberto.valor_entrega_no_mes`: parte do valor com entrega até o fim do mês corrente, inclusive os vencidos.
- `pedido_faturado` (2026-10-15): o cliente, o representante e a emissão são os do pedido (VEPM); o valor (RF), os produtos (`itens`) e a última nota (`faturado_em`), os das notas do pedido no período. Ficam de fora o pedido que ainda tem saldo, de qualquer representante (ele é o `pedido_aberto`), o de cliente fora da carteira dos autorizados e a nota sem pedido no VEPM. Em 15/10, a Star Vendas tinha 567 pedidos de 123 clientes, um por nota, todos sem saldo; somam R$ 6.299.427,19, o mesmo que o faturado dos clientes no período. Na Suprens inteira, eram 14.058 pedidos com nota no período.
- `pedido_faturado_item` (2026-10-15): as linhas das notas do pedido no período, com o mesmo produto somado num item só, na posição da primeira vez (extrator/src/calculo/pedidos.ts). Em 15/10, 9.780 itens nos 567 pedidos da Star Vendas, com a mesma soma dos pedidos.
- `pedido_aberto_item`: uma linha por item do VEPD com saldo. `pecas` é o saldo em peças (CT ×100), `valor` é a conta de "Valor em aberto" (ver Pedidos) e `entrega` é a do item. `ordem` é a posição no pedido, pela `VEPD.SEQUENCIA`: o mesmo produto pode vir em duas linhas, com entregas diferentes. A soma dos itens é o `valor` do pedido, a contagem é `itens`, e a menor entrega é a `entrega` dele (extrator/src/calculo/pedidos.ts).
- `nota_item`: uma linha por item do NFDE, com as peças (CT ×100) e o valor da RF. `ordem` é a posição na nota, por tipo de movimento e `LINHA`. A soma dos itens é o `valor` da nota.
- `nota.pedidos`: lista em JSON dos `NFME.NRO_PEDIDO` da nota, sem repetir e sem o 0, como a Consulta Pedidos Venda do SGI liga a nota ao pedido (ver Detalhe do pedido).
- `nota`: o valor soma todas as linhas NFME/NFDE da nota, inclusive de tipos de movimento diferentes. Nenhuma tela mostra `serie`: ela serve só de chave. Se houver mais de uma EMP_FIL com notas de venda, a chave inclui a empresa.
- `pedido_crm`: não tem representante. O dono vem do app.db, pelo número CRM.
- `pedido_crm.numero_sgi`: serve também como número no ERP (ver Perguntas).
- `pedido_crm.motivo_recusa`: código da lista fechada. A frase vem de uma tabela fixa do servidor.
- `pedido_crm.motivo_produto`: código do produto, só na recusa por item. É o único parâmetro da frase.
- `produto.familia`, `cliente_familia.familia` e `cliente_mix.familia`: o mesmo nome (`GRP_DES`).

O que o servidor calcula sobre a foto (leituras com escopo e somas simples):
- junção de rascunhos e pedidos enviados com `cliente`, para nome e cidade; e de `pedido_aberto` e `nota` com `cliente` do representante da sessão, só para o nome;
- no Início:
  - faturado do mês (linha do mês corrente de `painel_mes`);
  - acumulado e acumulado do ano anterior;
  - pedidos em aberto: contagem e soma de `pedido_aberto` do representante da sessão;
  - a faturar no mês, soma de `valor_entrega_no_mes` dos mesmos pedidos, que também vai para a barra do mês corrente no gráfico;
  - destaques: contagem, soma e os 5 primeiros de cada lista;
- a ordem das listas que a tela mostra como recebe:
  - clientes do Montar pedido por `faturamento_12m` decrescente (MontarPedido.tsx:396-420);
  - famílias da Ficha por valor decrescente (FichaCliente.tsx:82-86);
  - famílias sugeridas do mix pela coluna `ordem` de `cliente_mix` (FichaCliente.tsx:205-214);
  - os 5 primeiros de cada cartão do Início, na ordem da análise (Inicio.tsx:47 e 67);
- as demais tabelas o navegador ordena pelo título das colunas, com a ordem de abertura na própria tela (Clientes.tsx:45 e 58; Analises.tsx:94, 136, 164 e 203; Pedidos.tsx:132, 162, 208 e 230; FichaCliente.tsx:235-238 e 289). Empate mantém a ordem recebida (componentes/ordenacao.ts:22-23).
- total estimado do rascunho, na leitura; e o do envio, que fica congelado no app.db.

A `lista_de_precos` é a maior tabela da foto. Medido em 14/10, na Star Vendas: 33.626 linhas (50 listas), contra os 122.142 pares de cliente e produto que um catálogo por cliente teria; a foto foi de 0,8 MB para 2,8 MB.

## O que fica no app.db

As seis primeiras tabelas existem desde a F3 (`server/src/bancoDoApp.ts`, migração 1). Rascunhos e pedidos chegam na F5.

| Tabela | O que guarda | Telas |
|---|---|---|
| `usuarios` | id, nome do login, ativo, identificador WebAuthn aleatório, criado em. O papel de admin entra com a API de admin | todas, Admin |
| `usuario_codigos` | usuário, código do representante, ligado em, ligado por; um login tem um ou mais códigos, e um código fica em um login ativo só | todas, Admin |
| `chaves` | id da credencial, usuário, chave pública, contador, transportes, AAGUID e provedor, sincronizada, criada em, último uso, revogada em | Entrar, Convite, Montar pedido, Admin |
| `convites` | hash do token, usuário, criado por, criado em, expira em, usado em, trocado em | Convite, Admin |
| `sessoes` | hash do token, usuário, chave usada, criada em, último uso, encerrada em e motivo | todas, Entrar |
| `auditoria` | momento, usuário (ou "linha-de-comando"), evento, alvo, resultado | Admin |
| `visitas` (migração 3, 2026-10-18) | usuário, cliente (id opaco), dia da visita, registrada em; um dia por cliente e login, sem texto livre | Ficha, Mapa |
| `rascunhos` e itens | id aleatório, usuário, cliente (id opaco), entrega, observação, atualizado em; itens com produto e quantidade em peças | Pedidos, Montar pedido |
| `pedidos` e itens | número CRM, usuário, cliente, enviado em, entrega, observação, total estimado, hash do conteúdo, asserção da chave e id da chave; itens com produto, quantidade, cento, família e medida copiados da foto | Pedidos, Detalhe |
| sequência do número CRM | último número usado; nunca reutilizado | Pedidos |

- **Sessão** (plano.md:142-146): cookie `__Host-`, token de 256 bits, só o hash no banco.
- **Envio idempotente:** o mesmo rascunho não gera dois números CRM.
- **Visitas (2026-10-18).** O representante marca o dia em que visitou o cliente: hoje, pelo relógio de Brasília do servidor, ou até 30 dias para trás; nunca no futuro. Só no cliente sozinho ou no CNPJ de um grupo da carteira do login; no grupo em si e fora da carteira, 404, como a ficha (`server/src/visitas.ts`, `POST` e `DELETE /api/clientes/:codigo/visitas`, `GET /api/visitas`). Marcar e desfazer entram na auditoria com o id do cliente. Cada login vê só as próprias visitas.
- **O que sai para a LAN** (`saida/pedidos`): número CRM, os códigos do login no envio, id do cliente, itens (produto e peças), entrega, observação, hash e assinatura. A LAN converte o id para `CRCL.CLIENTE` e as peças para CT, confere que o `VEND_1` do cliente está entre os códigos e usa esse código no pedido do SGI.
- **Auditoria.** O alvo é o código opaco do cliente ou o número CRM, nunca o nome nem o corpo da requisição. Guardada por 6 a 12 meses (plano.md:155). Gravar o IP fica a decidir.
- **O que nunca entra no app.db:** `CRCL.CLIENTE` nem nome de cliente. O nome sempre vem da foto na leitura.
- **Backup.** O app.db vai para o backup diário (plano.md:81) e carrega dado pessoal: auditoria e observação dos pedidos, que é texto livre.

## Tabelas do ERP que o extrator lê

É a lista do que a conta própria do extrator lê, pelas views que o DBA cria no esquema do CRM antes do piloto da F4 (plano.md:57 e 322).

- Na F2, o extrator usa o `LUCAS_RO` (plano.md:58-62). Desde 2026-10-09 ele tem `READ ANY TABLE` e lê todos os objetos abaixo, inclusive a view de preço líquido, sem grant novo (plano.md:322; OracleDB/docs/lacunas.md:7).
- A conta do extrator não ganha `READ ANY TABLE` nem SELECT nas tabelas e views do ABC71 (plano.md:322).
- O SQL do extrator lê só as colunas listadas.
- O Oracle não concede SELECT por coluna: o GRANT só aceita lista de colunas em INSERT, UPDATE e REFERENCES. Com SELECT na tabela, a conta do extrator leria também `CRCL.CGC_CPF`, os telefones, `CLI3_RFI`, `VEPM.NRO_CARTAO` e o resto de "O que nunca entra na foto".
- Decidido em 2026-10-09 (pergunta 42): o DBA cria, num esquema do CRM, uma view por objeto desta lista só com as colunas listadas, e concede à conta do extrator SELECT só nessas views. A coluna marcada "só se" entra na view quando a pergunta dela fechar.
  - O esquema do CRM é o dono das views e não tem login (conta bloqueada).
  - Ele recebe do ABC71 SELECT WITH GRANT OPTION, por grant direto, em cada objeto desta lista. Sem isso, o GRANT na view para a conta do extrator falha (ORA-01720).

As citações do catálogo são relativas a `OracleDB/catalogo/`. As do SGI são relativas a `SGI12CodigoFonte/Vendas {VEN}/Pedido Venda V2 {PVD}/`, salvo quando o caminho vem completo. "Não" em Confirmada quer dizer que o objeto está fora do catálogo e que as colunas vêm do fonte do SGI. Elas precisam ser conferidas em `DBA_VIEWS`, que o `LUCAS_RO` lê desde 2026-10-09 (OracleDB/docs/lacunas.md:7).

**Omega**

| Tabela | Colunas | Para quê | Citação | Confirmada |
|---|---|---|---|---|
| `ABC71.CRCL` | EMP_FIL, CLIENTE, TIPO_CAD, NOM_FANTAS, RAZ_SOCIAL, COMPLEM_RZ, CIDADE, ESTADO, TIPO_CLI, FIS_JURID, VEND_1, RESERVADO7 (código IBGE do município); ENDERECO, BAIRRO e CEP só com FIS_JURID = 'J' (o SELECT devolve nulo na pessoa física); COD_PAIS só se a pergunta 5 decidir mostrar o país | Identidade, mercado, carteira, raiz para os grupos (calculada na LAN), nome da cidade, município e endereço da empresa | omega/ABC71-CR.md:965-1141 (PK 973; 981-988, 995-996, 1005, 1019, 1052, 1079, 1088); OracleDB/docs/licoes.md:97-101 | sim |
| `ABC71.CRCLH` | EMP_FIL, CLIENTE, SEQ_HIST, DT_HIST, CAMPO, HISTORICO | Dono do cliente na data da nota sem vendedor. Só na LAN | omega/ABC71-CR.md:1279-1300; pista em CRM-prototipo/server/src/repHistorico.ts:7-41 | sim; formato de HISTORICO a confirmar |
| `ABC71.CRVN` | EMP_FIL, VENDEDOR, NOME, NOME_CONH | Nome do representante, com `EMP_FIL = 20210001` | omega/ABC71-CR.md:5467-5488; untDmVenPvd.dfm:499-503 e 4976-5006 | sim |
| `ABC71.NFME` | EMP_FIL, N_FISCAL, SERIE, FORNEC, TIPO_MOVTO, ID_CANCEL, DT_EMISSAO, VENDEDOR, NRO_PEDIDO | Cabeçalho da nota: cliente, data, cancelamento, vendedor (atribuição), número da NF e pedido da nota (pedido de origem na aba Faturados e datas de faturado do pedido CRM) | omega/ABC71-NF.md:6647-6739 (PK 6655; 6663-6667, 6674, 6678, 6694, 6739); Gestao/server/src/producao/foto/moduloVendasEntradas.ts:13 e 32-43; `Vendas {VEN}/Consulta Pedidos Venda {CONPVE}/untDmVenConPve_ConPve.dfm:527-528 e 1257-1261` | sim |
| `ABC71.NFDE` | EMP_FIL, N_FISCAL, SERIE, FORNEC, TIPO_MOVTO, LINHA, C_PROD, UNIDADE, QTDE, VLR_TOTAL, Z_FRANCA_DESC | Valor, peças e produto de cada item, inclusive os itens da nota na aba Faturados | omega/ABC71-NF.md:2804-2884 (PK 2812; 2833, 2836, 2840, 2849, 2884); Gestao/server/src/producao/foto/moduloVendasClientes.ts:25-36 | sim |
| `ABC71.ESTQ` | C_PROD, GRUPO, QT_ALT_OBR | Produto ativo no Omega; família pela regra do Gestao (conferência). O PA tem uma linha por C_PROD (produto-acabado.md:9), apesar da PK com EMP_FIL, ESTAB e DEPOSITO | omega/ABC71-ES.md:335-378 (PK 343; 354, 355, 378); untVenPvd_PosPac.dfm:555-557 | sim |
| `ABC71.VEPM` | EMP_FIL, NUMERO, CLIENTE, DT_PED, BLOQUEADO, DT_ENTREGA, Z_FRANCA_DESC, VENDEDOR; LIVRE só se a ligação pelo número CRM se confirmar | Pedido em aberto e sua atribuição ao representante (conta na LAN); cliente, representante e emissão do pedido faturado da Ficha; etapa "no ERP", alíquota da Zona Franca no tipo 315 | omega/ABC71-VE.md:8041-8138 (PK 8049; 8057-8060, 8076, 8083, 8097, 8137, 8138); Gestao/server/src/pcp/emAberto.ts:58-72; SGI12CodigoFonte/Recebimento {REC}/Carga Pedido Venda e NF {CPV}/untDmRecCpv_Cpv.dfm:915-931 | sim; LIVRE a confirmar |
| `ABC71.VEPD` | EMP_FIL, NUMERO, SEQUENCIA, C_PROD, UNIDADE, TIPO_MOVTO, DT_ENTREGA, SALDO, VLR_UNIT, PORC_DESC, PORC_DESC2, PORC_DESC_CPAG, PORC_DESC_CLI | Saldo, entrega, contagem de itens e valor em aberto, e os itens com saldo que a aba Em aberto mostra | omega/ABC71-VE.md:6774-6868 (PK 6782; 6790-6792, 6797, 6799, 6808, 6812-6813, 6866-6868); Gestao/server/src/pcp/emAberto.ts:58-72 | sim |
| `ABC71.VEPM_SGI5_LOG` | LOG_NPE, LOG_DTA | Data do cancelamento (candidata) | omega/ABC71-VE.md:8417-8436 | sim; uso a confirmar |
| `ABC71.TGPA` | EMPRESA, FILIAL, COD_PAIS, NOME_PAIS, só se a pergunta 5 decidir mostrar o país | Nome do país do cliente do exterior | omega/ABC71-TG.md:437-455 | sim; uso a confirmar |

**SGI**

| Tabela | Colunas | Para quê | Citação | Confirmada |
|---|---|---|---|---|
| `ABC71.SGI5_TAB_FIN_VEN` | FIN_VEN, FIN_TIP, FIN_STA | Representante ativo: quem entra na foto e revalidação na LAN | sgi/ABC71-SGI5-TAB_FIN.md:826-843; SGI12CodigoFonte/Financeiro {FIN}/Vendedores {VEN}/untFinVen_VenMov.dfm:563-578 | sim |
| `ABC71.SGI5_TAB_VEN_CLI3` | CLI3_CLI, CLI3_STA; CLI3_GRP só se servir para grupos. `CLI3_RFI` não é lido (pergunta 16) | Status cadastral (carteira, aceite de pedido, revalidação na LAN, bloqueio de montadora): `NVL(CLI3_STA,'ATIVO')`, como o SGI (decidido em 2026-10-09), por LEFT JOIN em `CLI3_CLI = CRCL.CLIENTE`; cliente sem linha conta como ativo | sgi/ABC71-SGI5-TAB_VEN.md:162-198 (STA 188; GRP 198); untDmVenPvd.dfm:2572-2573 e 2657-2658; untVenPvd_PvdIncluir.pas:1007-1008 | sim |
| `ABC71.SGI5_TAB_VEN_CLI` | CLI_COD, CLI_TAB, CLI_STA | Tabela de preço do cliente | sgi/ABC71-SGI5-TAB_VEN.md:61-92 (PK 69; 77, 78, 91); untDmVenPvd.dfm:2642-2673 | sim |
| `ABC71.SGI5_TAB_VEN_TP1` | TP1_COD, TP1_NOM, TP1_STA, TP1_MOE | Nome, tabela obsoleta e moeda | sgi/ABC71-SGI5-TAB_VEN.md:2687-2719 (2702, 2703, 2715, 2719) | sim |
| `ABC71.SGI5_VIEW_VEN_TP2_VLR_LIQ_CLI` | VIEW_CLI, VIEW_TAB, VIEW_PAC, VIEW_PNU_FOR, VIEW_STA, VIEW_VLR_LIQ | Preço do cento (a tabela com o desconto do modelo ou o padrão; texto lido em DBA_VIEWS em 2026-10-14), part number e filtro de vendável. A view junta `SGI5_TAB_VEN_CLI`, `TP2`, `CLI2` (desconto por modelo), `DES` (índice do desconto), `ENG_PAC`, `CRCL` e `ESTQ`: a conta do extrator precisa de SELECT nela e no que ela lê | untVenPvd_PosPac.dfm:443-557; untDmVenPvd.dfm:3080-3114 e 6440-6458; Relatorios {REL}/untVenRel_RelTabelaPrecoLiquido.dfm:614 e 668; plano.md:322 | sim, em 2026-10-14 |
| `ABC71.SGI5_VIEW_ENG_PAC_SEM_ARVORE` | VIEW_PAC | Tirar do catálogo, e recusar na LAN, o produto sem árvore | untDmVenPvd.dfm:3249-3251; untVenPvd_PvdIncluirItens.pas:432-443; OracleDB/docs/modulos/pedidos-venda.md:47 | não (fora do catálogo); colunas do fonte do SGI, a confirmar na F2 em DBA_VIEWS |
| `ABC71.SGI5_TAB_ENG_PAC` | PAC_COD, PAC_GRC, PAC_DMI_MM, PAC_DMA_MM | Família (grupo de custo) e medida | sgi/ABC71-SGI5-TAB_ENG.md:3346-3383 (PK 3354; 3363, 3377, 3382, 3383); OracleDB/docs/modulos/familias.md:15 | sim; medida conferida em 2026-10-14 (470 dos 692 produtos do catálogo têm as duas pontas) |
| `ABC71.SGI5_TAB_CUS_V3_GRP` | GRP_GRP, GRP_DES, GRP_NIV | Nome da família (nível 2) | sgi/ABC71-SGI5-TAB_CUS.md:1357-1375; OracleDB/docs/modulos/familias.md:9-34 | sim |
| `ABC71.SGI5_TAB_DP_CALEND` | não é lido desde 2026-10-14 | Era o calendário dos dias úteis; o CRM usa o calendário padrão até ter o personalizado | sgi/ABC71-SGI5-TAB_DP.md:72-90; SGI12CodigoFonte/Aplicativo/untFunMat.pas:636-679 | sim |
| `ABC71.SGI5_TAB_VEN_PV1_V2` | PV1_NPE, PV1_DCA, PV1_STA, PV1_LR1, PV1_DLB_CTR, PV1_DLB_VD1, PV1_DLB_CON, PV1_DLB_CRE, PV1_DLB_VD2, PV1_DLB_BPV, PV1_DCO, PV1_DUA; PV1_CLI só se o pedido do SGI ainda não exportado impedir "parado" | Etapas e datas do pedido CRM; as datas de liberação conferem a de aprovado | sgi/ABC71-SGI5-TAB_VEN.md:1379-1441 (PK 1387; 1394-1396, 1404, 1421, 1425-1433, 1435, 1438, 1441); OracleDB/docs/modulos/pedidos-venda.md:9-19 | sim; LR1 como número CRM a confirmar |
| `ABC71.SGI5_TAB_VEN_PV2_V2` | PV2_NPE, PV2_QTD, PV2_VLR_VEN | Total no SGI, sem IPI | sgi/ABC71-SGI5-TAB_VEN.md:1748-1779 (1764, 1774, 1779); untDmVenPvd.dfm:111-140 | sim |
| `ABC71.SGI5_VIEW_VEPM_STA_FAT` | VIEW_NPE, VIEW_STA_FAT | Faturado parcial e faturado | untDmVenPvd.dfm:448-449 e 535-536; untVenPvd_Pvd.dfm:374-379; fora do catálogo (OracleDB/docs/lacunas.md:28) | não (fora do catálogo); colunas do fonte do SGI, a confirmar na F2 em DBA_VIEWS |
| `ABC71.SGI5_TAB_ENG_EAN` | EAN_COD, EAN_QTD | Embalagem do produto, em peças: em 14/10, um EAN por produto do catálogo | sgi/ABC71-SGI5-TAB_ENG.md:1276-1297 (PK 1284; 1293, 1295, 1297) | sim; `EAN_PPR` vem nulo e não é lido |
| `ABC71.SGI5_TAB_ENG_TR1` | não é lido | Era candidata à embalagem para montadora; o EAN cobre o catálogo (2026-10-14) | sgi/ABC71-SGI5-TAB_ENG.md:5321-5352 (5337, 5338, 5352); untVenPvd_PosPac.dfm:522-525 | sim |
| `ABC71.SGI5_VIEW_DIR_CME_DIA_ULT_COT` | VIEW_MOE, VIEW_CAM, VIEW_DCO | Câmbio do dia, só se tabelas fora de REAL entrarem no CRM | untDmVenPvd.dfm:2586-2589 e 2675; untVenPvd_ItensMov.pas:145-158 | não (fora do catálogo); colunas do fonte do SGI, a confirmar na F2 em DBA_VIEWS |

**Só para conferência na F2** (com o `LUCAS_RO`, sem grant para o extrator)

| Objeto | Colunas | Para quê | Citação |
|---|---|---|---|
| `ABC71.SGI5_TAB_CUS_REP_FAT` | CUS_CLI, CUS_DFA, CUS_TMO, CUS_QTF, CUS_VLF, CUS_VEN, CUS_CLI_MER | Totais do RELCUS001, inclusive por representante e por mercado (plano.md:279 e 342) | sgi/ABC71-SGI5-TAB_CUS.md:635-691 (687, 691); SGI12CodigoFonte/Diretoria {DIR}/Custos {CUS}/untDirCus_RelRepresSin.dfm:2933-2956 |
| `ABC71.SGI5_VIEW_M_NFME_ULT_CPA_CLI` | VIEW_CLI, VIEW_DMO, VIEW_STA, VIEW_VEN | Última compra e situação que o CRM interno do SGI já calcula | sgi/ABC71-SGI5-VIEW_M.md:100-120; SGI12CodigoFonte/Vendas - CRM {CRM}/Clientes {CLI}/untDmCrmCli.dfm:21 e 107-108 |
| `ABC71.SGI5_TAB_VEN_TP2` | TP2_COD, TP2_PRO, TP2_CMO, TP2_CMO_FOR, TP2_STA, TP2_LMI, TP2_MVE, TP2_IPR | Base da view de preço: part number repetido, valores de status, múltiplo, lote e o indicador de produto na tabela impressa. Se `TP2_IPR` virar filtro (pergunta 29), a TP2 passa para a lista do extrator | sgi/ABC71-SGI5-TAB_VEN.md:2721-2764 (PK 2729; IPR 2759); untDmVenPvd.dfm:6443 |
| `ABC71.TPMU` | EMPRESA, COD_CIDADE, NOME_CIDADE, ESTADO | Não foi preciso: o código de `RESERVADO7` se confirmou pela UF e pela lista do IBGE (pergunta 5). O nome não serve, porque é CHAR(20) | omega/ABC71-TP.md:3048-3067; SGI12CodigoFonte/Contabilidade {CONT}/Geracao GNRE {GNRE}/untDmContGnre.dfm:420-424 |
| `ABC71.SGI5_VIEW_VEN_PV2_V2_TOTAL` | VIEW_NPE, VIEW_VLR_SIP | Total sem IPI da tela do SGI, contra o total calculado pela PV2 | untDmVenPvd.dfm:368-372 e 529-530; fora do catálogo; colunas a confirmar na F2 |
| Código e definições | `SGI5_IUD_CUS_REP_FAT_V2` (DBA_SOURCE); texto das views acima e da `SGI5_VIEW_CARGA_PEDIDOS` (DBA_VIEWS); gatilhos `SGI5_TRG_VEPM_TO_VEN_PV1_V2` e `SGI5_TRG_VEPD_TO_VEN_PV2_V2` (ALL_TRIGGERS) | De onde vem CUS_VEN; regra das views; se o `VIEW_LR1` da carga é o `PV1_LR1`; o que o Omega grava no PV1 ao alterar ou excluir pedido | OracleDB/docs/modulos/custos-faturamento.md:14 (procedure); ABC71/outros_objetos.md:393 e 395 (gatilhos); OracleDB/docs/lacunas.md:7; Recebimento {REC}/Carga Pedido Venda e NF {CPV}/untDmRecCpv_Cpv.dfm:930-931 e 1071 |

## O que nunca entra na foto

- **CPF, CNPJ e o que os revela** (o `CRCL.CLIENTE` de empresa é a exceção, em `cliente.codigo_erp`):
  - `CRCL.CGC_CPF`, `DIG_CGC_CPF`, `PESS_FIS_COD`;
  - `NFME.CGC`, `SGI5_TAB_FIN_VEN.FIN_CNP`, `CRVN.CGC_CPF`;
  - `CRCL.CLIENTE` de pessoa física, que é o CPF; `NFME.FORNEC`, `VEPM.CLIENTE`, `PV1_CLI` e `VIEW_CLI` em claro;
  - a raiz do CNPJ.
- **Endereço e contato:**
  - o endereço da pessoa física (`CRCL.ENDERECO`, `BAIRRO`, `CEP` com `FIS_JURID` diferente de 'J'); o da empresa entra desde 2026-10-19 (CLAUDE.md, regra 3);
  - `CRCL.NUMERO`, `NUMERO_ALFA` e `COMPL_END` (vazios na carteira, em 19/10: o número vem no texto da rua), `CONTATO`, `DDD`, `TELEFONE_1`, `TELEFONE_2`, `TELEFAX`;
  - telefones, celular, e-mail e endereço da CRVN;
  - `CLI3_EMA`, `FIN_EMA`, `FIN_EMA_CPO`;
  - `VEPM.CONTATO`, `CONT_FONE`, `CONT_FAX`, `PEDIDO_CLI`;
  - `PV1_TRA_*`.
- **Financeiro e comissão:**
  - `CLI3_RFI`, `CLI3_RFI_DTA`, `CLI3_RFI_USU`;
  - `CRCL.LM_CREDITO`, `PROTESTO`;
  - `FIN_DEP_*`;
  - `VEPM.NRO_CARTAO`, `BANCO`, `AGENCIA`;
  - `PV1_LIM_CRE`, `PV1_TIT_ABE`, `PV1_PED_ABE`, `PV1_VLR_PED`;
  - percentuais de comissão da CRVN e da NFME.
  - `CRCL.SUSPENSO`, que nem é lido: o status do cliente vem de `CLI3_STA`, como no SGI (decidido em 2026-10-09, pergunta 16).
  - A revalidação de "não está suspenso" na LAN (plano.md:173) também usa `CLI3_STA`, e `CLI3_RFI` não é lido. A recusa sai com texto genérico.
- **Pessoas do ERP:** `PV1_ULB_*`, `PV1_USU`, `PV1_ORC`, `LOG_USU`, `LOG_USU_ORA`.
- **Texto livre do ERP:** `PV1_JCA`, `PV1_JLB_CRE`, `PV1_JUS_BPV` (justificativa de preço abaixo do mínimo), `CLI3_OBS`, `LOG_HIS` e mensagens do Oracle.
- **Só na LAN, para calcular:**
  - CRCLH e o dono anterior;
  - os itens das notas, as notas fora da janela da aba Faturados e a lista de datas de compra (a foto leva só a última, o ano da primeira, a de "desde" e a última por produto da Ficha);
  - as entradas da atribuição de pedidos e notas, `VEPM.VENDEDOR` e `NFME.VENDEDOR`. A foto leva só o representante já atribuído, e o cliente só quando ele é da carteira desse representante;
  - os pedidos em aberto e as notas atribuídos a representante não autorizado, mesmo de cliente da carteira de um autorizado. Eles só entram nas contas da visão do cliente, como a regra de parado (proposta, pergunta 26) e o faturado em 12 meses;
  - peças, valor e última compra dos produtos fora dos 8 da Ficha;
  - clientes que não estão na carteira de nenhum representante autorizado;
  - os dados de toda a Suprens usados no mix (clientes, faturamento e famílias);
  - limites dos tercis e contagem de parecidos;
  - a correspondência entre o id opaco e `CRCL.CLIENTE`;
  - a raiz do CNPJ usada nos grupos.
- **Sem tela, fica fora até haver uma:**
  - peças por mês da Ficha;
  - dias sem comprar;
  - itens de "mais" e "novos" no Início;
  - alerta rápido de queda;
  - lote mínimo (`VIEW_LMI`);
  - metas (`SGI5_TAB_VEN_MT1`);
  - `CRCL.SEGMENTO`, até Vendas classificar o ramo (plano.md:329-331).

## O que a F2 já faz (2026-10-13)

Primeira entrega da F2, pedida pelo Lucas ("começar a ver dados reais"). O extrator gera a foto, e a API mostra com ela o Início, Clientes, Ficha, Análises e as abas "Em aberto no ERP" e "Faturados" de Pedidos. Tudo roda só neste computador, com o login de teste, porque o login de verdade é da F3 (README.md, "Como rodar"). Catálogo, rascunhos e envio ainda não usam os dados reais.

- **Esquema implementado (versão 9, com o município IBGE do cliente para o Mapa):** as tabelas acima, menos `pedido_crm` e `pedido_crm_etapa`. O esquema fica em `dominio/esquemaDaFoto.ts`, e o servidor recusa foto de outra versão.
- **Conferência com o RELCUS001.** O faturado por representante e mês bate com a `SGI5_TAB_CUS_REP_FAT` nos códigos 1401 e 1402, em todos os meses de 2025 e 2026, com duas exceções:
  - junho de 2025: R$ 2.567,02 estão no 1402 no RELCUS001 e no 1401 pelo vendedor da nota. A soma dos dois códigos bate;
  - o mês corrente, porque a tabela do RELCUS001 ainda não tinha o dia.
  - Na Suprens inteira, a maioria dos meses bate ao centavo. Alguns diferem em até R$ 19 mil, a investigar.
- **Contagens no banco** (2026-10-13, só números):
  - uma empresa só (EMP_FIL 20210001) no CRCL, nas notas e nos pedidos (pergunta 4);
  - nenhuma nota de venda dos últimos 36 meses sem vendedor (pergunta 1);
  - todo pedido em aberto com o vendedor igual ao dono atual do cliente;
  - o calendário do SGI ia de 2025-01-01 a 2027-06-29 (pergunta 2); desde 2026-10-14 o CRM usa o calendário padrão;
  - as notas vêm em CT, com 4 itens em PC (pergunta 3).
- **Projeção (decidida em 2026-10-13).** O Lucas propôs faturado + média do faturado × dias úteis que faltam. A simulação com 20 representantes, de jan/25 a set/26, comparou as formas de projetar com o que cada mês fechou. Erro típico:
  - com a média do próprio mês: 59% nos 3 primeiros dias úteis, 33% do 4º ao 7º, 20% do 8º ao 12º, 10% do 13º ao 17º e 5% depois;
  - com a média dos últimos 6 meses: 17%, 15%, 13%, 9% e 5%. A de 12 meses ficou igual, e as de 1 e 3 meses e a do mesmo mês do ano anterior, um pouco piores;
  - só o faturado, piso do método antigo: 94%, 75%, 52%, 27% e 8%.
  - Ficou a média dos últimos 6 meses, com a carteira do mês como piso. Para a Star Vendas, em 13/10: R$ 622 mil, contra R$ 367 mil do método antigo e R$ 897 mil pela média do próprio mês.
- **Decisões desta entrega, a confirmar com o Lucas:**
  - carteira: cliente com `VEND_1` de um autorizado e nota de venda nos últimos 36 meses (pergunta 18);
  - atribuição: o vendedor da nota e, sem ele, o dono atual. O CRCLH entra quando aparecer nota sem vendedor;
  - compra (pergunta 25): junta as notas até 7 dias depois da primeira, sem encadear;
  - ciclo: abaixo de 30 dias vira 30; acima de 180, o cliente é irregular. Com a regra do plano ("fora de 30 a 180, irregular"), o maior cliente da Star Vendas, que compra várias vezes por mês, aparecia como irregular;
  - entrega do pedido em aberto: a mais próxima entre os itens com saldo;
  - valor em aberto: a conta proposta em Pedidos, ainda sem conferir com a tela do SGI (pergunta 13);
  - `pedido_aberto.cliente` e `nota.cliente`: o id quando o cliente está na carteira de qualquer autorizado. O servidor só mostra o nome quando o cliente é da carteira do login. O pedido do login para cliente de outra carteira conta no Início e não aparece na lista (pergunta 33);
  - nome e cidade como estão no ERP, em maiúsculas e sem acento. O código IBGE já está na foto (Mapa); o nome do IBGE na lista é a pergunta 5.
- **Itens em Pedidos (2026-10-14).** A linha da aba Pedidos abre os detalhes na própria lista, e a foto passou a levar os itens (`pedido_aberto_item`, `nota_item`) e o pedido de origem da nota (`nota.pedidos`).
  - O extrator lê os pedidos em aberto e as notas item a item. A entrega, o valor e a parte do mês de cada pedido passaram do SQL para `extrator/src/calculo/pedidos.ts`, com teste.
  - Conferido em 14/10: os 3 pedidos e as 66 notas da Star Vendas saíram iguais aos da foto da versão 2, com diferença de 1e-11 real, da soma feita no Node.
  - Nos dados: o Omega guarda no pedido o item já faturado, com saldo 0. Em 41 dos pedidos com saldo, algum item já foi faturado, mas só 2 itens estão faturados em parte. A aba mostra só os itens com saldo, que são o valor em aberto.
  - Cada nota dos últimos 45 dias tem um pedido de origem. Não há produto repetido num pedido ou numa nota da Star Vendas, mas a foto aceita, porque o pedido programado pode ter o mesmo produto em duas entregas.
  - A resposta de `/api/pedidos` da Star Vendas foi a 137 KB sem compressão, quase toda dos 1.188 itens das notas.
- **Status do cadastro (2026-10-14, simplificado em 2026-10-15).** Clientes tem a coluna Status, e a Ficha e a escolha do cliente do pedido mostram o mesmo status, pelo nome do SGI. O cliente fora de ativo fica na carteira, e o "Incluir pedido" mostra o aviso do status, para falar com a equipe de vendas da Suprens (pergunta 16). O termo "negativo" saiu. A situação de compra "inativo" (mais de 24 meses sem comprar) virou "perdido", continua cinza e recebe pedido. Na Star Vendas, em 15/10: os 178 clientes ativos no cadastro, e 18 perdidos.
- **Catálogo com preços (2026-10-14).** O Incluir pedido mostra, com os dados reais, o catálogo do cliente: a tabela dele, o preço do cento pela regra do Lucas (tabela + desconto do modelo ou padrão), família, medida, embalagem e part number, e as abas "Já comprados" e "Todos". O extrator lê o catálogo em 2 s.
  - A propor ao Lucas: a embalagem do EAN como passo da quantidade, como no protótipo; "já comprou" em 24 meses; montadora só com tabela ativa e só tabela em real, como o SGI.
  - O rascunho e o envio ainda não gravam com os dados reais (F3 e F5): a tela agora mostra o motivo, em vez de falhar calada.
- **Pedidos (2026-10-15).** Os cartões de Pedidos ficam na ordem Faturados, Em aberto no ERP, Enviados pelo CRM e Rascunhos, e a página abre em Faturados. Na Ficha, "Pedidos em aberto" virou "Pedidos": o histórico de 12 meses, com a coluna Status (Faturado, Em aberto, Enviado pelo CRM e Rascunho).
  - Com os dados reais, a Ficha mostra só os pedidos do ERP; os do CRM chegam com o app.db (F3 e F5).
  - Na F5, o pedido enviado pelo CRM que chega ao ERP também vem na foto. Ligado pelo número CRM, ele aparece uma vez só, com o status do ERP, como o fictício já faz.
- **Mapa (2026-10-15).** A tela do Mapa funciona com os dados reais e com o fictício (seção 10).
  - A foto (versão 9) leva o município IBGE do cliente, de `CRCL.RESERVADO7`.
  - Os desenhos são arquivos estáticos do IBGE, iguais nos dois modos.
  - A linha aberta, nas abas de Pedidos e na ficha: só uma por vez, o cabeçalho um tom mais escuro e o resumo por família antes dos itens. Na ficha, a tabela de pedidos passou a abrir como a de Pedidos, e os faturados trazem os itens das notas (`pedido_faturado_item`).
  - A busca de cliente em Pedidos, pelo nome fantasia ou pelo CNPJ (dados/busca.ts, com teste). A mesma regra passou a valer na busca de Clientes e na escolha do cliente do pedido, que também acham o CNPJ com pontuação e com o zero da esquerda.
- **Ainda não feito:** grupos por raiz de CNPJ, a troca da foto por SFTP com manifesto e os esquemas de resposta da API.

## O que a F3 já faz (2026-10-15)

O login de verdade, com a chave de acesso, aprovado pelo Lucas em 2026-10-15 com o pacote `@simplewebauthn/server` (versão fixa 14.0.3; só `server/src/login/chaveDeAcesso.ts` o importa). O login de teste fixo saiu: no modo de dados reais, entra-se pelo convite e pela chave, como os representantes vão entrar.

- **Convite, chave e sessão.**
  - As regras de convite, chave e sessão do plano (plano.md, "Login e sessão") estão em `server/src/login`, com os testes em `login.test.ts`.
  - Os testes passam pela conferência inteira do pacote, com um aparelho simulado que assina como um de verdade.
  - Conferido de ponta a ponta no Chrome, com o autenticador virtual do próprio Chrome: convite, chave, sessão, saída, entrada de novo, convite reusado, link cortado, sem sessão e sem chave.
- **Proteções.**
  - Cookie `__Host-` com HttpOnly, Secure e SameSite=Strict; o JavaScript da página não lê o token.
  - POST só da própria origem.
  - Limite por IP no login e por usuário no resto.
  - O IP só vem do X-Forwarded-For do Apache, nesta máquina.
  - Erro do pedido sem detalhe.
- **Administração.** Pela tela da administração (seção 11, desde 2026-10-16) ou pela linha de comando (`npm run admin`), no servidor, por SSH: `criar-admin`, `convidar`, `novo-convite`, `usuarios`, `revogar` e `desativar`.
  - Os códigos são conferidos contra a lista de autorizados da foto (CLAUDE.md, regra 4).
  - Toda ação vai para a auditoria.
- **Auditoria.** Grava a chave criada e a recusada, a entrada e a recusada, a saída, as ações de admin e a ficha consultada. O alvo é sempre um id; nome e IP ficam fora (pergunta 36).
- **Falta na F3:**
  - a cópia da auditoria em `saida/auditoria/*.jsonl` para a LAN, que vem com o canal SFTP da I1;
  - apagar a auditoria e as sessões antigas, depois de 6 a 12 meses (plano.md:155).
- **Antes da produção:** o domínio do CRM (`CRM_ORIGEM`). As chaves criadas ficam presas a ele, e as deste computador, a `localhost`.

## Perguntas para a F2

**Conferir nos dados (F2)**

1. **Atribuição.**
   - Qual é o formato real de `CRCLH.HISTORICO` para `CAMPO='VEND_1'`? O protótipo supõe "de: X para: Y", e quem grava é o Omega.
   - Quantas notas de venda vêm com `NFME.VENDEDOR` nulo ou 0?
   - Quantos pedidos em aberto vêm com `VEPM.VENDEDOR` nulo, 0 ou diferente do `VEND_1` atual do cliente? Isso confirma que `VEPM.VENDEDOR` usa o mesmo código do representante e mede o pedido de cliente de outra carteira (ver Pedidos).
   - Ler em DBA_SOURCE como `SGI5_IUD_CUS_REP_FAT_V2` preenche `CUS_VEN`. Se ela usar o `VEND_1` atual para todo o histórico, o total por representante não bate com a regra do plano (plano.md:219 e 342). Qual dos dois vence?
2. **Calendário.** ~~Período coberto por `SGI5_TAB_DP_CALEND` (790 linhas): todo dia tem linha? O ano anterior inteiro está lá? Os feriados do ano seguinte são cadastrados com antecedência?~~ Decidido em 2026-10-14: calendário padrão até o personalizado, que o Lucas define antes de o CRM ficar pronto.
3. **Unidades e tipos.** Quais são as unidades reais das notas e dos pedidos além de CT e PC? O Gestao faz CT ×100 e o resto ×1; o RELCUS001 faz ×100 sempre (custos-faturamento.md:23-24). Listar também os tipos de movimento (plano.md:280).
4. **EMP_FIL.** Quantas empresas têm notas e pedidos de venda? Hoje o código do cliente leva só `CLIENTE`.
5. **Cidade.**
   - ~~`CRCL.RESERVADO7` é o código IBGE do município? Quanto dele está preenchido?~~ Sim, conferido em 2026-10-15.
     - O código tem 7 dígitos e começa pelo código da UF do cliente.
     - Está preenchido nos 178 clientes da Star Vendas, que caem em 42 municípios da malha do IBGE.
     - Na Suprens, 12.403 dos 17.802 clientes com vendedor têm o código nesse formato.
     - É a base do Mapa.
   - A lista de Clientes mostra o nome do IBGE no lugar de `CIDADE`, que vem cortada em 20 letras?
   - ~~Conferir o código contra a `TPMU` (`COD_CIDADE`), como a GNRE faz (`untDmContGnre.dfm:420-424`).~~ Não foi preciso: a UF e a lista do IBGE bastaram.
   - O cliente com `ESTADO='EX'` mostra só "EX" ou o país? Se for o país, o nome vem de `ABC71.TGPA.NOME_PAIS` (omega/ABC71-TG.md:437-455)? Com qual EMPRESA/FILIAL? Sem essa decisão, `COD_PAIS` fica fora da leitura.
6. **Mercado.** Há clientes cujo `TIPO_CLI` discorda do tipo de movimento das próprias notas (310/315 praça, 316/317 exportação, 320/325/326 montadora)? Qual dos dois vale no mix?
7. **Família.**
   - `PAC_GRC` aponta sempre para o nível 2, ou é preciso subir pelos 4 primeiros dígitos?
   - Comparar com a regra do Gestao (`ESTQ.GRUPO`).
   - O que mostrar para os 41 PA sem grupo (familias.md:38) e para item vendido fora do grupo 30?
8. **Medida.** `PAC_DMI_MM` e `PAC_DMA_MM` estão preenchidos e fazem sentido em todas as famílias (MOLA, BORRACHA, LAMINADOS)? A alternativa é o diâmetro nominal ou o tamanho do código (`SGI5_FNC_ENG_PAC_TAM_COD`).
9. **Embalagem.** Qual é a fonte da embalagem de venda: `EAN_QTD` do EAN padrão, `VIEW_MVE` ou `TR1_QPE`? Em peça ou em CT? Qual o valor quando vier vazio? Desde 2026-10-20, o CRM aceita quantidade fora do múltiplo, como o SGI, e a embalagem só dá o passo dos botões.
    - Respondido no banco em 2026-10-14: o `VIEW_MVE` (e o lote mínimo `VIEW_LMI`) vêm vazios em todas as linhas da Star Vendas, e o EAN não tem padrão marcado (`EAN_PPR` nulo), mas cada produto do catálogo tem um EAN só, com a quantidade em peças. O CRM usa o `EAN_QTD`; sem EAN, qualquer quantidade. Falta o Lucas confirmar o bloqueio do múltiplo.
10. **View de preço.** Respondido em 2026-10-14: o texto da view (DBA_VIEWS) é a regra que o Lucas definiu, e a conta refeita pelas tabelas dá o mesmo preço. `VIEW_TAB`, `VIEW_PAC` e `VIEW_PNU` são `CLI_TAB`, `TP2_PRO` e `TP2_CMO`. A leitura agrupada da carteira da Star Vendas leva 1,5 s.
    - A view já abre com o `LUCAS_RO` (plano.md:322). Ler o texto dela em DBA_VIEWS.
    - Confirmar no texto que `VIEW_TAB`, `VIEW_PAC` e `VIEW_PNU` correspondem a `TP2_COD`, `TP2_PRO` e `TP2_CMO`.
    - Comparar uma linha com uma nota recente do mesmo cliente e produto (`VLR_TOTAL ÷ QTDE` em CT).
    - Ler também o texto da `SGI5_VIEW_ENG_PAC_SEM_ARVORE`. Com o `READ ANY TABLE`, as views do ABC71 abrem (OracleDB/docs/lacunas.md:7).
    - Medir o volume da view só para os clientes dos autorizados, na tabela escolhida.
11. **Part number.** Quantos grupos (`VIEW_CLI`, `VIEW_TAB`, `VIEW_PAC`) têm mais de uma linha? Se houver, o catálogo passa a ter chave código + part number, ou o extrator escolhe um?
    - Respondido em 2026-10-14: 6.372 pares da Star Vendas têm mais de uma linha (part number ou depósito do ESTQ), sempre com o mesmo preço. O extrator fica com o menor part number.
12. **Pedido CRM.**
    - Ler em DBA_VIEWS a `SGI5_VIEW_VEPM_STA_FAT`.
    - ~~Medir quantas notas de venda vêm com `NFME.NRO_PEDIDO` nulo ou 0.~~ Medido em 2026-10-14: das 61.075 linhas NFME de venda dos últimos 36 meses, só 1 veio sem pedido (2025). Outras 731 apontam para um número que não está no VEPM; falta saber se é pedido apagado ou número que recomeçou depois de 2.999.999. A ligação nota → pedido já está no fonte do SGI (ver Detalhe do pedido) e já aparece na aba Faturados.
    - Ler em DBA_VIEWS se o `VIEW_LR1` da `SGI5_VIEW_CARGA_PEDIDOS` é o `PV1_LR1`. Se for, o número CRM chega a `VEPM.LIVRE`.
    - Descobrir de onde vem a data do cancelamento (`PV1_DUA` ou `VEPM_SGI5_LOG.LOG_DTA`).
    - Ver o que os gatilhos `SGI5_TRG_VEPM_TO_VEN_PV1_V2` e `SGI5_TRG_VEPD_TO_VEN_PV2_V2` gravam no PV1.
13. **Valor em aberto.** Conferir o total contra a tela de pedidos do SGI, com a cadeia de descontos do VEPD e a alíquota de `VEPM.Z_FRANCA_DESC` num pedido 315 já faturado. O que significa `BLOQUEADO = 'F'`?
14. **Primeira compra.** Desde quando o NFME tem notas? O extrator recalcula o MIN a cada foto, ou guarda o resultado na LAN? O NFDE tem cerca de 3,5 milhões de linhas.
15. **Grupo de clientes.** `SGI5_TAB_VEN_CLI3.CLI3_GRP` está preenchido? Serve para grupo econômico?
16. **Status do cliente** (plano.md:173).
    - Decidido em 2026-10-09: o mesmo do SGI, `NVL(CLI3_STA,'ATIVO')` (`untDmVenPvd.dfm:2572`; `Vendas - CRM {CRM}/Clientes {CLI}/untDmCrmCli.dfm:18`). `CRCL.SUSPENSO` não é lido; usá-lo foi erro do protótipo (CRM-prototipo/REGRAS.md:79).
    - Decidido em 2026-10-09: a revalidação de "não está suspenso" na LAN também segue o SGI, com `CLI3_STA`. `CLI3_RFI` não é lido.
    - Decidido em 2026-10-14 e simplificado em 2026-10-15: o cliente fora de ATIVO (INATIVO ou SUBSTITUIDO) continua na carteira, com o status à mostra pelo nome do SGI (coluna Status em Clientes; selo na Ficha e na escolha do cliente do pedido), e não recebe pedido: a tela mostra o aviso para falar com a equipe de vendas da Suprens e, no inativo, pedir a reativação. O SUBSTITUIDO também bloqueia, porque o código foi trocado por outro.
    - Valores do `CLI3_STA` em 14/10: ATIVO 17.449, INATIVO 269, SUBSTITUIDO 36 e 17 nulos. Nenhum INATIVO ou SUBSTITUIDO tem a Star Vendas como vendedor ou já recebeu nota dela. Um valor desconhecido para a foto (`extrator/src/erp/carteira.ts`), porque o CRM não sabe se o cliente recebe pedido.
    - No SGI, a tela de pedido só barra o INATIVO de montadora (`untVenPvd_PvdIncluir.pas:1007-1011`). O CRM barra todo cliente fora de ativo, como o Lucas decidiu.
    - `CRCL.SUSPENSO` continua fora: em 15/10, 7 clientes da carteira da Star Vendas estavam suspensos no Omega, com o motivo "PC", todos com compra nos últimos 24 meses. O SGI não usa esse campo.

**Decidir com o Lucas**

17. **Código do cliente.**
    - Decidido em 2026-10-13: a tela mostra o código do ERP da empresa, porque o CNPJ é público. Na pessoa física, mostra "Pessoa física", porque o código dela é o CPF (ver Clientes).
    - Decidido em 2026-10-13 (opção A): id opaco para todos os clientes, no endereço da ficha, nos rascunhos e na auditoria. É um HMAC com chave que só existe na LAN.
18. **Carteira.**
    - Decidido em 2026-10-09: vale `CRCL.VEND_1`, o campo vendedor do cliente, igual ao código da sessão. Segue em aberto o filtro `EMP_FIL = 20210001`, que o SGI não usa.
    - Decidido em 2026-10-13: a pessoa física fica no CRM, com o nome e sem o código do ERP, que é o CPF. A tela Representantes - Clientes e a exportação do SGI para os representantes levam só `FIS_JURID='J'` (`Representantes - Clientes {REPCLI}/untDmVenRepCli.dfm:626-631`; `Representantes - Atualicacao Base Dados {REPABD}/untDmRepAbd.dfm:159-164`).
      - A contagem de 2026-10-09 achou 196 pessoas físicas com vendedor, 46 com venda em 24 meses, contra 17.602 pessoas jurídicas com vendedor, 3.469 com venda em 24 meses (ver Clientes).
      - O nome da pessoa física é dado pessoal: fica restrito à carteira e nunca vai para log.
      - Levantamento de 2026-10-13, nos últimos 24 meses e pela RF:
        - 46 pessoas físicas, 320 notas, R$ 826 mil: 0,34% do faturamento. Nos últimos 12 meses, R$ 451 mil;
        - mediana de R$ 2.073 por nota, contra R$ 2.581 das empresas. Todas são do mercado praça, compram PRESIL, MICRO e FLEXIL e estão com 11 representantes;
        - as maiores compram quase todo mês: a primeira tem 52 notas e R$ 111 mil; a terceira, 62 notas;
        - as maiores fatias por representante: 4,8% das vendas do 1125, 2,7% do 1213, 2,4% do 1120 e 1,8% do 1302;
        - cada nota tem o próprio pedido no SGI: 320 notas e 320 pedidos.
    - Saem `TIPO_CAD` diferente de 'C' e cliente sem compra há N anos? O cliente fora de ativo no `CLI3_STA` fica (decidido em 2026-10-14).
    - `VEND_2` e `VEND_3` têm uso?
19. **Grupos: decidido em 2026-10-17.** O grupo é o campo Grupo do SGI, e a lista e as análises mostram o grupo, com os números somados; ver Clientes, "Grupos do SGI". As perguntas abaixo ficam como histórico.
    - A lista mostra a filial ou o grupo?
    - Que nome, cidade e mercado tem o grupo?
    - De quem é um grupo com filiais de representantes diferentes?
    - A situação, o faturado em 12 meses e a primeira compra são calculados no grupo e repetidos em cada filial? Com filiais em carteiras diferentes, repetir o valor do grupo mostra a A as compras da filial de B (ver a proposta em Análises).
    - Na pessoa física, a raiz não agrupa.
    - A troca de CNPJ (licoes.md:100) fica fora da regra automática.
20. **Representantes.**
    - Entram só `FIN_TIP='REPRESENTANTE'` ou também 'VENDEDOR'?
    - A lista de autorizados fica num arquivo na LAN, mantido pelo Lucas?
    - Decidido em 2026-10-13: o usuário de login puxa todos os códigos ligados a ele, e as telas somam todos (ver "Dois escopos"). Os dois códigos da mesma representação existem porque cada contrato tem a sua comissão. A rota de admin que liga o usuário aos códigos é a exceção à regra 4 do CLAUDE.md (ver Admin).
    - Proposta: o nome do usuário é digitado no Admin ao criar o login. O `CRVN.NOME` é o da representação ("BATISTELI & CIA. LTDA.").
21. **Hora do dado.** `atualizadoEm` é a hora da última conferência do ERP ou a da última mudança (plano.md:305)? Vale o SYSDATE do Oracle no início da leitura?
22. **Escopo dos pedidos.** Decidido em 2026-10-09: pedidos sempre só os do representante. Pedidos em aberto e projeção usam a visão do representante no Início, em Pedidos e na Ficha: `VEPM.VENDEDOR` e, sem ele, o dono atual do cliente (`VEND_1`), com a conta na LAN.
23. **Faturados.**
    - Decidido em 2026-10-13: só as notas atribuídas aos códigos do login, como os indicadores de faturamento.
    - Qual é a janela da aba: os 45 dias da tela e do fictício, ou outra? Quanto menor a janela, menos notas vão para a foto.
24. **Mesmo dia útil.** Aprovar a regra proposta no Início.
25. **Regras das análises.**
    - O evento de compra encadeia notas a até 7 dias da anterior ou conta a partir da primeira?
    - Que data representa o evento?
    - As "3 compras" de comprando menos e mais são 3 no total ou 3 em cada período, e passam a ser eventos em vez de meses?
    - A perda mensal inclui o mês da última compra (dominio/analises.ts:100-106) ou só os 12 anteriores (plano.md:226)?
    - Com menos de 12 meses de história, divide por 12?
    - O "faturado desde então" do mês de "desde" até hoje vale?
    - O piso de "dados insuficientes" da variação em 12 meses vale?
    - "Comprando mais" exclui o cliente novo, como faz o fictício (`ficticio.ts:638`)? O plano não diz (plano.md:228-232).
    - Antes da F2, a regra de quem entra em cada lista sai do fictício (`ficticio.ts:609-652`) e vai para `analises.ts`, com teste.
26. **Pedido em aberto que impede "parado".** Conta só o VEPD com saldo e o VEPM não bloqueado? Ou contam também o pedido bloqueado, o pedido do SGI ainda não exportado e o enviado pelo CRM? E o saldo antigo esquecido?
    - O pedido do cliente atribuído a outro representante conta? A decisão da pergunta 22 vale para as listas de pedidos. Proposta: conta, porque Análises usa a visão do cliente (ver Análises).
27. **Ficha.**
    - Famílias e produtos usam os mesmos 12 meses fechados do faturado, para a soma bater?
    - Fica o limite de 8 produtos?
    - Cliente sem compra mostra a lista vazia?
    - Cliente que nunca comprou: "Cliente desde" com "—" (nulo) ou com `CRCL.DT_CADASTR`?
28. **Já comprou.** A janela é de 12 meses, como a Ficha, ou de 24, como o mix? A compra de outra filial do mesmo CNPJ conta?
29. **Catálogo.**
    - A tabela é a linha com `CLI_STA='PRINCIPAL'`? Cliente sem principal, ou com duas, fica sem catálogo?
    - 'ATIVO-DB' aparece para o representante (plano.md:334)?
    - Tabelas fora de REAL ficam fora do CRM?
    - Os bloqueios que o SGI aplica só a montadora valem para todos?
    - Item com preço nulo ou zero sai do catálogo?
    - `SGI5_TAB_VEN_TP2.TP2_IPR` ('SIM' = sai na tabela de preço impressa, `Vendas {VEN}/Relatorios {REL}/untVenRel_RelTabelaPrecoImpressa.dfm:65837`) deve filtrar o que o representante vê? A view de preço não tem essa coluna nas consultas do SGI (`untVenPvd_PosPac.dfm:443-520`). Se sim, a view é ligada à TP2 por tabela, produto e part number.
30. **Etapas do pedido CRM.**
    - "Recebido" é a LAN ter gravado o arquivo, e "em aprovação" é o pedido achado no PV1?
    - "Erro na importação" (plano.md:184) vira "recusado" com motivo?
    - O pedido retido para revisão manual ou em quarentena continua "enviado"?
    - Ficamos com um número só no lugar de `numeroSgi` e `numeroErp`?
31. **Motivo da recusa.** Fechar a lista de códigos e frases, escrita pelo importador e pela validação da LAN. Quais códigos são por item e levam o código do produto (`motivo_produto`)?
32. **Valor em aberto.** O pedido antecipado bloqueado (condição de pagamento 1000, `untRecCpv_Cpv.pas:344-373`) entra no valor em aberto? A coluna "Itens" conta só as linhas com saldo? A "Entrega" mostra a próxima entrega com saldo ou a entrega do cabeçalho?
33. **Rascunho de cliente que saiu da carteira.** Some, fica bloqueado para envio ou continua visível? O pedido já enviado continua visível para quem enviou?
    - E o rascunho com produto que saiu do catálogo do cliente? O servidor tira o item na leitura e avisa o representante, ou bloqueia só o envio? Hoje a tela esconde o item (MontarPedido.tsx:80), mas o reenvia em todo salvamento (MontarPedido.tsx:184-186), e a validação recusaria o rascunho inteiro.
    - Como esse item entra em "N produtos" e no total estimado da aba Rascunhos?
    - E o pedido em aberto ou a nota atribuídos ao representante de cliente que hoje é de outra carteira? Proposta: a linha aparece sem o nome, com "Cliente de outra carteira", e sem link para a ficha (ver Pedidos).
34. **Mapa.** Decidido em 2026-10-09: saem as classes "atendida" e "carteira de outros". O mapa mostra só a carteira do representante (plano.md:199).
35. **Contrato.** Tirar os campos sem tela: `FaturamentoMensal.pecas`, `ClienteParado.diasSemComprar` e os itens de "mais" e "novos" nos destaques do Início.
36. **Auditoria.** Grava o IP? O Marco Civil define registro de acesso com data, hora e IP. É dado pessoal.
37. **Sistema atual dos representantes.** O SGI já exporta CNPJ, razão social, endereço, telefone e e-mail dos clientes para o sistema dos representantes (SGI6R; `untDmRepAbd.dfm:9-164`). O CRM vai substituí-lo? Os representantes precisam ser avisados de que o CRM não mostra CNPJ nem contatos (plano.md:20)?

**Com quem mantém o SGI e com o DBA (antes da F5; a 42, antes do piloto da F4)**

38. **`PV1_LR1`.** Confirmar que nenhum outro layout usa o campo. Criar o índice único.
39. **Layout CRM.**
    - Gravar sempre `PEDIDO BLOQUEADO` e a origem `REPRESENTANTE`.
    - Receber o código Suprens e o part number. Hoje a carga acha o produto pelo part number do arquivo (`untDmVenPvd.dfm:6440 e 6455`).
    - A LAN escolhe a tabela de novo no Oracle, sem confiar no arquivo.
40. **Entrega.**
    - Hoje quem carrega escolhe IMEDIATA ou PROGRAMADA no combo `cbTen`; isso não vem do arquivo. Com IMEDIATA, a carga ignora a data e grava hoje no `PV1_DEN` e no `PV2_DEN` (`untVenPvd_PvdIncluirCarga.pas:685-688 e 770-773`).
    - O layout CRM fixa PROGRAMADA quando houver entrega desejada? E o que faz sem ela?
    - A regra de hoje+7 para entrega PROGRAMADA vale para o layout CRM?
41. **Assinatura.** A LAN confere a assinatura do envio (plano.md:148)? Isso só protege contra um servidor comprometido se a LAN tiver as chaves públicas por um caminho confiável, e não só pelo app.db do servidor.
42. **Conta do extrator.** Decidido em 2026-10-09: o DBA cria, num esquema do CRM, uma view por objeto da lista só com as colunas listadas, e concede à conta do extrator SELECT só nessas views (plano.md:322).
    - O esquema do CRM é o dono das views e não tem login (conta bloqueada). Ele recebe do ABC71 SELECT WITH GRANT OPTION, por grant direto, em cada objeto da lista. Sem isso, o GRANT na view falha (ORA-01720).