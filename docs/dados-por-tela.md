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
| Hora do dado (`atualizadoEm`) | "Dados de hoje, 14:32", com a dica "Hora em que os dados foram copiados do ERP" (Layout.tsx:68 e 105-113) | Início da leitura do ERP que gerou a foto | `TO_CHAR(SYSDATE)` no Oracle; nenhuma tabela | extrator |
| Data da foto (`hoje`) | Base de "há 12 dias" e das datas relativas que vêm do ERP, em todas as telas | Data de referência das regras | `TO_CHAR(SYSDATE,'YYYY-MM-DD')` | extrator |
| Relógio (`relogio`) | O "hoje" da barra, a entrega mínima, a data e a saudação do Início e os momentos que o CRM grava | Relógio do servidor em Brasília, a cada resposta | nenhuma | servidor |
| Códigos do representante | "Representante 1401" ou "Representantes 1401 e 1402" no menu (Layout.tsx:53; formato.ts:110) | Vêm da sessão, nunca do navegador. Um login pode ter mais de um código | É o mesmo número em `CRVN.VENDEDOR`, `SGI5_TAB_FIN_VEN.FIN_VEN`, `CRCL.VEND_1`, `NFME.VENDEDOR` e `VEPM.VENDEDOR` (este a confirmar, pergunta 1) | app.db |
| Nome | Nome e iniciais no menu (Layout.tsx:50-52) | Proposta: o nome do usuário, digitado no Admin ao criar o login (pergunta 20) | nenhuma | app.db |
| Ocultar valores | "R$ ••••" (valores.tsx:11) | Começa oculto em toda sessão e não é lembrado | nenhuma | navegador |
| Sair | Link do menu (Layout.tsx:54) | Na F3 vira POST, revoga a sessão e manda `Clear-Site-Data` (plano.md:146) | nenhuma | app.db |

- **Data da foto e relógio (corrigido em 2026-10-09).** A barra comparava `atualizadoEm` com o `hoje` da própria foto, e a foto parada desde ontem aparecia como "hoje, 23:50". Agora o contrato traz `SituacaoDosDados.relogio`, o relógio do servidor em Brasília (tipos.ts:20-25), e a barra compara com ele (Layout.tsx:105-113).
  - A data da foto vale para as regras do extrator e para as datas que vêm do ERP.
  - O relógio vale para:
    - o rótulo "hoje" da barra;
    - a data mínima de entrega (MontarPedido.tsx:67 e 116; pedido.ts:70-80);
    - o dia por extenso e a saudação do Início (Inicio.tsx:28-29 e 177-188);
    - todo momento gravado no app.db: "Enviado" e "Atualizado" em Pedidos, "Rascunho salvo" e o cabeçalho e o Andamento do Detalhe (formato.ts:127-139).
- A CRVN tem uma linha por gerente e supervisor (PK em ABC71-CR.md:5475). Por isso o nome é agrupado por VENDEDOR.
- O SGI só lê a CRVN na empresa 20210001 (`untDmVenPvd.dfm:499-503`). Sem esse filtro, o nome pode vir de outra EMP_FIL.
- O alerta de foto com mais de 2 h de atraso já existe na LAN (plano.md:309).

## 2. Início

**Indicadores**

Todos os indicadores usam a visão do representante. Projeção e pedidos em aberto seguem a decisão de 2026-10-09 (pergunta 22).

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Faturado no mês | "Faturado em outubro" (Inicio.tsx:98-104) | RF do mês até hoje, atribuída ao representante | NFME, NFDE, `NFME.VENDEDOR`, CRCLH | extrator |
| Mesmo dia útil do ano anterior | "vs out/2025, mesmo dia útil" | RF atribuída no mesmo mês do ano anterior, até o Nº dia útil | o mesmo, mais `SGI5_TAB_DP_CALEND` | extrator |
| Dia útil e dias úteis | "8º de 22 dias úteis" (Inicio.tsx:173-176) | Dias com `NVL(TRIM(CAL_DUT_COM),'SIM') <> 'NAO'`, como o SGI (`untFunMat.pas:676`): de 1º até hoje e no mês todo | `SGI5_TAB_DP_CALEND` | extrator |
| Projeção | "Projeção de outubro", com "X a faturar" (Inicio.tsx:105-114) | Faturado mais o valor em aberto do representante com entrega até o fim do mês | VEPM, VEPD; atribuição por `VEPM.VENDEDOR`, na LAN | servidor, sobre os pedidos do representante |
| Acumulado do ano | "Acumulado de 2026" | Soma dos meses do ano corrente | (foto) | servidor |
| Acumulado do ano anterior | "vs 2025" | Janeiro até o mês anterior inteiros, mais o mesmo dia útil do mês corrente | (foto) | servidor |
| Pedidos em aberto | Valor e "N pedidos" (Inicio.tsx:121-126) | Contagem e soma dos pedidos em aberto atribuídos ao representante | VEPM, VEPD; atribuição por `VEPM.VENDEDOR`, na LAN | servidor, sobre os pedidos do representante |
| Gráfico mensal | Barras do ano, comparação com o ano anterior e "A faturar no mês" (BarrasMensais.tsx:154-160) | Mês sem dado ainda é nulo. O ano anterior usa o mês inteiro | NFME, NFDE, VEPD | extrator; a faturar: servidor |
| Saudação | "Boa tarde, Carlos" (Inicio.tsx:28) | Primeiro nome do usuário; "Bom dia", "Boa tarde" ou "Boa noite" pela hora de Brasília | nenhuma (proposta da pergunta 20) | nome: app.db; parte do dia: navegador, pelo `relogio` do servidor (Inicio.tsx:182-188) |

**Destaques (visão do cliente, sobre a carteira)**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Atenção na carteira | Quantidade e total de Pararam, Comprando menos, Comprando mais e Novos (Inicio.tsx:136-163) | Soma de todos os clientes da lista, não só dos 5 mostrados | listas das Análises | servidor |
| Cartão "Pararam de comprar" | 5 primeiros: nome, cidade/UF, "última compra há X" e o valor por mês, com link para a ficha (Inicio.tsx:39-58) | Ordem da análise | listas das Análises e `cliente` | servidor |
| Cartão "Comprando menos" | 5 primeiros: nome, cidade/UF, variação e diferença, com link para a ficha (Inicio.tsx:59-78) | Ordem da análise | listas das Análises e `cliente` | servidor |

- **Atribuição (plano.md:219).**
  - Vale o vendedor da nota (`NFME.VENDEDOR`).
  - Se ele vier nulo ou 0, vale o dono do cliente na data da nota, pelas trocas de `VEND_1` no CRCLH.
  - Antes da primeira troca, vale o "de" dela. Sem trocas, vale o `VEND_1` atual.
  - O extrator aplica a regra na LAN. Para os indicadores, grava as somas por representante e mês (`painel_mes`). Para a aba Faturados, grava só o representante já atribuído de cada nota (`nota.representante`, pergunta 23). Nada do CRCLH vai para a foto (plano.md:35).
- **Mesmo dia útil (proposta a confirmar).** Com N = dia útil de hoje, soma-se o mesmo mês do ano anterior até antes do (N+1)º dia útil. Assim entram as notas de sábado ou de feriado logo depois do Nº. Se o mês do ano anterior tiver menos de N dias úteis, entra o mês inteiro. O fictício faz só uma proporção (ficticio.ts:446) e não serve de regra.
- **A faturar no mês.**
  - Entram os itens com saldo e `VEPD.DT_ENTREGA` até o último dia do mês, inclusive os vencidos.
  - Conta a entrega de cada item, como no protótipo (CRM-prototipo/REGRAS.md:52). O fictício usa a entrega do pedido inteiro.
  - O extrator grava em cada pedido o valor com entrega até o fim do mês, e o servidor soma os pedidos do representante.
  - A reconstrução das 00:10 resolve a virada do mês (plano.md:306).
  - No gráfico, o mês corrente é o único com `aFaturar` como número, inclusive 0; nos outros ele é nulo (tipos.ts:108-112). O fictício manda 0 quando não há nada a faturar (ficticio.ts:505).
  - Corrigido em 2026-10-09: antes a tela pedia `aFaturar` diferente de zero, e com 0 a faturar o mês parcial passava por fechado. Agora ela testa `aFaturar != null` (BarrasMensais.tsx:22-25). O teste é frouxo de propósito, porque a Ficha usa o mesmo gráfico sem mandar `aFaturar`.
- **Escopo dos pedidos em aberto e da projeção (decidido em 2026-10-09, pergunta 22).**
  - Visão do representante, como os outros indicadores do Início (plano.md:207). A projeção soma o faturado com os pedidos dele (plano.md:194).
  - Atribuição: `VEPM.VENDEDOR`; se vier nulo ou 0, o dono do cliente pelo `VEND_1` atual. O extrator faz a conta na LAN e grava o representante em cada linha de `pedido_aberto`.
  - O servidor soma `pedido_aberto` só pelo representante da sessão. Nenhuma rota recebe vendedor do navegador.
  - A mesma regra vale para a aba "Em aberto no ERP" e para a Ficha. Com um escopo só, o total do Início bate com a aba.
  - O fictício ainda usa a carteira.
- **Valor de cada destaque:**
  - Pararam: perda mensal.
  - Menos e mais: semestre menos o semestre do ano anterior.
  - Novos: faturado desde então.
  - Os itens de "mais" e "novos" não aparecem em nenhuma tela. Proposta: a resposta leva só as contagens e os totais deles.
- **Calendário.** `SGI5_TAB_DP_CALEND` tem 790 linhas pelas estatísticas (ABC71-SGI5-TAB_DP.md:77) e precisa cobrir o ano anterior inteiro. Data sem linha cai para segunda a sexta, como `web/src/calendario.ts:24`.

## 3. Clientes

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Carteira | "N clientes na carteira" (Clientes.tsx:67) | Clientes com `VEND_1` igual ao código da sessão (decidido em 2026-10-09) | `CRCL.EMP_FIL`, `CLIENTE`, `VEND_1` | extrator |
| Código | "Ribeirão Preto/SP · 123456780001" ou "Bauru/SP · Pessoa física" (Clientes.tsx:133; formato.ts:116) e busca | Empresa: o código do ERP. Pessoa física: nenhum, porque o código dela é o CPF (decisão do Lucas em 2026-10-13) | `CRCL.CLIENTE`, só com `FIS_JURID = 'J'` | extrator |
| Identificador | URL `/clientes/:codigo`, rascunhos e pedidos | Id opaco para todos os clientes (decidido em 2026-10-13); nunca aparece na tela | nenhuma; gerado na LAN | extrator |
| Nome | Título da linha, busca, ordem A–Z | Fantasia; se vazio, razão social; razão completa quando o fantasia vem cortado | `CRCL.NOM_FANTAS`, `RAZ_SOCIAL`, `COMPLEM_RZ` | extrator |
| Cidade e UF | "Ribeirão Preto/SP" | Nome do IBGE pelo código de `RESERVADO7` (a confirmar); sem ele, `TRIM(CIDADE)`. Exterior: "EX" | `CRCL.CIDADE`, `ESTADO`, `RESERVADO7` | extrator |
| Situação | Selo e filtros com contagem (Clientes.tsx:24-30, 69-74 e 136-138) | Ver Análises | NFME, NFDE, VEPM, VEPD | extrator |
| Última compra | "há 12 dias", com a data na dica | Última nota válida, no histórico inteiro; nulo se nunca comprou | `MAX(NFME.DT_EMISSAO)` com a RF | extrator |
| Faturado 12 meses | Coluna e ordem de abertura, no navegador (Clientes.tsx:41 e 54) | RF dos 12 últimos meses fechados, sem o corrente | NFME, NFDE | extrator |
| Variação | Coluna, ordenável pelo título (Clientes.tsx:38 e 100-102) | 12 meses ÷ 12 meses anteriores − 1; nulo com base pequena | NFME, NFDE | extrator |
| Tendência | Minigráfico de 13 pontos (Clientes.tsx:150-152) | Faturado em 12 meses recalculado no fim de cada mês fechado, de um ano atrás até o mês passado | NFME, NFDE | extrator |
| Busca, filtros e ordem | Campo, botões e títulos das colunas (Clientes.tsx:54 e 86-110) | Sobre a lista recebida | nenhuma | navegador |

- **Carteira (decidida em 2026-10-09; filtro de empresa e exclusões ainda em aberto).**
  - Clientes da `CRCL` com `VEND_1`, o campo vendedor do cliente, igual a um dos códigos da sessão. Proposta: também `EMP_FIL = 20210001`.
  - É a mesma regra que a LAN usa na revalidação do pedido, "o cliente é de um dos códigos do login" (plano.md:173).
  - A tela Representantes - Clientes do SGI usa `VEND_1` de representante com `FIN_STA = 'ATIVO'` e `TRIM(FIS_JURID) = 'J'`, sem filtro de EMP_FIL (`Representantes - Clientes {REPCLI}/untDmVenRepCli.dfm:626-631`). A exportação para os representantes usa o mesmo filtro (`untDmRepAbd.dfm:159-164`). Incluir pessoa física diverge do SGI.
  - Há pessoa física com vendedor. A contagem de 2026-10-09 no banco, só de quantidades e sem dado pessoal, achou 196 clientes com `FIS_JURID = 'F'` e vendedor, 46 deles com venda nos últimos 24 meses. Pessoa jurídica com vendedor: 17.602, das quais 3.469 com venda em 24 meses. Segue em aberto se a pessoa física entra, junto com o código do cliente (perguntas 17 e 18).
  - O cliente transferido aparece só para o dono atual, com todo o histórico.
  - A pessoa física fica na carteira, com o nome e sem o código do ERP (decisão do Lucas em 2026-10-13). O SGI faz diferente: tira a pessoa física da tela e da exportação para os representantes.
  - Ficam em aberto as exclusões: `CLI3_STA` inativo, `TIPO_CAD` diferente de 'C' e cliente sem compra há anos.
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
  - `CRCL.RESERVADO7` deve ser o código IBGE. Pistas da GNRE:
    - ela lê `RESERVADO7` como código da cidade do cliente (`untDmContGnre.dfm:348-352`);
    - ela manda como município `Copy(CLI_CCI,3,5)` (`untContGnre_Gnre.pas:496`), e `CLI_CCI` vem de `POS_CLI_CCI` (`untContGnre_GnreGerarXML.pas:410`), que é `B.RESERVADO7` (`untDmContGnre.dfm:348-349`). É o formato do código IBGE de 7 dígitos: 2 da UF e 5 do município.
  - Se for, o extrator usa o nome da base pública do IBGE (`CRM-prototipo/data/geo`) e cai para `CIDADE` quando o código faltar. `TPMU.NOME_CIDADE` não resolve, porque também é CHAR(20) (omega/ABC71-TP.md:3066).
  - O código fica na LAN. Só o nome vai para a foto, até a F6.
  - Cliente do exterior vem com `ESTADO='EX'` e o país em `COD_PAIS`, que é um número (licoes.md:98; omega/ABC71-CR.md:1079). Proposta: a tela mostra "EX" na UF. Se a pergunta 5 decidir mostrar o país, o nome vem de `ABC71.TGPA.NOME_PAIS` por `COD_PAIS` (omega/ABC71-TG.md:437-455). A confirmar na F2: qual EMPRESA/FILIAL usar e se 12 = Uruguai e 10 = Paraguai (licoes.md:98).
- **Variação.** O piso de R$ 2 mil que deixa a variação nula existe só no fictício (ficticio.ts:364). O plano diz só "dados insuficientes" (plano.md:243).
- **Tendência.** Exige 24 meses fechados de notas.

## 4. Ficha do cliente

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Nome e situação | Título e selo (FichaCliente.tsx:50-51) | Como em Clientes | (ver Clientes) | extrator |
| Razão social | Linha abaixo do nome, que some quando é igual a ele, como na pessoa física (FichaCliente.tsx:52) | `RAZ_SOCIAL` + `COMPLEM_RZ` | `CRCL.RAZ_SOCIAL`, `COMPLEM_RZ` | extrator |
| Cidade, Mercado e Código | Cartões (FichaCliente.tsx:99-101) | Mercado: M = montadora, E = exportação, o resto é praça. Código: como em Clientes, "Pessoa física" sem número | `CRCL.TIPO_CLI`; código: `CRCL.CLIENTE` só de empresa | extrator |
| Cliente desde | Só o ano (FichaCliente.tsx:102) | Ano da primeira nota válida da história; nulo se nunca comprou | `MIN(NFME.DT_EMISSAO)` com a RF | extrator; vai só o ano |
| Faturado em 12 meses | Indicador, com "vs 12 meses anteriores" | Como em Clientes | NFME, NFDE | extrator |
| Última compra | Indicador | Como em Clientes | NFME | extrator |
| Ciclo de compra | "N dias" ou "Irregular" (FichaCliente.tsx:136-141) | Mediana dos intervalos entre eventos de compra em 24 meses | `NFME.DT_EMISSAO` | extrator |
| Pedidos em aberto (indicador) | Soma e "N pedidos", ou "Nenhum" | Soma da lista: pedidos do cliente atribuídos ao representante | VEPM, VEPD | navegador |
| Faturamento mensal | 24 meses fechados e o mês corrente | RF por mês; mês sem compra = 0 | NFME, NFDE | extrator |
| Famílias compradas | Barras com valor e % (12 meses), do maior valor para o menor (FichaCliente.tsx:69) | RF por família nos mesmos 12 meses do faturado | NFDE, família do produto | extrator |
| Produtos mais comprados | Produto, família, peças, valor, última compra (FichaCliente.tsx:217-225) | Os 8 maiores em valor nos 12 meses | Peças: `TRIM(NFDE.C_PROD)`, `QTDE`, `UNIDADE`. Valor: `NFDE.VLR_TOTAL − Z_FRANCA_DESC` com a RF. Última compra: `NFME.DT_EMISSAO`. Família: `PAC_GRC` → `GRP_DES` | extrator, já com o corte em 8 |
| Pedidos em aberto (lista) | Pedido, emissão, entrega, itens, valor, abre da entrega mais próxima para a mais distante, ordenada no navegador (FichaCliente.tsx:243-246) | Pedidos do cliente atribuídos ao representante. Ver Pedidos | VEPM, VEPD | extrator |
| Oportunidades de mix | Família e "X% dos clientes parecidos compram" | Ver Análises | NFDE, CRCL | extrator |
| Com quem comparou | "mercado Praça, porte médio" ou "Poucos clientes parecidos" | Ver Análises | CRCL, NFDE | extrator |
| Novo pedido | Botão para Montar pedido (FichaCliente.tsx:88) | Leva o código do cliente | nenhuma | navegador |

- **Razão social.** O SGI concatena `TRIM(A.RAZ_SOCIAL||A.COMPLEM_RZ)` (`untDmCrmCli.dfm:32`). Como `RAZ_SOCIAL` é CHAR(35), o extrator junta direto só quando ela ocupa os 35 caracteres. Nos outros casos, separa com um espaço. Quando a razão é igual ao nome mostrado, a ficha pode omitir a linha.
- **Família do produto.**
  - É o nome do grupo de custo de nível 2: `SGI5_TAB_CUS_V3_GRP.GRP_DES` (FLEXIL, PRESIL, TUCHO…; familias.md:9-34).
  - Há dois caminhos até ela:
    - `SGI5_TAB_ENG_PAC.PAC_GRC`, que tem FK para `GRP_GRP` e uma linha por produto;
    - os 4 primeiros dígitos de `ESTQ.GRUPO` seguidos de `0000`, a regra do Gestao (`produtosAcabados.ts:78-81`).
  - Os dois bateram em 100% das vendas de três famílias desde 1994 (licoes.md:99).
  - Proposta: `PAC_GRC`, com a regra do Gestao como conferência na F2.
  - A mesma regra vale para a Ficha, o mix e o catálogo. Senão, "Já comprados" e o mix deixam de bater.
- **Peças por mês.** `FaturamentoMensal.pecas` não aparece em nenhuma tela (FichaCliente.tsx:61), então sai do contrato. As peças por mês ficam no extrator, para a variação em peças das Análises.
- **Cliente sem compra em 12 meses.** Famílias e produtos ficam vazios. O fictício usa 1/3 dos 36 meses (ficticio.ts:375), o que é só um marcador de lugar.
- **Cliente que nunca comprou.** Ele existe na carteira como inativo (analises.ts:43), e Clientes já mostra "sem compras" (Clientes.tsx:141). Corrigido em 2026-10-09: a Ficha quebrava com a primeira compra nula. Agora o contrato leva só o ano, `clienteDesde: number | null` (tipos.ts:86-87), e o cartão mostra "—" quando ele é nulo (FichaCliente.tsx:102).
- **Ciclo.** Pelo plano (plano.md:221), o extrator usa os intervalos em dias entre eventos. Exige pelo menos 4 compras. Fora de 30 a 180 dias, o valor é nulo (irregular). O fictício prende o valor entre 30 e 180 e conta meses × 30,4 (ficticio.ts:338-347).
- **Pedidos em aberto (decidido em 2026-10-09, pergunta 22).** A ficha mostra só os pedidos do cliente atribuídos ao representante da sessão, como em Pedidos. O pedido do cliente atribuído a outro representante não aparece. Pela proposta da pergunta 26, ele ainda impede "parado" (ver Análises). Por isso a ficha pode mostrar "Nenhum" em pedidos em aberto num cliente que não está parado.
- **Auditoria.** Abrir a ficha é evento auditado (plano.md:153). O registro leva o código opaco, nunca o nome.

## 5. Análises

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Semestre comparado | Títulos das colunas de Comprando menos e mais (Analises.tsx:113-117) | Os 6 últimos meses fechados e os mesmos do ano anterior | data da foto | extrator |
| Cliente | Primeira coluna de todas as listas: nome e cidade/UF, com link para a ficha (Analises.tsx:211-222) | Como em Clientes | (ver Clientes) | extrator |
| Pararam de comprar | Lista, contagem e resumo (Analises.tsx:65-98) | Ordem pela perda mensal | NFME, VEPM, VEPD | extrator |
| Última compra | Coluna da lista Pararam (Analises.tsx:67) | Como em Clientes | `MAX(NFME.DT_EMISSAO)` com a RF | extrator |
| Ciclo típico | Coluna da lista Pararam | Ver Ficha | `NFME.DT_EMISSAO` | extrator |
| Deixou de entrar por mês | Coluna e soma no resumo | Média dos 12 meses até o mês da última compra | RF mensal | extrator; soma do resumo: navegador (Analises.tsx:87); no Início, servidor |
| Comprando menos e Comprando mais | Listas, contagem e resumo | Ver regras abaixo | RF mensal de 18 meses | extrator |
| Semestre, ano anterior e diferença | Colunas | Soma da RF nos dois períodos | NFME, NFDE | extrator; diferença e soma do resumo: navegador (Analises.tsx:118, 128 e 233-235) |
| Variação | Coluna | Semestre ÷ ano anterior − 1 | (derivado) | extrator |
| Em peças | Coluna e a nota sobre reajuste (Analises.tsx:120 e 137) | Peças ÷ peças do ano anterior − 1; nulo quando o ano anterior tem 0 | `NFDE.QTDE`, `UNIDADE` | extrator |
| Novos e reativados | Lista com selo e contagens | Ordem pelo faturado desde então | NFME | extrator; contagem de novos e de reativados: navegador (Analises.tsx:143 e 155) |
| Desde | Data relativa | Primeira compra (novo) ou compra da volta (reativado) | `NFME.DT_EMISSAO` | extrator |
| Faturado desde então | Coluna e soma | RF do mês de "desde" até hoje | NFME, NFDE | extrator; soma do resumo: navegador (Analises.tsx:156) |
| Oportunidades de mix | Lista com contagem (Analises.tsx:169-206) | Fora de parado e inativo, com sugestão; ordem pelo faturado em 12 meses | NFDE, CRCL | extrator |
| Faturado 12 meses | Coluna da lista de mix (Analises.tsx:189) | Como em Clientes | NFME, NFDE | extrator |
| Comparado a | "Praça, porte médio" ou "mercado todo" | Faixa usada na comparação | `CRCL.TIPO_CLI` e RF de toda a Suprens | extrator |
| Famílias a oferecer | Família e % | Ver regras abaixo | NFDE e família do produto | extrator |

As regras são as de `analises.ts` e `mix.ts`, que têm testes, e o extrator precisa chegar aos mesmos resultados (plano.md:235). Duas partes ainda estão fora de `analises.ts`:
- Quem entra em cada lista está só em `montarAnalises`, no fictício (`ficticio.ts:493-536`), sem teste. Antes da F2, essa montagem vai para `analises.ts`, com teste. A ordem de abertura é da tela (Analises.tsx:94, 106-109, 135, 163 e 202) e só importa ao servidor nos 5 primeiros do Início.
- Os grupos por raiz de CNPJ (plano.md:244).

Regras:
- **Situação**, por precedência (analises.ts:41-48):
  1. inativo: nunca comprou ou está há mais de 730 dias sem comprar;
  2. parado;
  3. novo;
  4. em risco: comprando menos;
  5. ativo.
  - Reativado não é situação própria.
  - A situação não é o status cadastral (`CLI3_STA`), que decide carteira e aceite de pedido.
- **Evento de compra:** notas do mesmo cliente com até 7 dias de diferença contam como uma compra (plano.md:220). O fictício não aplica a regra (ficticio.ts:256).
- **Parou de comprar:**
  - dias sem comprar acima do maior entre 60 e 2× o ciclo, ou 180 se o cliente é irregular;
  - sem pedido em aberto;
  - até 730 dias (analises.ts:55-65; plano.md:222-225).
- **Pedido em aberto que impede "parado":** `VEPD.SALDO > 0` nos tipos de venda, com `VEPM` não bloqueado. É a regra da carteira do Gestao (`Gestao/server/src/pcp/emAberto.ts:58-71`). Proposta, a confirmar (pergunta 26): conta qualquer pedido em aberto do cliente, de qualquer representante, porque Análises é visão do cliente e a conta é da LAN. Falta decidir se contam o pedido ainda no SGI e o pedido enviado pelo CRM.
- **Perda mensal:** soma dos 12 meses até o mês da última compra, inclusive, ÷ 12 e arredondada (analises.ts:67-73).
- **Comprando menos e mais** (analises.ts:75-98; plano.md:228-232):
  - base de R$ 3 mil no semestre do ano anterior;
  - pelo menos 3 compras nos dois períodos;
  - variação de 20% ou mais e diferença de R$ 2 mil ou mais.
  - Listas só no fictício (`ficticio.ts:517-524`); a ordem de abertura é a da tela (Analises.tsx:106-109 e 135):
    - "menos" é quem está em risco, ordenado pela diferença mais negativa;
    - "mais" é quem está fora de parado, inativo e novo, ordenado pela maior diferença. O plano não diz que "mais" exclui o cliente novo (plano.md:228-232): confirmar com o Lucas.
- **Novo e reativado** (analises.ts:100-113; plano.md:234):
  - novo: primeira compra há até 365 dias;
  - reativado: alguma compra dos últimos 365 dias veio depois de 365 dias ou mais sem comprar;
  - só entram clientes fora de parado e inativo (`ficticio.ts:493 e 525-530`).
  - O "faturado desde então" existe só no fictício (ficticio.ts:540-544).
- **Mix** (mix.ts; plano.md:236-242):
  - O porte é o tercil do faturado em 12 meses entre os clientes ativos do mesmo mercado, em toda a Suprens.
  - Com menos de 20 clientes na faixa, compara com o mercado inteiro. Com menos de 20 no mercado, não há comparação.
  - Sugere a família comprada em 12 meses por pelo menos 50% dos parecidos e que o cliente não compra há 24 meses. A ordem é da maior penetração para a menor, com empate pelo nome.
  - A conta usa todos os clientes da Suprens, na LAN. Para a foto vão só a família, o percentual e a faixa usada.
  - A lista de mix leva quem está fora de parado e inativo e tem sugestão, ordenada pelo faturado em 12 meses (`ficticio.ts:531-536`).
- **Grupos (regra do plano.md:244; o tratamento das filiais em carteiras diferentes é proposta a decidir, pergunta 19):**
  - Filiais da mesma raiz de CNPJ são analisadas juntas, para a compra que muda de filial não virar "parado" nem "novo".
  - A raiz é calculada na LAN e não vai para a foto.
  - O extrator e `analises.ts` precisam da mesma regra, com teste.
  - O valor somado do grupo (faturado, primeira compra) só aparece numa filial quando todas as filiais do grupo estão na carteira do mesmo representante. Senão, mostrar ao representante A o valor do grupo revela as compras da filial que é de B, o que vai além da visão do cliente (plano.md:206).
  - Nos outros casos, a filial mostra só os próprios números, e o grupo serve só para não marcar parado, novo ou reativado.
  - A conta é por código, porque o extrator não conhece os logins. Um grupo com filiais no 1401 e no 1402 do mesmo login não soma. É o caminho mais seguro; se fizer falta, a F2 revê.
- **Alerta rápido de queda (plano.md:233):** não tem tela, campo em `tipos.ts` nem implementação. Fica fora da foto até haver tela.
- **Sem tela:** `ClienteParado.diasSemComprar` (tipos.ts:131) não aparece em nenhuma tela e sai do contrato.

## 6. Pedidos (abas)

**Enviados pelo CRM**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Número CRM | "CRM-00106" (Pedidos.tsx:97) | Gerado no envio, sequencial, nunca reutilizado | vai para `PV1_LR1` (a confirmar) | app.db |
| Cliente | Nome abaixo do número | O app.db guarda o código; o nome vem da foto atual | (foto) | servidor |
| Enviado em | "Enviado hoje, 16:42" | Relógio do servidor em Brasília | nenhuma | app.db |
| Situação | Selo da etapa (Pedidos.tsx:99) | Ver Detalhe do pedido | `PV1_STA`, `VIEW_STA_FAT` | extrator; "enviado": app.db |
| Total | Total do SGI com "no SGI", ou a estimativa com "estimado" (Pedidos.tsx:100-110) | Ver Detalhe do pedido | `SGI5_TAB_VEN_PV2_V2` | extrator e app.db |

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
| Cliente | Nome e link para a ficha | Cliente do pedido. Nome e link só se o cliente é da carteira do representante (ver abaixo) | `VEPM.CLIENTE` = `CRCL.CLIENTE` na mesma EMP_FIL | extrator; nome: servidor, por junção com `cliente` do representante da sessão |
| Emissão | Data | Data do pedido | `VEPM.DT_PED` | extrator |
| Entrega | Prazo relativo; a lista abre ordenada por ela, no navegador (Pedidos.tsx:171) | Menor entrega entre os itens com saldo (proposta) | `VEPD.DT_ENTREGA` | extrator |
| Itens | Contagem | Linhas com saldo (proposta) | `VEPD.SEQUENCIA`, `SALDO` | extrator |
| Valor | Coluna | Saldo × preço com descontos e Zona Franca (proposta), sem IPI | `VEPD.SALDO`, `VLR_UNIT`, `PORC_DESC*`; `VEPM.Z_FRANCA_DESC` | extrator |

**Faturados (visão do representante, a confirmar)**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Nota | "NF 123456", com o cliente (Pedidos.tsx:195) | Notas de venda dos últimos 45 dias atribuídas aos códigos do login (decidido em 2026-10-13), da mais recente à mais antiga (ordem de abertura no navegador, Pedidos.tsx:193). Os 45 dias estão no texto da tela (Pedidos.tsx:186, 188 e 192) e no fictício (ficticio.ts:148); o plano não fixa janela (plano.md:198). A confirmar | `NFME.N_FISCAL`, `SERIE` | extrator |
| Emissão | Data relativa | | `NFME.DT_EMISSAO` | extrator |
| Cliente | Nome e link para a ficha | Cliente da nota. Nome e link só se o cliente é da carteira do representante (ver abaixo) | `NFME.FORNEC` → cliente | extrator; nome: servidor, por junção com `cliente` do representante da sessão |
| Valor | Coluna | RF da nota, sem IPI e sem ICMS-ST | `NFDE.VLR_TOTAL`, `Z_FRANCA_DESC` | extrator |

- **Pedido em aberto.**
  - É `VEPD.SALDO > 0` com `VEPD.TIPO_MOVTO` nos 7 tipos de venda e `NVL(TRIM(VEPM.BLOQUEADO),'N') <> 'S'` (emAberto.ts:58-71).
  - O protótipo excluía 450, 305 e 430 em vez de filtrar pelos tipos de venda, um erro conhecido (CRM-prototipo/REGRAS.md:80-82).
- **Escopo dos pedidos em aberto (decidido em 2026-10-09, pergunta 22).**
  - Só os pedidos atribuídos ao representante, pela regra do Início: `VEPM.VENDEDOR`; se vier nulo ou 0, o dono do cliente pelo `VEND_1` atual. A conta é da LAN, e a foto leva o representante em cada pedido.
  - O servidor lê `pedido_aberto` só pelo representante da sessão, nunca por vendedor vindo do navegador.
  - O pedido de cliente da carteira atribuído a outro representante não aparece. Pela proposta da pergunta 26, ele ainda impede "parado" (ver Análises).
  - O subtítulo da aba diz "Todos os pedidos da sua carteira" (Pedidos.tsx:163) e muda para falar dos pedidos do representante.
- **Pedido ou nota de cliente de outra carteira.** Pela atribuição, o representante pode ter um pedido ou uma nota de cliente que hoje é de outro (cliente transferido). Proposta, a confirmar com o Lucas (pergunta 33):
  - a linha aparece sem o nome, com o texto "Cliente de outra carteira", e sem link para a ficha, que responderia 404;
  - assim a foto não leva nome nem id de cliente de fora da carteira (`cliente` nulo), e o nome continua vindo só de `cliente` com o representante da sessão;
  - hoje toda linha das duas abas tem link para a ficha (Pedidos.tsx:169 e 191).
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
  - Nenhuma tela mostra a série. Corrigido em 2026-10-09: a lista usava só o número como chave, e duas notas de mesmo número em séries diferentes colidiam. Agora `NotaFaturada` tem um `id`, série e número (tipos.ts:285-287), que a lista usa como chave (Pedidos.tsx:190).
- **Rascunho ou pedido enviado de outro login:** responde 404 (plano.md:43).

## 7. Montar pedido

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Escolha do cliente | Nome, código, cidade, situação e última compra. Abre na ordem recebida, sem coluna marcada, e o representante reordena por Cliente, Situação e Última compra (MontarPedido.tsx:385-401) | Clientes da carteira | (ver Clientes) | extrator; ordem de abertura: servidor, por `faturamento_12m` decrescente; busca e reordenação: navegador (MontarPedido.tsx:371-373 e 392-400) |
| Cliente do pedido | Nome e cidade/UF no cabeçalho e no diálogo de envio (MontarPedido.tsx:96 e 151) | Cliente da carteira, pelo código da URL ou do rascunho | (ver Clientes) | extrator |
| Tabela de preço | O nome da tabela no cabeçalho e em "Preços da …" (MontarPedido.tsx:96 e 109). O fictício junta o mercado ao nome ("Tabela 23 · Praça", pedidosFicticios.ts:39); a tela real mostra só `cliente.tabela_preco` | Uma por cliente, escolhida pelo extrator, nunca pelo navegador | `SGI5_TAB_VEN_CLI.CLI_TAB` e `CLI_STA`; `SGI5_TAB_VEN_TP1.TP1_NOM` | extrator |
| Catálogo | Abas "Já comprados" e "Todos", com contagem | Só produto vendável e com preço para o cliente | view de preço líquido, ESTQ, view de produto sem árvore | extrator |
| Código do produto | Título da linha | `TRIM(VIEW_PAC)` | `SGI5_VIEW_VEN_TP2_VLR_LIQ_CLI.VIEW_PAC` | extrator |
| Família | Descrição e busca | Mesma regra da Ficha | `PAC_GRC` → `GRP_DES` | extrator |
| Medida | "8–12 mm" na descrição e na busca | Faixa de aperto em mm | `PAC_DMI_MM`, `PAC_DMA_MM` (a confirmar) | extrator |
| Código no cliente | "no cliente: X" na descrição e na busca | Part number formatado; sem ele, o part number; '0' vira nulo | `VIEW_PNU_FOR`, `VIEW_PNU` | extrator |
| Embalagem | "100 pç" e o passo do campo de quantidade | Peças por embalagem | a confirmar: `EAN_QTD`, `VIEW_MVE` ou `TR1_QPE` | extrator |
| Cento | Preço do cento, só referência | Preço líquido do cliente por CT, sem IPI | `VIEW_VLR_LIQ` | extrator |
| Já comprou | Separa as abas | Produto comprado pelo cliente na janela (12 ou 24 meses) | `TRIM(NFDE.C_PROD)` com a RF | extrator (`catalogo.ja_comprou`) |
| Quantidade | Peças, de embalagem em embalagem | Múltiplo da embalagem | nenhuma | app.db |
| Valor do item | Ao lado da quantidade (MontarPedido.tsx:276) | Peças ÷ 100 × cento | (foto) | navegador |
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
- **Part number.** A PK da `SGI5_TAB_VEN_TP2` inclui o part number (TP2_COD, TP2_PRO, TP2_CMO). O mesmo produto pode aparecer mais de uma vez na tabela, mas o CRM indexa só pelo código (MontarPedido.tsx:237).
- **O navegador nunca manda preço, tabela nem representante.** `RascunhoParaSalvar` tem só id, código do cliente, itens, entrega e observação (tipos.ts:211-217). O servidor confere:
  - cliente na carteira;
  - produto no catálogo do cliente;
  - quantidade inteira, positiva e múltipla da embalagem;
  - limite de itens;
  - schema estrito.
- **Rascunho com produto que saiu do catálogo** (deixou de ser vendável ou perdeu o preço entre duas fotos).
  - A tela carrega as quantidades de todos os itens do rascunho (MontarPedido.tsx:66-67), mostra só os que estão no catálogo (MontarPedido.tsx:74) e reenvia todos em cada salvamento automático (MontarPedido.tsx:172-174).
  - Com a validação "produto no catálogo do cliente", o servidor recusaria o rascunho inteiro em todo salvamento.
  - A aba Rascunhos conta esse item em "N produtos" (Pedidos.tsx:132), e o total estimado não tem preço para ele (pergunta 33).
- **URL do catálogo.** O catálogo é pedido pelo código do cliente na URL (`/pedidos/novo?cliente=`). Com o id opaco, a query string deixa de levar o CNPJ e, na pessoa física, o CPF.
- **Quantidade.** A única conversão é peças ÷ 100 = CT (pedido.ts:8-9 e 23-25). Ela acontece na LAN, ao montar o arquivo do SGI.
- **Entrega.**
  - Na carga atual, a data do arquivo (`CGA_DEN` → `DET_DEN`) vai para o `PV2_DEN` de cada item (`untDmVenPvd.dfm:6163-6164`; `untVenPvd_PvdIncluirCarga.pas:770-778`). O `PV1_DEN` recebe a data do dia (`untDmVenPvd.dfm:6013-6014`; `untVenPvd_PvdIncluirCarga.pas:685-688 e 704`).
  - A data do arquivo só vale quando quem carrega escolhe PROGRAMADA no combo `cbTen`. Com IMEDIATA, a carga grava hoje no PV1 e no PV2.
  - A carteira que o CRM lê também usa a entrega do item (`VEPD.DT_ENTREGA`).
  - A tela do SGI exige no mínimo hoje+7 para os tipos 310, 315, 316 e 317 com entrega PROGRAMADA (OracleDB/docs/modulos/pedidos-venda.md:33). A confirmar para o layout CRM (pergunta 40).

## 8. Detalhe do pedido

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Número CRM | "Pedido CRM-00106" (DetalheDoPedido.tsx:35) | | nenhuma | app.db |
| Cliente | "Para <cliente>" com link | O nome vem da foto atual | (foto) | servidor |
| Enviado em | "Enviado hoje, 16:42" | Relógio do servidor | nenhuma | app.db |
| Itens | Código, família · medida, peças, cento e valor | Cópia do catálogo da foto no envio | (foto) | app.db; valor da linha: navegador (DetalheDoPedido.tsx:64; pedido.ts:33-35) |
| Entrega e observação | Só quando preenchidas | Cópia do rascunho, imutável | nenhuma | app.db |
| Estimativa do CRM | Total | Σ congelada no envio e calculada pelo servidor | (foto) | app.db |
| Total no SGI | Ao lado da estimativa | Σ `PV2_QTD` × `PV2_VLR_VEN`, sem IPI | `SGI5_TAB_VEN_PV2_V2` | extrator |
| Etapa atual | Selo | Ver tabela abaixo | `PV1_STA`, `VIEW_STA_FAT` | extrator |
| Andamento | Data e hora de cada passo (DetalheDoPedido.tsx:109-127) | Ver tabela abaixo | `PV1_DCA`, `PV1_DLB_*`, `PV1_DCO`, `NFME.DT_EMISSAO` | extrator; "enviado": app.db |
| Número no SGI | "Número no SGI: N" no passo Recebido | `PV1_NPE` da linha com `TRIM(PV1_LR1)` igual ao número CRM | `PV1_NPE`, `PV1_LR1` | extrator |
| Número no ERP | "Número no ERP: N" no passo No ERP | `VEPM.NUMERO` = `PV1_NPE` | `VEPM.NUMERO` | extrator |
| Motivo da recusa | Texto no passo Recusado (DetalheDoPedido.tsx:138-139) | Código de uma lista fechada; na recusa por item, mais o código do produto | registro da LAN | extrator |

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
- **Recebido e em aprovação.** Com a proposta acima, o número do SGI só aparece quando o pedido chega a "em aprovação". A tela já o mostra sob o passo Recebido quando ele existe (DetalheDoPedido.tsx:133).
- **Número no SGI e no ERP são o mesmo.** A tela do SGI liga `VEPM.NUMERO = PV1_NPE` (`untDmVenPvd.dfm:539-540`; pedidos-venda.md:15). Os fictícios sorteiam números diferentes (pedidosFicticios.ts:192-193). Proposta: um campo só.
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
  - A recusa por cliente inativo no SGI (`CLI3_STA`) sai com texto genérico. A LAN não recusa por crédito, porque não lê a restrição financeira (pergunta 16).
  - A tela de hoje mostra uma frase que cita o produto ("O produto X saiu de linha…", pedidosFicticios.ts:195). A recusa por item (fora de linha, sem preço, fora do catálogo) leva o código do produto em `pedido_crm.motivo_produto`, único parâmetro da frase fixa. Nenhum outro texto variável entra.
- Não extrair `PV1_ULB_*`, `PV1_JCA`, `PV1_JLB_CRE`, `PV1_JUS_BPV`, `PV1_LIM_CRE`, `PV1_TIT_ABE`, `PV1_PED_ABE`, `PV1_VLR_PED`, `PV1_TRA_*` nem `LOG_USU`.

## 9. Entrar e Convite

**Entrar**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Chave de acesso | "Entrar com chave de acesso" (Entrar.tsx:42-50) | rpID igual ao domínio, verificação do usuário, chave residente, sem atestação (plano.md:136-140) | nenhuma | app.db |
| Motivo da saída | "Você saiu", "60 minutos sem uso", "limite de 12 horas" | `?motivo=` com saiu, inatividade ou limite; sessão de 60 min sem uso e 12 h no máximo (plano.md:144) | nenhuma | app.db |
| Aviso de registro | "Os acessos ao CRM são registrados." (TelaDeAcesso.tsx:20-23) | Texto fixo | nenhuma | navegador |

**Convite**

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Saudação | "Olá, Carlos Andrade" (Convite.tsx:43) | Só com token válido, por rota pública | (foto: representante) | servidor |
| Validade | "vale até 10/10 às 16:42" (Convite.tsx:71) | Gravada na criação, 24 a 48 h | nenhuma | app.db |
| Estado do convite | "Convite expirado", "já usado", "Link incompleto" | Uso único; consumido só depois que a chave é criada (plano.md:133) | nenhuma | app.db |
| Navegador de aplicativo | Aviso com "Copiar link" (Convite.tsx:76-100) | `userAgent`, sem enviar nem guardar | nenhuma | navegador |
| Chave criada | Tela de conclusão | Grava a chave pública | nenhuma | app.db |

- **Rota do Convite.** Hoje o Convite chama `carregarSituacaoDosDados` (Convite.tsx:28), que vai exigir sessão na F3. O Convite precisa de uma rota pública que confere o hash do token e devolve só o nome e a validade.
- **Validade.** Hoje é calculada no navegador como agora + 48 h (Convite.tsx:15 e 31). Passa a vir do servidor.
- **Texto do convite expirado.** Ele cita 48 horas fixas (Convite.tsx:126). Se a validade variar de 24 a 48 h, o texto deixa de citar o prazo ou usa a validade gravada no app.db.
- **Token.** Vai depois do `#` (plano.md:132) e o banco guarda só o hash. Há limite de requisições por IP (plano.md:92).

## 10. Mapa (F6, não construída)

O plano prevê (plano.md:199-202):
- porte do mapa do protótipo, na visão do cliente (plano.md:206);
- só a carteira do representante, sem as classes que olham os outros representantes (decidido em 2026-10-09);
- código IBGE do município;
- correção dos 48 nomes antigos;
- valores ocultos também nos tooltips.

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Município do cliente | Área do mapa | Código IBGE de 7 dígitos | `CRCL.RESERVADO7` (a confirmar) | extrator |
| Nome e desenho do município | Rótulos e contornos | Base pública do IBGE (`CRM-prototipo/data/geo`) | não é ERP: arquivo estático | servidor |
| Faturamento por área | Cor da área | Soma da RF dos clientes da carteira na área | (foto: cliente, cliente_mes) | servidor |
| Clientes da área | Lista no tooltip | Nome, faturamento e última compra | (foto: cliente) | servidor |
| Classe da área | Vazia, fria, fraca, saudável ou forte (CRM-prototipo/REGRAS.md) | Vazia: sem cliente da carteira, mesmo que outro representante tenha cliente ali; fria: tem cliente da carteira, mas sem faturamento; fraca: menos de 15% da média; forte: 75% da maior | (derivado) | extrator, gravada por representante × município na tabela do mapa da F6 (plano.md:63) |

- **Classes que olham os outros representantes (decidido em 2026-10-09, pergunta 34).**
  - "Atendida" e "carteira de outros" saem do mapa. Elas precisavam de dado de fora da carteira, e mesmo um sinal por município revela onde os outros representantes têm clientes (plano.md:35 e 241).
  - O mapa mostra só a carteira do representante (plano.md:199). Nada de outros representantes entra na tabela do mapa.
- **Escopo.** O protótipo somava as vendas atribuídas ao representante (`CRM-prototipo/server/src/mapa.ts:295`). O plano põe o Mapa na visão do cliente.
- **Município na foto.** A coluna do município só entra na foto com a F6.

## 11. Admin (só LAN, não construída)

O plano prevê representantes, convites, chaves, auditoria e situação das cargas (plano.md:203).

| Dado | O que a tela mostra | Regra | Origem no ERP | Onde é calculado |
|---|---|---|---|---|
| Usuários | Lista, criar e desativar; ligar e desligar códigos | O usuário tem nome e os códigos escolhidos entre os autorizados da foto; o login puxa todos | (foto: representante) | app.db |
| Convites | Gerar, validade e uso | Uso único, 24 a 48 h | nenhuma | app.db |
| Chaves | Por provedor (Google, Apple, Windows) e revogar | plano.md:140 e 150 | nenhuma | app.db |
| Auditoria | Eventos | plano.md:152-156 | nenhuma | app.db |
| Situação das cargas | Foto atual (hora, versão, contagens), trocas e recusas | Manifesto e eventos "foto trocada ou recusada" | (foto: tabela `foto`) | app.db |

- **Lista dos representantes autorizados.** Hoje não tem dono. Proposta:
  - um arquivo na LAN, mantido pelo Lucas e lido pelo extrator;
  - a foto leva só esses representantes;
  - o Admin escolhe o código entre eles.
- **Exceção à regra 4 do CLAUDE.md (decidida em 2026-10-13).**
  - Para ligar o login aos códigos, a rota de admin recebe do navegador o código do representante. É a única rota que recebe esse código.
  - A rota tem `config.acesso: 'admin'`, só existe na API de admin (vhost só da LAN, plano.md:75), confere o código contra a tabela `representante` da foto e grava auditoria.
  - Nenhuma rota `representante` ou `publico` aceita o código. A exceção já está no CLAUDE.md e entra no teste de escopo da F3.
- **Primeiro admin:** criado por linha de comando via SSH (plano.md:75).
- **Sem dados comerciais.** Não há perfil "vê tudo" (plano.md:23).

## Esquema proposto da foto

Convenções:
- **Datas:** texto ISO ('AAAA-MM-DD'), meses 'AAAA-MM' e momentos 'AAAA-MM-DDTHH:MM', todos gerados por `TO_CHAR` no Oracle (plano.md:67).
- **Cliente:** `cliente` é sempre o id opaco. `CRCL.CLIENTE` só aparece em `cliente.codigo_erp`, e só de empresa. O histórico de vendedores não aparece em nenhuma tabela.
- **Produto:** sempre o código com TRIM (`TRIM(NFDE.C_PROD)`, `TRIM(VIEW_PAC)`, `TRIM(PAC_COD)`, `TRIM(ESTQ.C_PROD)`). `NFDE.C_PROD` é CHAR(14) (omega/ABC71-NF.md:2833). Sem TRIM, a junção do "já comprou" falha. O Gestao lê `TRIM(D.C_PROD)` (moduloVendasEntradas.ts:48), e o SGI liga a view ao ESTQ com TRIM nos dois lados (`untVenPvd_PosPac.dfm:551-552`).
- **Escopo:** toda leitura do servidor parte de `cliente.representante`, `painel_mes.representante`, `pedido_aberto.representante` ou `nota.representante`, entre os códigos do login da sessão. Tabela sem a coluna `representante` só é lida por junção com `cliente`. O nome do cliente de um pedido ou de uma nota vem só de `cliente` com um dos códigos da sessão.
- **Pedido CRM:** `pedido_crm` e `pedido_crm_etapa` não têm cliente nem representante. O servidor só os lê pelo `numero_crm` de um pedido do usuário da sessão no app.db. Número CRM de outro login, ou inexistente, responde 404 (plano.md:43). Como o número é sequencial (CRM-00106, CRM-00107…), a rota `/pedidos/:numero` (App.tsx:28) entra no teste de escopo da F3.
- **Valores:** R$ com centavos. O arredondamento é da tela.

| Tabela | Grão e chave | Colunas | Telas |
|---|---|---|---|
| `foto` | Uma linha | `versao_esquema`, `gerada_em`, `data_ref`, `mes_atual`, `dia_util`, `dias_uteis`, `semestre_inicio`, `semestre_fim` | todas, Admin |
| `representante` | Representante autorizado; PK `codigo` | `codigo`, `nome` (o da CRVN, para o Admin escolher os códigos) | Admin |
| `cliente` | Cliente (filial) da carteira de um autorizado; PK `cliente` | `cliente`, `codigo_erp` (nulo na pessoa física), `representante`, `nome`, `razao_social`, `cidade`, `uf`, `mercado`, `situacao`, `ultima_compra`, `cliente_desde`, `ciclo_dias`, `faturamento_12m`, `variacao_12m`, `evolucao_12m`, `grupo_mix`, `tabela_preco`, `municipio_ibge` (só na F6) | Clientes, Ficha, Análises, Início, Pedidos, Montar pedido, Detalhe |
| `cliente_mes` | Cliente × mês (24 fechados + o corrente); PK (`cliente`, `mes`) | `cliente`, `mes`, `valor` | Ficha |
| `cliente_familia` | Cliente × família nos 12 meses fechados; PK (`cliente`, `familia`) | `cliente`, `familia`, `valor`, `participacao` | Ficha |
| `ficha_produto` | Cliente × produto, só os 8 maiores em valor nos 12 meses fechados; PK (`cliente`, `produto`) | `cliente`, `produto`, `pecas_12m`, `valor_12m`, `ultima_compra` | Ficha |
| `cliente_mix` | Cliente × família sugerida; PK (`cliente`, `familia`) | `cliente`, `familia`, `penetracao`, `ordem` | Ficha, Análises |
| `produto` | Produto que aparece em `catalogo` ou `ficha_produto`; PK `produto` | `produto`, `familia`, `medida` | Ficha, Montar pedido, Detalhe (cópia no envio) |
| `catalogo` | Cliente × produto vendável na tabela do cliente; PK (`cliente`, `produto`) | `cliente`, `produto`, `codigo_no_cliente`, `preco_cento`, `embalagem`, `ja_comprou` | Montar pedido; validação do rascunho e do envio |
| `analise_parado` | Cliente que parou de comprar; PK `cliente` | `cliente`, `perda_mensal`, `ordem` | Análises, Início |
| `analise_ritmo` | Cliente comprando menos ou mais; PK `cliente` | `cliente`, `direcao`, `semestre`, `semestre_ano_anterior`, `variacao`, `variacao_pecas`, `ordem` | Análises, Início |
| `analise_novo` | Cliente novo ou reativado; PK `cliente` | `cliente`, `tipo`, `desde`, `faturado_desde`, `ordem` | Análises, Início |
| `analise_mix` | Cliente da lista de mix; PK `cliente` | `cliente`, `ordem` | Análises |
| `painel_mes` | Representante × mês do ano corrente; PK (`representante`, `mes`) | `representante`, `mes`, `faturado`, `ano_anterior`, `ano_anterior_ate_dia_util` | Início |
| `pedido_aberto` | Pedido do Omega com saldo, atribuído a um representante autorizado; PK `pedido` | `pedido`, `representante`, `cliente`, `emissao`, `entrega`, `itens`, `valor`, `valor_entrega_no_mes` | Pedidos, Ficha, Início |
| `nota` | Nota de venda da janela da aba Faturados (45 dias, a confirmar), atribuída a um representante autorizado (pergunta 23); uma linha por nota; PK (`nota`, `serie`) | `nota`, `serie`, `representante`, `cliente`, `emissao`, `valor` | Pedidos |
| `pedido_crm` | Pedido enviado pelo CRM que a LAN já tratou; PK `numero_crm` | `numero_crm`, `etapa`, `numero_sgi`, `total_sgi`, `motivo_recusa`, `motivo_produto` | Pedidos, Detalhe |
| `pedido_crm_etapa` | Pedido CRM × etapa alcançada; PK (`numero_crm`, `etapa`) | `numero_crm`, `etapa`, `em` | Detalhe |

Colunas que pedem nota:
- `cliente.evolucao_12m`: texto JSON com 13 números, do mais antigo ao mais recente.
- `cliente.grupo_mix`: 'pequeno', 'medio' ou 'grande'. 'mercado' quando a comparação usou o mercado inteiro. Nulo quando nem o mercado tem 20 clientes.
- `cliente.situacao`, `ciclo_dias` e `variacao_12m`: nulos conforme as regras de Análises e Clientes.
- `cliente.cliente_desde`: só o ano (inteiro), que é o que a Ficha mostra (`FichaCliente.clienteDesde`). A data completa fica na LAN. Nulo quando o cliente nunca comprou, e então o cartão "Cliente desde" mostra "—".
- `cliente.uf`: `ESTADO`. Para o cliente do exterior, "EX", até a pergunta 5 decidir sobre o país.
- `cliente.tabela_preco`: nome da tabela (`TP1_NOM`, ou `TP1_COD` na falta).
- `ficha_produto`: o extrator já faz o corte dos 8. Peças, valor e última compra dos outros produtos não aparecem em nenhuma tela e ficam na LAN.
- `catalogo.ja_comprou`: 0 ou 1, calculado pelo extrator na janela da pergunta 28. É o que o Montar pedido usa (`ProdutoDoCatalogo.jaComprou`, tipos.ts:194; MontarPedido.tsx:212).
- `catalogo.embalagem`: fica no catálogo porque a fonte pode ser por tabela (`TP2_MVE`). Se for por produto (`EAN_QTD`), passa para `produto`.
- `painel_mes.faturado`: nulo nos meses que ainda não chegaram. `ano_anterior_ate_dia_util` só tem valor no mês corrente.
- `pedido_aberto.representante`: atribuído na LAN, `VEPM.VENDEDOR` ou, se vier nulo ou 0, o `VEND_1` atual do cliente. `VEPM.VENDEDOR` não vai para a foto.
- `nota.representante`: atribuído na LAN pela regra do faturamento (plano.md:219). `NFME.VENDEDOR` e o CRCLH não vão para a foto.
- `pedido_aberto.cliente` e `nota.cliente`: o id opaco quando o cliente é da carteira do representante atribuído; nulo nos outros casos, com a conta na LAN. A linha com cliente nulo mostra "Cliente de outra carteira" (proposta, pergunta 33).
- `pedido_aberto.pedido`: o número do Omega. Se houver mais de uma EMP_FIL com pedidos, a chave inclui a empresa.
- `pedido_aberto.valor_entrega_no_mes`: parte do valor com entrega até o fim do mês corrente, inclusive os vencidos.
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
  - clientes do Montar pedido por `faturamento_12m` decrescente (MontarPedido.tsx:385-401);
  - famílias da Ficha por valor decrescente (FichaCliente.tsx:66-70);
  - famílias sugeridas do mix pela coluna `ordem` de `cliente_mix` (FichaCliente.tsx:159-168);
  - os 5 primeiros de cada cartão do Início, na ordem da análise (Inicio.tsx:46 e 66);
- as demais tabelas o navegador ordena pelo título das colunas, com a ordem de abertura na própria tela (Clientes.tsx:41 e 54; Analises.tsx:94, 135, 163 e 202; Pedidos.tsx:95, 125, 171 e 193; FichaCliente.tsx:189-192 e 243-246). Empate mantém a ordem recebida (componentes/ordenacao.ts:22-23).
- total estimado do rascunho, na leitura; e o do envio, que fica congelado no app.db.

A tabela `catalogo` (cliente × produto) é a maior. O volume dela define o tamanho da foto e é medido na F2.

## O que fica no app.db

| Tabela | O que guarda | Telas |
|---|---|---|
| `usuarios` | id, papel (representante ou admin), nome da pessoa, ativo, identificador WebAuthn aleatório, criado em | todas, Admin |
| `usuario_codigos` | usuário, código do representante, ligado em, ligado por; um login tem um ou mais códigos | todas, Admin |
| `chaves` | id da credencial, usuário, chave pública, contador, provedor, criada em, último uso, revogada em | Entrar, Convite, Montar pedido, Admin |
| `convites` | hash do token, usuário, criado por, criado em, expira em, consumido em | Convite, Admin |
| `sessoes` | hash do token, usuário, chave usada, criada em, último uso, encerrada em e motivo | todas, Entrar |
| `auditoria` | momento, usuário, evento, alvo, resultado | Admin |
| `rascunhos` e itens | id aleatório, usuário, cliente (id opaco), entrega, observação, atualizado em; itens com produto e quantidade em peças | Pedidos, Montar pedido |
| `pedidos` e itens | número CRM, usuário, cliente, enviado em, entrega, observação, total estimado, hash do conteúdo, asserção da chave e id da chave; itens com produto, quantidade, cento, família e medida copiados da foto | Pedidos, Detalhe |
| sequência do número CRM | último número usado; nunca reutilizado | Pedidos |

- **Sessão** (plano.md:142-146): cookie `__Host-`, token de 256 bits, só o hash no banco.
- **Envio idempotente:** o mesmo rascunho não gera dois números CRM.
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
| `ABC71.CRCL` | EMP_FIL, CLIENTE, TIPO_CAD, NOM_FANTAS, RAZ_SOCIAL, COMPLEM_RZ, CIDADE, ESTADO, TIPO_CLI, FIS_JURID, VEND_1; RESERVADO7 só se a pergunta 5 confirmar o código IBGE; COD_PAIS só se a pergunta 5 decidir mostrar o país | Identidade, mercado, carteira, raiz para os grupos (calculada na LAN), nome da cidade e município | omega/ABC71-CR.md:965-1141 (PK 973; 981-988, 995-996, 1005, 1019, 1052, 1079, 1088); OracleDB/docs/licoes.md:97-101 | sim |
| `ABC71.CRCLH` | EMP_FIL, CLIENTE, SEQ_HIST, DT_HIST, CAMPO, HISTORICO | Dono do cliente na data da nota sem vendedor. Só na LAN | omega/ABC71-CR.md:1279-1300; pista em CRM-prototipo/server/src/repHistorico.ts:7-41 | sim; formato de HISTORICO a confirmar |
| `ABC71.CRVN` | EMP_FIL, VENDEDOR, NOME, NOME_CONH | Nome do representante, com `EMP_FIL = 20210001` | omega/ABC71-CR.md:5467-5488; untDmVenPvd.dfm:499-503 e 4976-5006 | sim |
| `ABC71.NFME` | EMP_FIL, N_FISCAL, SERIE, FORNEC, TIPO_MOVTO, ID_CANCEL, DT_EMISSAO, VENDEDOR, NRO_PEDIDO | Cabeçalho da nota: cliente, data, cancelamento, vendedor (atribuição), número da NF e pedido da nota (datas de faturado do pedido CRM) | omega/ABC71-NF.md:6647-6739 (PK 6655; 6663-6667, 6674, 6678, 6694, 6739); Gestao/server/src/producao/foto/moduloVendasEntradas.ts:13 e 32-43; `Vendas {VEN}/Consulta Pedidos Venda {CONPVE}/untDmVenConPve_ConPve.dfm:527-528 e 1257-1261` | sim |
| `ABC71.NFDE` | EMP_FIL, N_FISCAL, SERIE, FORNEC, TIPO_MOVTO, C_PROD, UNIDADE, QTDE, VLR_TOTAL, Z_FRANCA_DESC | Valor, peças e produto de cada item | omega/ABC71-NF.md:2804-2884 (PK 2812; 2833, 2836, 2840, 2849, 2884); Gestao/server/src/producao/foto/moduloVendasClientes.ts:25-36 | sim |
| `ABC71.ESTQ` | C_PROD, GRUPO, QT_ALT_OBR | Produto ativo no Omega; família pela regra do Gestao (conferência). O PA tem uma linha por C_PROD (produto-acabado.md:9), apesar da PK com EMP_FIL, ESTAB e DEPOSITO | omega/ABC71-ES.md:335-378 (PK 343; 354, 355, 378); untVenPvd_PosPac.dfm:555-557 | sim |
| `ABC71.VEPM` | EMP_FIL, NUMERO, CLIENTE, DT_PED, BLOQUEADO, DT_ENTREGA, Z_FRANCA_DESC, VENDEDOR; LIVRE só se a ligação pelo número CRM se confirmar | Pedido em aberto e sua atribuição ao representante (conta na LAN), etapa "no ERP", alíquota da Zona Franca no tipo 315 | omega/ABC71-VE.md:8041-8138 (PK 8049; 8057-8060, 8076, 8083, 8097, 8137, 8138); Gestao/server/src/pcp/emAberto.ts:58-72; SGI12CodigoFonte/Recebimento {REC}/Carga Pedido Venda e NF {CPV}/untDmRecCpv_Cpv.dfm:915-931 | sim; LIVRE a confirmar |
| `ABC71.VEPD` | EMP_FIL, NUMERO, SEQUENCIA, TIPO_MOVTO, DT_ENTREGA, SALDO, VLR_UNIT, PORC_DESC, PORC_DESC2, PORC_DESC_CPAG, PORC_DESC_CLI | Saldo, entrega, contagem de itens e valor em aberto | omega/ABC71-VE.md:6774-6868 (PK 6782; 6790-6792, 6797, 6799, 6808, 6812-6813, 6866-6868); Gestao/server/src/pcp/emAberto.ts:58-72 | sim |
| `ABC71.VEPM_SGI5_LOG` | LOG_NPE, LOG_DTA | Data do cancelamento (candidata) | omega/ABC71-VE.md:8417-8436 | sim; uso a confirmar |
| `ABC71.TGPA` | EMPRESA, FILIAL, COD_PAIS, NOME_PAIS, só se a pergunta 5 decidir mostrar o país | Nome do país do cliente do exterior | omega/ABC71-TG.md:437-455 | sim; uso a confirmar |

**SGI**

| Tabela | Colunas | Para quê | Citação | Confirmada |
|---|---|---|---|---|
| `ABC71.SGI5_TAB_FIN_VEN` | FIN_VEN, FIN_TIP, FIN_STA | Representante ativo: quem entra na foto e revalidação na LAN | sgi/ABC71-SGI5-TAB_FIN.md:826-843; SGI12CodigoFonte/Financeiro {FIN}/Vendedores {VEN}/untFinVen_VenMov.dfm:563-578 | sim |
| `ABC71.SGI5_TAB_VEN_CLI3` | CLI3_CLI, CLI3_STA; CLI3_GRP só se servir para grupos. `CLI3_RFI` não é lido (pergunta 16) | Status cadastral (carteira, aceite de pedido, revalidação na LAN, bloqueio de montadora): `NVL(CLI3_STA,'ATIVO')`, como o SGI (decidido em 2026-10-09), por LEFT JOIN em `CLI3_CLI = CRCL.CLIENTE`; cliente sem linha conta como ativo | sgi/ABC71-SGI5-TAB_VEN.md:162-198 (STA 188; GRP 198); untDmVenPvd.dfm:2572-2573 e 2657-2658; untVenPvd_PvdIncluir.pas:1007-1008 | sim |
| `ABC71.SGI5_TAB_VEN_CLI` | CLI_COD, CLI_TAB, CLI_STA | Tabela de preço do cliente | sgi/ABC71-SGI5-TAB_VEN.md:61-92 (PK 69; 77, 78, 91); untDmVenPvd.dfm:2642-2673 | sim |
| `ABC71.SGI5_TAB_VEN_TP1` | TP1_COD, TP1_NOM, TP1_STA, TP1_MOE | Nome, tabela obsoleta e moeda | sgi/ABC71-SGI5-TAB_VEN.md:2687-2719 (2702, 2703, 2715, 2719) | sim |
| `ABC71.SGI5_VIEW_VEN_TP2_VLR_LIQ_CLI` | VIEW_CLI, VIEW_TAB, VIEW_PAC, VIEW_PNU, VIEW_PNU_FOR, VIEW_STA, VIEW_VLR_LIQ; VIEW_MVE só se for a fonte da embalagem | Preço do cento, part number, filtro de vendável | untVenPvd_PosPac.dfm:443-557; untDmVenPvd.dfm:3080-3114 e 6440-6458; Relatorios {REL}/untVenRel_RelTabelaPrecoLiquido.dfm:614 e 668; plano.md:322 | não (fora do catálogo); colunas do fonte do SGI, a confirmar na F2 em DBA_VIEWS; abre com o `LUCAS_RO` desde 2026-10-09 (plano.md:322) |
| `ABC71.SGI5_VIEW_ENG_PAC_SEM_ARVORE` | VIEW_PAC | Tirar do catálogo, e recusar na LAN, o produto sem árvore | untDmVenPvd.dfm:3249-3251; untVenPvd_PvdIncluirItens.pas:432-443; OracleDB/docs/modulos/pedidos-venda.md:47 | não (fora do catálogo); colunas do fonte do SGI, a confirmar na F2 em DBA_VIEWS |
| `ABC71.SGI5_TAB_ENG_PAC` | PAC_COD, PAC_GRC, PAC_DMI_MM, PAC_DMA_MM | Família (grupo de custo) e medida | sgi/ABC71-SGI5-TAB_ENG.md:3346-3383 (PK 3354; 3363, 3377, 3382, 3383); OracleDB/docs/modulos/familias.md:15 | sim; medida a confirmar |
| `ABC71.SGI5_TAB_CUS_V3_GRP` | GRP_GRP, GRP_DES, GRP_NIV | Nome da família (nível 2) | sgi/ABC71-SGI5-TAB_CUS.md:1357-1375; OracleDB/docs/modulos/familias.md:9-34 | sim |
| `ABC71.SGI5_TAB_DP_CALEND` | CAL_DTA, CAL_DUT_COM | Dia útil, dias úteis e o corte do mesmo dia útil | sgi/ABC71-SGI5-TAB_DP.md:72-90; SGI12CodigoFonte/Aplicativo/untFunMat.pas:636-679 | sim; cobertura a confirmar |
| `ABC71.SGI5_TAB_VEN_PV1_V2` | PV1_NPE, PV1_DCA, PV1_STA, PV1_LR1, PV1_DLB_CTR, PV1_DLB_VD1, PV1_DLB_CON, PV1_DLB_CRE, PV1_DLB_VD2, PV1_DLB_BPV, PV1_DCO, PV1_DUA; PV1_CLI só se o pedido do SGI ainda não exportado impedir "parado" | Etapas e datas do pedido CRM; as datas de liberação conferem a de aprovado | sgi/ABC71-SGI5-TAB_VEN.md:1379-1441 (PK 1387; 1394-1396, 1404, 1421, 1425-1433, 1435, 1438, 1441); OracleDB/docs/modulos/pedidos-venda.md:9-19 | sim; LR1 como número CRM a confirmar |
| `ABC71.SGI5_TAB_VEN_PV2_V2` | PV2_NPE, PV2_QTD, PV2_VLR_VEN | Total no SGI, sem IPI | sgi/ABC71-SGI5-TAB_VEN.md:1748-1779 (1764, 1774, 1779); untDmVenPvd.dfm:111-140 | sim |
| `ABC71.SGI5_VIEW_VEPM_STA_FAT` | VIEW_NPE, VIEW_STA_FAT | Faturado parcial e faturado | untDmVenPvd.dfm:448-449 e 535-536; untVenPvd_Pvd.dfm:374-379; fora do catálogo (OracleDB/docs/lacunas.md:28) | não (fora do catálogo); colunas do fonte do SGI, a confirmar na F2 em DBA_VIEWS |
| `ABC71.SGI5_TAB_ENG_EAN` | EAN_COD, EAN_QTD, EAN_PPR | Candidata à embalagem (pede-se só a escolhida) | sgi/ABC71-SGI5-TAB_ENG.md:1276-1297 (PK 1284; 1293, 1295, 1297) | sim; uso a confirmar |
| `ABC71.SGI5_TAB_ENG_TR1` | TR1_PNE, TR1_CCL, TR1_QPE | Candidata à embalagem para montadora (pede-se só a escolhida) | sgi/ABC71-SGI5-TAB_ENG.md:5321-5352 (5337, 5338, 5352); untVenPvd_PosPac.dfm:522-525 | sim; uso a confirmar |
| `ABC71.SGI5_VIEW_DIR_CME_DIA_ULT_COT` | VIEW_MOE, VIEW_CAM, VIEW_DCO | Câmbio do dia, só se tabelas fora de REAL entrarem no CRM | untDmVenPvd.dfm:2586-2589 e 2675; untVenPvd_ItensMov.pas:145-158 | não (fora do catálogo); colunas do fonte do SGI, a confirmar na F2 em DBA_VIEWS |

**Só para conferência na F2** (com o `LUCAS_RO`, sem grant para o extrator)

| Objeto | Colunas | Para quê | Citação |
|---|---|---|---|
| `ABC71.SGI5_TAB_CUS_REP_FAT` | CUS_CLI, CUS_DFA, CUS_TMO, CUS_QTF, CUS_VLF, CUS_VEN, CUS_CLI_MER | Totais do RELCUS001, inclusive por representante e por mercado (plano.md:279 e 342) | sgi/ABC71-SGI5-TAB_CUS.md:635-691 (687, 691); SGI12CodigoFonte/Diretoria {DIR}/Custos {CUS}/untDirCus_RelRepresSin.dfm:2933-2956 |
| `ABC71.SGI5_VIEW_M_NFME_ULT_CPA_CLI` | VIEW_CLI, VIEW_DMO, VIEW_STA, VIEW_VEN | Última compra e situação que o CRM interno do SGI já calcula | sgi/ABC71-SGI5-VIEW_M.md:100-120; SGI12CodigoFonte/Vendas - CRM {CRM}/Clientes {CLI}/untDmCrmCli.dfm:21 e 107-108 |
| `ABC71.SGI5_TAB_VEN_TP2` | TP2_COD, TP2_PRO, TP2_CMO, TP2_CMO_FOR, TP2_STA, TP2_LMI, TP2_MVE, TP2_IPR | Base da view de preço: part number repetido, valores de status, múltiplo, lote e o indicador de produto na tabela impressa. Se `TP2_IPR` virar filtro (pergunta 29), a TP2 passa para a lista do extrator | sgi/ABC71-SGI5-TAB_VEN.md:2721-2764 (PK 2729; IPR 2759); untDmVenPvd.dfm:6443 |
| `ABC71.TPMU` | EMPRESA, COD_CIDADE, NOME_CIDADE, ESTADO | Conferir o código de `RESERVADO7` (pergunta 5). O nome não serve, porque é CHAR(20) | omega/ABC71-TP.md:3048-3067; SGI12CodigoFonte/Contabilidade {CONT}/Geracao GNRE {GNRE}/untDmContGnre.dfm:420-424 |
| `ABC71.SGI5_VIEW_VEN_PV2_V2_TOTAL` | VIEW_NPE, VIEW_VLR_SIP | Total sem IPI da tela do SGI, contra o total calculado pela PV2 | untDmVenPvd.dfm:368-372 e 529-530; fora do catálogo; colunas a confirmar na F2 |
| Código e definições | `SGI5_IUD_CUS_REP_FAT_V2` (DBA_SOURCE); texto das views acima e da `SGI5_VIEW_CARGA_PEDIDOS` (DBA_VIEWS); gatilhos `SGI5_TRG_VEPM_TO_VEN_PV1_V2` e `SGI5_TRG_VEPD_TO_VEN_PV2_V2` (ALL_TRIGGERS) | De onde vem CUS_VEN; regra das views; se o `VIEW_LR1` da carga é o `PV1_LR1`; o que o Omega grava no PV1 ao alterar ou excluir pedido | OracleDB/docs/modulos/custos-faturamento.md:14 (procedure); ABC71/outros_objetos.md:393 e 395 (gatilhos); OracleDB/docs/lacunas.md:7; Recebimento {REC}/Carga Pedido Venda e NF {CPV}/untDmRecCpv_Cpv.dfm:930-931 e 1071 |

## O que nunca entra na foto

- **CPF, CNPJ e o que os revela** (o `CRCL.CLIENTE` de empresa é a exceção, em `cliente.codigo_erp`):
  - `CRCL.CGC_CPF`, `DIG_CGC_CPF`, `PESS_FIS_COD`;
  - `NFME.CGC`, `SGI5_TAB_FIN_VEN.FIN_CNP`, `CRVN.CGC_CPF`;
  - `CRCL.CLIENTE` de pessoa física, que é o CPF; `NFME.FORNEC`, `VEPM.CLIENTE`, `PV1_CLI` e `VIEW_CLI` em claro;
  - a raiz do CNPJ.
- **Endereço e contato:**
  - `CRCL.ENDERECO`, `NUMERO`, `NUMERO_ALFA`, `COMPL_END`, `CEP`, `BAIRRO`, `CONTATO`, `DDD`, `TELEFONE_1`, `TELEFONE_2`, `TELEFAX`;
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

- **Esquema implementado (versão 1):** as tabelas acima, menos `catalogo`, `pedido_crm` e `pedido_crm_etapa`. Faltam também `cliente.tabela_preco`, `cliente.municipio_ibge` e `produto.medida`, que chegam com o catálogo e o mapa. O esquema fica em `dominio/esquemaDaFoto.ts`, e o servidor recusa foto de outra versão.
- **Conferência com o RELCUS001.** O faturado por representante e mês bate com a `SGI5_TAB_CUS_REP_FAT` nos códigos 1401 e 1402, em todos os meses de 2025 e 2026, com duas exceções:
  - junho de 2025: R$ 2.567,02 estão no 1402 no RELCUS001 e no 1401 pelo vendedor da nota. A soma dos dois códigos bate;
  - o mês corrente, porque a tabela do RELCUS001 ainda não tinha o dia.
  - Na Suprens inteira, a maioria dos meses bate ao centavo. Alguns diferem em até R$ 19 mil, a investigar.
- **Contagens no banco** (2026-10-13, só números):
  - uma empresa só (EMP_FIL 20210001) no CRCL, nas notas e nos pedidos (pergunta 4);
  - nenhuma nota de venda dos últimos 36 meses sem vendedor (pergunta 1);
  - todo pedido em aberto com o vendedor igual ao dono atual do cliente;
  - o calendário vai de 2025-01-01 a 2027-06-29 (pergunta 2);
  - as notas vêm em CT, com 4 itens em PC (pergunta 3).
- **Decisões desta entrega, a confirmar com o Lucas:**
  - carteira: cliente com `VEND_1` de um autorizado e nota de venda nos últimos 36 meses (pergunta 18);
  - atribuição: o vendedor da nota e, sem ele, o dono atual. O CRCLH entra quando aparecer nota sem vendedor;
  - compra (pergunta 25): junta as notas até 7 dias depois da primeira, sem encadear;
  - ciclo: abaixo de 30 dias vira 30; acima de 180, o cliente é irregular. Com a regra do plano ("fora de 30 a 180, irregular"), o maior cliente da Star Vendas, que compra várias vezes por mês, aparecia como irregular;
  - entrega do pedido em aberto: a mais próxima entre os itens com saldo;
  - valor em aberto: a conta proposta em Pedidos, ainda sem conferir com a tela do SGI (pergunta 13);
  - `pedido_aberto.cliente` e `nota.cliente`: o id quando o cliente está na carteira de qualquer autorizado. O servidor só mostra o nome quando o cliente é da carteira do login. O pedido do login para cliente de outra carteira conta no Início e não aparece na lista (pergunta 33);
  - nome e cidade como estão no ERP, em maiúsculas e sem acento, até o IBGE da F6.
- **Ainda não feito:** grupos por raiz de CNPJ, status `CLI3_STA`, catálogo e preços, a troca da foto por SFTP com manifesto e os esquemas de resposta da API.

## Perguntas para a F2

**Conferir nos dados (F2)**

1. **Atribuição.**
   - Qual é o formato real de `CRCLH.HISTORICO` para `CAMPO='VEND_1'`? O protótipo supõe "de: X para: Y", e quem grava é o Omega.
   - Quantas notas de venda vêm com `NFME.VENDEDOR` nulo ou 0?
   - Quantos pedidos em aberto vêm com `VEPM.VENDEDOR` nulo, 0 ou diferente do `VEND_1` atual do cliente? Isso confirma que `VEPM.VENDEDOR` usa o mesmo código do representante e mede o pedido de cliente de outra carteira (ver Pedidos).
   - Ler em DBA_SOURCE como `SGI5_IUD_CUS_REP_FAT_V2` preenche `CUS_VEN`. Se ela usar o `VEND_1` atual para todo o histórico, o total por representante não bate com a regra do plano (plano.md:219 e 342). Qual dos dois vence?
2. **Calendário.** Período coberto por `SGI5_TAB_DP_CALEND` (790 linhas): todo dia tem linha? O ano anterior inteiro está lá? Os feriados do ano seguinte são cadastrados com antecedência?
3. **Unidades e tipos.** Quais são as unidades reais das notas e dos pedidos além de CT e PC? O Gestao faz CT ×100 e o resto ×1; o RELCUS001 faz ×100 sempre (custos-faturamento.md:23-24). Listar também os tipos de movimento (plano.md:280).
4. **EMP_FIL.** Quantas empresas têm notas e pedidos de venda? Hoje o código do cliente leva só `CLIENTE`.
5. **Cidade.**
   - `CRCL.RESERVADO7` é o código IBGE do município? Quanto dele está preenchido?
   - Se for, a tela mostra o nome do IBGE no lugar de `CIDADE`?
   - Conferir o código contra a `TPMU` (`COD_CIDADE`), como a GNRE faz (`untDmContGnre.dfm:420-424`).
   - O cliente com `ESTADO='EX'` mostra só "EX" ou o país? Se for o país, o nome vem de `ABC71.TGPA.NOME_PAIS` (omega/ABC71-TG.md:437-455)? Com qual EMPRESA/FILIAL? Sem essa decisão, `COD_PAIS` fica fora da leitura.
6. **Mercado.** Há clientes cujo `TIPO_CLI` discorda do tipo de movimento das próprias notas (310/315 praça, 316/317 exportação, 320/325/326 montadora)? Qual dos dois vale no mix?
7. **Família.**
   - `PAC_GRC` aponta sempre para o nível 2, ou é preciso subir pelos 4 primeiros dígitos?
   - Comparar com a regra do Gestao (`ESTQ.GRUPO`).
   - O que mostrar para os 41 PA sem grupo (familias.md:38) e para item vendido fora do grupo 30?
8. **Medida.** `PAC_DMI_MM` e `PAC_DMA_MM` estão preenchidos e fazem sentido em todas as famílias (MOLA, BORRACHA, LAMINADOS)? A alternativa é o diâmetro nominal ou o tamanho do código (`SGI5_FNC_ENG_PAC_TAM_COD`).
9. **Embalagem.** Qual é a fonte da embalagem de venda: `EAN_QTD` do EAN padrão, `VIEW_MVE` ou `TR1_QPE`? Em peça ou em CT? Qual o valor quando vier vazio? O CRM bloqueia quantidade fora do múltiplo; o SGI não valida.
10. **View de preço.**
    - A view já abre com o `LUCAS_RO` (plano.md:322). Ler o texto dela em DBA_VIEWS.
    - Confirmar no texto que `VIEW_TAB`, `VIEW_PAC` e `VIEW_PNU` correspondem a `TP2_COD`, `TP2_PRO` e `TP2_CMO`.
    - Comparar uma linha com uma nota recente do mesmo cliente e produto (`VLR_TOTAL ÷ QTDE` em CT).
    - Ler também o texto da `SGI5_VIEW_ENG_PAC_SEM_ARVORE`. Com o `READ ANY TABLE`, as views do ABC71 abrem (OracleDB/docs/lacunas.md:7).
    - Medir o volume da view só para os clientes dos autorizados, na tabela escolhida.
11. **Part number.** Quantos grupos (`VIEW_CLI`, `VIEW_TAB`, `VIEW_PAC`) têm mais de uma linha? Se houver, o catálogo passa a ter chave código + part number, ou o extrator escolhe um?
12. **Pedido CRM.**
    - Ler em DBA_VIEWS a `SGI5_VIEW_VEPM_STA_FAT`.
    - Medir quantas notas de venda vêm com `NFME.NRO_PEDIDO` nulo ou 0. A ligação nota → pedido já está no fonte do SGI (ver Detalhe do pedido).
    - Ler em DBA_VIEWS se o `VIEW_LR1` da `SGI5_VIEW_CARGA_PEDIDOS` é o `PV1_LR1`. Se for, o número CRM chega a `VEPM.LIVRE`.
    - Descobrir de onde vem a data do cancelamento (`PV1_DUA` ou `VEPM_SGI5_LOG.LOG_DTA`).
    - Ver o que os gatilhos `SGI5_TRG_VEPM_TO_VEN_PV1_V2` e `SGI5_TRG_VEPD_TO_VEN_PV2_V2` gravam no PV1.
13. **Valor em aberto.** Conferir o total contra a tela de pedidos do SGI, com a cadeia de descontos do VEPD e a alíquota de `VEPM.Z_FRANCA_DESC` num pedido 315 já faturado. O que significa `BLOQUEADO = 'F'`?
14. **Primeira compra.** Desde quando o NFME tem notas? O extrator recalcula o MIN a cada foto, ou guarda o resultado na LAN? O NFDE tem cerca de 3,5 milhões de linhas.
15. **Grupo de clientes.** `SGI5_TAB_VEN_CLI3.CLI3_GRP` está preenchido? Serve para grupo econômico?
16. **Status do cliente** (plano.md:173).
    - Decidido em 2026-10-09: o mesmo do SGI, `NVL(CLI3_STA,'ATIVO')` (`untDmVenPvd.dfm:2572`; `Vendas - CRM {CRM}/Clientes {CLI}/untDmCrmCli.dfm:18`). `CRCL.SUSPENSO` não é lido; usá-lo foi erro do protótipo (CRM-prototipo/REGRAS.md:79).
    - Decidido em 2026-10-09: a revalidação de "não está suspenso" na LAN também segue o SGI, com `CLI3_STA`. `CLI3_RFI` não é lido.

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
    - Saem `CLI3_STA` inativo, `TIPO_CAD` diferente de 'C' e cliente sem compra há N anos?
    - `VEND_2` e `VEND_3` têm uso?
19. **Grupos por raiz de CNPJ (plano.md:244).**
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
    - A perda mensal inclui o mês da última compra (analises.ts:67-73) ou só os 12 anteriores (plano.md:226)?
    - Com menos de 12 meses de história, divide por 12?
    - O "faturado desde então" do mês de "desde" até hoje vale?
    - O piso de "dados insuficientes" da variação em 12 meses vale?
    - "Comprando mais" exclui o cliente novo, como faz o fictício (`ficticio.ts:522`)? O plano não diz (plano.md:228-232).
    - Antes da F2, a regra de quem entra em cada lista sai do fictício (`ficticio.ts:493-536`) e vai para `analises.ts`, com teste.
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
    - E o rascunho com produto que saiu do catálogo do cliente? O servidor tira o item na leitura e avisa o representante, ou bloqueia só o envio? Hoje a tela esconde o item (MontarPedido.tsx:74), mas o reenvia em todo salvamento (MontarPedido.tsx:172-174), e a validação recusaria o rascunho inteiro.
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