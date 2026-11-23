# O pedido do CRM no SGI: campo a campo

Situação em 2026-11-19. Base para a etapa 4 da F5: a máquina do extrator grava o pedido conferido pelas mesmas procedures do app antigo dos representantes (SGI6R), com os mesmos valores que ele manda. **Conferir com o Lucas antes de gravar no SGI.**

Fontes:
- os parâmetros das procedures, do `ALL_ARGUMENTS` (lista do DBA, 2026-11-19);
- o código do SGI6R (cópia de 2026-07-16):
  - `Client\untPedidos_Incluir.pas` (`btnGravarClick`) e `Client\untPedidos_IncluirItens.pas` (`edPacExit`);
  - `Client\untPedidos.pas` (`CalculaValorMinimoVenda`);
  - `Server\ServerMethodsUnit1.pas` (`IUDMestre`, `IUDItens`) e as consultas do `.dfm` (`qryPosCliTab`, `qryPosPac`, `qryPosTransp`, `qryPosVlrMinVen`, `qryNumPed`).

## Como o SGI6R grava

1. Calcula o número: `MAX(PV1_NPE) + 1` da `SGI5_TAB_VEN_PV1_V2`. Passou de 2.999.999, volta a 1.
2. Numa transação, chama:
   - `SGI5_IUD_VEN_PV1_V2` com `V_OPE = 1`;
   - `SGI5_IUD_VEN_PV2_V2` com `V_OPE = 1`, uma vez por item;
   - e confirma.
3. O pedido fica `COTACAO`. A efetivação é outra chamada, com `V_OPE = 13` e só `V_NPE`, que o deixa `PEDIDO BLOQUEADO`.

O servidor do SGI6R troca por nulo:
- as liberações com usuário 0, com a data junto;
- o vencimento (`V_DVE`) quando há condição de pagamento;
- o câmbio 0 e a data de câmbio de 1900;
- o endereço da transportadora vazio, com todos os campos `V_TRA_*`;
- no item, a aprovação de desconto 0 e o pedido de produção vazio.

O CRM faz igual.

**Parâmetros que o SGI6R nunca manda e que ficam nulos:**
- `V_TEB`, `V_SEN`;
- os dados de crédito: `V_LIM_CRE`, `V_TIT_ABE`, `V_PED_ABE`, `V_VLR_PED`, `V_REC_VEN` e `V_JLB_CRE`;
- no item: `V_CCL`, `V_FAB`, `V_LEN`, `V_DOC` e `V_CLI`.

O CRM também não manda nenhum dado de crédito (CLAUDE.md, regra 3).

## Cabeçalho: `SGI5_IUD_VEN_PV1_V2`, operação 1

De onde vêm os valores:
- **Cadastro:** a consulta do cadastro do SGI6R (`qryPosCliTab`) para o cliente do pedido, com a tabela `PRINCIPAL`.
  - Tabelas: `CRCL A`, `SGI5_TAB_VEN_CLI B`, `TPUF D` (empresa 2021), `CRVN G`, `NFTF I`, `SGI5_TAB_VEN_TP1 M` e `CRCLX O`.
- **Transportadora:** `qryPosTransp` (`CFOR`, `SGI5_TAB_LOG_TRA`).

| Parâmetro | O que é | Valor no SGI6R | No CRM |
|---|---|---|---|
| `V_OPE` | operação | 1 | 1 |
| `V_NPE` | número do pedido | `MAX(PV1_NPE)+1` | o mesmo; colisão com a tela do SGI: tenta o seguinte |
| `V_DCA` | data do cadastro | hoje | hoje |
| `V_CLI` | cliente | código do cliente | o cliente achado pela conferência |
| `V_CVE` | classificação da venda | `COMERCIALIZACAO`, `INDUSTRIALIZACAO` ou `USO/CONSUMO` | a escolha do pedido, nesses textos |
| `V_CFO` | CFOP | `A.CFO` | o mesmo |
| `V_CTR` | código de tributação | `B.CLI_CTR` | o mesmo |
| `V_TMO` | tipo de movimento | `B.CLI_TMO` | o mesmo |
| `V_ORI` | origem | `REPRESENTANTE` | `REPRESENTANTE` |
| `V_CPG` | condição de pagamento | a escolhida | a escolhida |
| `V_TPM` | tabela de preço | `B.CLI_TAB` | a tabela da conferência |
| `V_STA` | status | `COTACAO` | `COTACAO` |
| `V_TXT` | texto genérico | `A.CENTRAL_PGTO` | o mesmo |
| `V_OCO` | nº do pedido do cliente | o digitado | `pedidoDoCliente` |
| `V_DEN` | entrega | a data digitada | a entrega pedida; sem ela, 5 dias úteis depois do envio |
| `V_DVE` | vencimento | nulo (há condição) | nulo |
| `V_DVA` | validade | hoje + 10 dias | hoje + 10 dias |
| `V_TRA` | transportadora | o código | o código da conferência |
| `V_PFR` | pagamento do frete | `P` na 616108610001 (Suprens), `S` na 85819999 e na 78499999 (cliente retira), `T` nas outras | o mesmo |
| `V_BAS_IPI` | base de IPI | `SIM`/`NAO`, de `NFTF.BASE_IPI` | o mesmo |
| `V_BAS_ICM` | base de ICMS | `SIM`/`NAO`, de `NFTF.BASE_ICM` | o mesmo |
| `V_PIC` | alíquota de ICMS | `TPUF.ICM_PORC` do estado do cliente | o mesmo |
| `V_BCO` | banco de cobrança | 3 primeiros dígitos de `A.BANCO_CART_PORT` | o mesmo |
| `V_CAR` | carteira | último dígito de `A.BANCO_CART_PORT` | o mesmo |
| `V_VEN` | vendedor | `A.VEND_1` | o mesmo |
| `V_TER` | território | `A.TERR_1` | o mesmo |
| `V_PCV` | comissão | `CRVN.PORC_COMISSAO` do vendedor | o mesmo |
| `V_ORC` | orçamentista (matrícula do funcionário) | `SGI6R` | **`SGI6R`**: texto diferente quebra o Relatório de Cotações (abaixo) |
| `V_LR1` | livre 1 | vazio | **o número CRM (`CRM-00106`)**: é por ele que o pedido volta à tela |
| `V_LR2`, `V_NFA`, `V_TFO` | livres | vazios | vazios |
| `V_DLB_*`, `V_ULB_*`, `V_JUS_BPV`, `V_DCO`, `V_UCO` | liberações | nulos | nulos |
| `V_OBS` | observação | a digitada | a observação do pedido |
| `V_USU` | usuário | o código do representante logado | o dono do cliente (`VEND_1`), um dos códigos do login |
| `V_JCA` | justificativa de cancelamento | vazio | vazio |
| `V_MOE` | moeda | `TP1_MOE` da tabela | `REAL` (o CRM só usa tabela em real) |
| `V_CBO`, `V_DCB` | câmbio e data | nulos em real | nulos |
| `V_TRA_END` … `V_TRA_CEP` | endereço de entrega da transportadora | `SGI5_TAB_LOG_TRA` | o mesmo; vazio, tudo nulo |
| `V_FPG` | forma de pagamento | `CRCLX.RESERVADO_10` | o mesmo |
| `V_TEN` | tipo de entrega | `IMEDIATA` ou `PROGRAMADA` | "Assim que possível" → `IMEDIATA`; "Programada" → `PROGRAMADA` |
| `V_TRF` | frete parcial | `NAO ACEITA FRETE PARCIAL` ou `ACEITA FRETE PARCIAL` | a escolha do pedido, nesses textos |

## Item: `SGI5_IUD_VEN_PV2_V2`, operação 1, um por produto

O preço vem da view de preço do cliente (`SGI5_VIEW_VEN_TP2_VLR_LIQ_CLI`): `VIEW_STA LIKE 'ATIVO%'`, **`VIEW_IPR = 'SIM'`**, do cliente e da tabela.

| Parâmetro | O que é | Valor no SGI6R | No CRM |
|---|---|---|---|
| `V_OPE`, `V_NPE` | operação e pedido | 1 e o número | os mesmos |
| `V_ITE` | item | 1, 2, 3… na ordem | a ordem do pedido |
| `V_DEN` | entrega | a do cabeçalho | a do cabeçalho |
| `V_CTR` | tributação | a do cabeçalho | a mesma |
| `V_PIC` | ICMS | 4 se a procedência (`VIEW_PCD`) é 1, 3 ou 8 e o CFOP começa com 6; senão, a do cabeçalho | o mesmo |
| `V_PIP` | IPI | `VIEW_ALI_IPI` se a base de IPI é `SIM`; senão, 0 | o mesmo |
| `V_PAC` | produto | o código | o código |
| `V_PNU`, `V_PNU_FOR` | part number e o do fornecedor | `VIEW_PNU` e `VIEW_PNU_FOR`; `0` vira vazio | o mesmo |
| `V_UNI` | unidade | `CT` | `CT` |
| `V_QTD` | quantidade | em centos | as peças ÷ 100 |
| `V_VLR_TAB` | preço de tabela | `VIEW_VLR_TAB` | o mesmo |
| `V_DES` | desconto | `VIEW_DSC` | o mesmo |
| `V_DES_IND` | índice do desconto | `VIEW_DSC_IND` | o mesmo |
| `V_VLR_LIQ` | preço líquido | `VIEW_VLR_LIQ` | o mesmo |
| `V_VLR_VEN` | preço de venda (do cento) | o digitado; começa no líquido | o preço do cento do pedido (a conferência garante que não fica abaixo do líquido) |
| `V_APV_DES`, `V_DTA_DES`, `V_JUS_DES` | aprovação de desconto | nulos | nulos |
| `V_PMV_MB`, `V_PMV_ML` | preço mínimo por margem bruta e líquida | da `SGI5_TAB_CUS_REP_VLR_MIN_VEN` do dia (`CUS_DMO = TRUNC(SYSDATE)`) × 100: exportação, `EXP`; senão, pelo ICMS do item (`PRAIS` com 0, `PRA4`, `PRA7`, `PRA12`, `PRA18`); a coluna `_COM` quando há comissão | o mesmo |
| `V_LR1`, `V_LR2` | livres | vazios | vazios |
| `V_OCO` | ordem de compra do cliente no item | a do cabeçalho, que o representante pode trocar no item ("Ordem Compra:") | `ordemDeCompra` do item; null é a do cabeçalho (`pedidoDoCliente`) |
| `V_IOC` | item da ordem de compra ("Item O.C.:") | o digitado; em branco, **0** (é o que está gravado: 96% dos itens do SGI6R têm 0) | `itemDaOrdemDeCompra` do item; null vira **0**, como o SGI6R |
| `V_NPP`, `V_SPP`, `V_JPP` | pedido de produção | nulos | nulos |
| `V_USU` | usuário | o representante | o mesmo do cabeçalho |

## O que o código do SGI6R mudou no que o CRM já faz

1. **Produto liberado para representante (`VIEW_IPR = 'SIM'`).** O SGI6R só oferece os produtos com esse filtro, e até 2026-11-19 a foto do CRM e a conferência da LAN não o usavam: o catálogo do CRM podia mostrar produto que o SGI6R não deixa vender. Corrigido em 2026-11-19 na consulta de preços (`extrator/src/erp/catalogo.ts`), que vale para a foto e para a conferência.
2. **Só a tabela `PRINCIPAL`.** O SGI6R procura o cliente com `NVL(B.CLI_STA, 'PRINCIPAL') = 'PRINCIPAL'`. Sem ela, o cliente não recebe pedido. A foto do CRM, na falta da principal, usa outra tabela (`escolherTabela`). Para o pedido, vale a regra do SGI6R.
3. **Representante ativo.** O SGI6R só deixa entrar o representante com `SGI5_TAB_FIN_VEN.FIN_STA = 'ATIVO'`. A conta `CRM_EXTRATOR` não lê essa tabela. Se o Lucas quiser a mesma trava na LAN, é um GRANT novo ao DBA.
4. **Entrega programada.** O SGI6R pede pelo menos 7 dias corridos. Os 5 dias úteis do CRM sempre dão 7 dias corridos ou mais, porque passam por um fim de semana.

## Os campos livres já são usados pela Suprens

Consulta de 2026-11-19 nos pedidos do SGI6R de 24 meses (19.913):
- `PV1_LR1` está preenchido em 38% deles (7.587), e `PV1_LR2` em 9%. O SGI6R manda os dois vazios: quem preenche é a Suprens, na tela do SGI.
- Os valores são recados para o faturamento: `RETIRA` (2.200), `ANTECIPADO`, `USO CONSUMO`, `EMBALAGEM 20 PÇS`, `1º COMPRA`, `ENV CERTIFICADO`, `ST-MG / ANTECIPADO`, `GERAR GNRE` e `ZONA FRANCA`.
- Nos itens, `PV2_LR1` e `PV2_LR2` nunca são usados. `PV2_IOC` (item da ordem de compra) tem valor em 4% dos itens (9.092 de 224.655): nos outros, o SGI6R grava 0.

Por isso o número CRM **não pode ir no `V_LR1`**: a Suprens escreve por cima e o pedido perde a ligação com o CRM.

**Nem no `V_ORC`.** No SGI, `PV1_ORC` é o "Orçamentista": a matrícula do funcionário (`SGI5_TAB_DP_FUN.FUN_REG`) ou `SGI6R`. O Relatório de Cotações (`Vendas {VEN}/Pedido Venda V2 {PVD}/untVenPvd_RelCotacoes.dfm`) liga o pedido ao funcionário com `CASE WHEN TRIM(PV1_ORC) = 'SGI6R' THEN 0 ELSE TO_NUMBER(PV1_ORC) END`: qualquer outro texto, como `CRM` ou `CRM-00106`, dá ORA-01722 e derruba o relatório. A tela antiga de pedidos (`untVenPve_PveMov.pas`) também lê o campo como número. O CRM manda `SGI6R`, como o app antigo.

Proposta: a ligação do pedido com o CRM fica na máquina do extrator, que escolhe o número do SGI (`MAX(PV1_NPE)+1`) e sabe qual número gravou para cada número CRM. A decidir com o Lucas como o SGI mostra que o pedido veio do CRM, se precisar.

## Decisões do Lucas em 2026-11-23: cliente xPed

- **Ordem dos itens:** o representante muda a ordem arrastando (no celular, pelas setas). É a ordem do `V_ITE` no SGI.
- **Ordem Compra e Item OC sempre visíveis** em cada item, logo depois do produto.
- **"Cliente exige xPed"** nas condições do pedido (`clienteXped`), marcado sozinho para o cliente que mandou o item da ordem de compra em pelo menos metade dos pedidos dos 24 meses (`cliente_escolha`, tipo `xped`). Marcado, o Item OC vai de 1 a N na ordem dos itens e acompanha a ordem; o número digitado à mão desliga isso até "Renumerar de 1 a N". O 10 em 10 (5% dos pedidos) fica à mão. A marca não vai ao SGI: só muda a tela.
- **"Rascunho" virou "Cotação"** na tela, como no app antigo (o pedido salvo como COTAÇÃO e depois a "Efetivação Pedido Venda"). No código e nas rotas, o nome continua rascunho. A cotação do CRM fica só no CRM até ser enviada; não vai ao SGI como COTACAO.
- **PDF da cotação:** a página `/pedidos/rascunhos/:id/pdf`, que o navegador imprime ou salva em PDF. Validade de 10 dias, como o V_DVA do SGI6R; sem o contato do representante, só o nome.

## Decisões do Lucas em 2026-11-19

- **Ordem de compra no item, igual ao SGI6R:** cada item tem a ordem de compra (a do pedido, se o representante não trocar) e o item dela. Os clientes que pedem o xPed na nota querem nela o pedido deles e o item correspondente (nItemPed). Feito no CRM em 2026-11-19: o rascunho, o pedido enviado e o arquivo da caixa de saída levam `ordemDeCompra` e `itemDaOrdemDeCompra` em cada item, e a máquina do extrator os confere. Falta a gravação (etapa 4) mandá-los como na tabela do item.

- **Teto de pedidos por login por dia:** 30.
- **Sem valor-teto:** o pedido conferido segue ao SGI qualquer que seja o valor. Ele nasce `PEDIDO BLOQUEADO`, e a liberação no SGI é a conferência da Suprens.
- **Primeira gravação:** um pedido real, cancelado depois no SGI (operação 12). O cliente e os itens se escolhem junto com o Lucas.
- **Cliente sem tabela `PRINCIPAL`:** bloquear o pedido já na tela do CRM, como o SGI6R, dizendo o motivo ao representante ("Tabela de preço não cadastrada").
- **Qual login enviou:** o código do pedido continua o dono do cliente, como hoje. O Lucas quer saber também o login do CRM que colocou o pedido, para separar os vendedores de um mesmo representante. O `app.db` já guarda isso (`pedidos_enviados.usuario` e a chave usada). Falta mostrar, no CRM e talvez no SGI.
- **Condição de pagamento:** começar na condição que o cliente mais usa, e não na do cadastro. A Suprens estuda trocar a condição do cadastro, que hoje é uma só, por uma lista de condições permitidas por cliente.

## Ainda a decidir com o Lucas

- Se o SGI precisa mostrar que o pedido veio do CRM, e em que campo (acima).
