# Conta Oracle do CRM: especificação para o DBA

Situação em 2026-11-17. O pedido é do Lucas.

## Para que serve

O CRM dos representantes fica num servidor da internet que **não tem acesso nenhum ao banco**. Quem fala com o Oracle é só um programa na rede interna da empresa, o **extrator**, numa máquina da LAN. Ele faz duas coisas:

1. **Lê** os dados de clientes, produtos, preços, notas e pedidos, e manda uma cópia pronta ao servidor do CRM.
2. **Grava os pedidos** que os representantes enviam pelo CRM:
   - grava pelas mesmas procedures que o app antigo dos representantes (SGI6R) usa hoje, `SGI5_IUD_VEN_PV1_V2` e `SGI5_IUD_VEN_PV2_V2`;
   - o pedido entra como `COTACAO` (operação 1) e é efetivado em seguida (operação 13). Ele fica em `PEDIDO BLOQUEADO`, esperando as aprovações de sempre;
   - antes de gravar, o extrator confere de novo, no Oracle, o cliente, o produto e o preço.

Hoje o desenvolvimento usa a conta `LUCAS_RO`, que tem `READ ANY TABLE`. A conta nova substitui o `LUCAS_RO` no extrator e tem só o que o CRM usa.

## O que pedimos

### 1. A conta `CRM_EXTRATOR`

- Privilégio de sistema: **só `CREATE SESSION`**.
- Sem role nenhuma: nem `SELECT_CATALOG_ROLE`, nem `RESOURCE`, nem `ANY`.
- Sem cota de tablespace: ela não cria objetos.
- Senha longa e aleatória, gerada pelo DBA e entregue ao Lucas em mãos ou por um canal seguro, nunca por e-mail. Ela fica só num arquivo de configuração da máquina do extrator, fora do git.
- Perfil próprio:

```sql
CREATE PROFILE CRM_SERVICO LIMIT
  FAILED_LOGIN_ATTEMPTS 5
  PASSWORD_LOCK_TIME    1/24
  SESSIONS_PER_USER     3
  PASSWORD_LIFE_TIME    UNLIMITED;  -- conta de serviço: a troca é manual, uma vez por ano ou quando alguém sair

CREATE USER CRM_EXTRATOR IDENTIFIED BY "<senha gerada pelo DBA>" PROFILE CRM_SERVICO;
GRANT CREATE SESSION TO CRM_EXTRATOR;
```

### 2. Gravação de pedidos: só as duas procedures

```sql
GRANT EXECUTE ON ABC71.SGI5_IUD_VEN_PV1_V2 TO CRM_EXTRATOR;
GRANT EXECUTE ON ABC71.SGI5_IUD_VEN_PV2_V2 TO CRM_EXTRATOR;
```

As procedures não declaram `AUTHID`, então rodam com os direitos do `ABC71`. A conta **não recebe INSERT, UPDATE nem DELETE** em tabela nenhuma.

### 3. Leitura

Quatro tabelas do Omega têm dados bancários ou de crédito que o CRM nunca usa. Para elas, a conta lê **views sem essas colunas**, num esquema próprio do CRM. As outras tabelas a conta lê direto, com SELECT.

**3a. Esquema dono das views, sem login**

```sql
CREATE USER CRM_DADOS NO AUTHENTICATION;   -- Oracle 18c ou mais novo. Antes: IDENTIFIED BY <aleatória> ACCOUNT LOCK

GRANT SELECT ON ABC71.CRCL TO CRM_DADOS WITH GRANT OPTION;  -- sem o WITH GRANT OPTION, o GRANT da view falha (ORA-01720)
GRANT SELECT ON ABC71.CFOR TO CRM_DADOS WITH GRANT OPTION;
GRANT SELECT ON ABC71.NFME TO CRM_DADOS WITH GRANT OPTION;
GRANT SELECT ON ABC71.VEPM TO CRM_DADOS WITH GRANT OPTION;
```

**3b. Uma view por tabela, com o mesmo nome e todas as colunas, menos estas:**

| Tabela | Colunas que ficam de fora |
|---|---|
| `CRCL` (clientes) | `LM_CREDITO`, `DIAS_VALID_LM_CRED`, `DT_ALT_LM_CREDITO`, `PROTESTO`, `SUSPENSO`, `DT_SUSP`, `DT_SUSP_AN`, `MOTIV_SUSP`, `AGENCIA_PORT`, `CONTA`, `DG_CONTA`, `CONTA_FOR`, `DG_CONTA_FOR` |
| `CFOR` (fornecedores e transportadoras) | `AGENCIA_FORNEC`, `BANCO_CART_FORNEC`, `CONTA`, `DG_CONTA`, `CONTA_CLI`, `DG_CONTA_CLI`, `CONTA_DEB`, `DG_CONTA_DEB` |
| `NFME` (notas) | `AGENCIA`, `BANCO_CART`, `CONTA`, `DG_CONTA`, `CONTA2`, `DG_CONTA2`, `NR_CHEQUE`, `SERIE_CHEQUE` |
| `VEPM` (pedidos do Omega) | `AGENCIA`, `BANCO`, `CONTA`, `DG_CONTA`, `CONTA2`, `DG_CONTA2`, `MOTIVOS_BLOQ` |

`CRCL.BANCO_CART_PORT` **fica na view**: as procedures de pedido recebem o banco e a carteira de cobrança do cliente, como no SGI6R.

Esta consulta gera o `CREATE VIEW` de cada tabela (troque a tabela e a lista):

```sql
SELECT 'CREATE OR REPLACE VIEW CRM_DADOS.CRCL AS SELECT '
       || LISTAGG(column_name, ', ') WITHIN GROUP (ORDER BY column_id)
       || ' FROM ABC71.CRCL'
FROM   dba_tab_columns
WHERE  owner = 'ABC71' AND table_name = 'CRCL'
AND    column_name NOT IN ('LM_CREDITO', 'DIAS_VALID_LM_CRED', 'DT_ALT_LM_CREDITO', 'PROTESTO', 'SUSPENSO',
                           'DT_SUSP', 'DT_SUSP_AN', 'MOTIV_SUSP', 'AGENCIA_PORT', 'CONTA', 'DG_CONTA',
                           'CONTA_FOR', 'DG_CONTA_FOR');
```

Depois:

```sql
GRANT SELECT ON CRM_DADOS.CRCL TO CRM_EXTRATOR;
GRANT SELECT ON CRM_DADOS.CFOR TO CRM_EXTRATOR;
GRANT SELECT ON CRM_DADOS.NFME TO CRM_EXTRATOR;
GRANT SELECT ON CRM_DADOS.VEPM TO CRM_EXTRATOR;
```

**3c. SELECT direto nos outros objetos do `ABC71`:**

| Objeto | Para quê |
|---|---|
| `NFDE` | itens das notas: faturamento e preço da última compra |
| `VEPD` | itens dos pedidos do Omega: pedidos em aberto |
| `CRVN` | vendedores e comissão |
| `CRCLX` | forma de pagamento do cliente (`RESERVADO_10`) |
| `CRCA` | endereços de cobrança e de entrega |
| `CRCX` | e-mail de envio do XML |
| `CPAG` | descrição da condição de pagamento |
| `TPUF` | alíquota de ICMS por estado |
| `NFTF` | base de IPI e de ICMS por CFOP |
| `NFCF` | descrição do CFOP do pedido e da nota, como o app antigo mostra |
| `ESTQ`, `ESTQ_VW` | produtos vendáveis e saldo dos modelos ZIP/ZPP/ZPU |
| `SGI5_TAB_VEN_CLI`, `SGI5_TAB_VEN_CLI2`, `SGI5_TAB_VEN_CLI3` | tabela de preço, descontos e status/grupo do cliente |
| `SGI5_TAB_VEN_DES` | desconto do cliente |
| `SGI5_TAB_VEN_TP1`, `SGI5_TAB_VEN_TP2` | tabelas de preço e part numbers da Bíblia Montadora |
| `SGI5_TAB_ENG_PAC`, `SGI5_TAB_ENG_EAN` | produtos e embalagens |
| `SGI5_TAB_CUS_V3_GRP` | famílias de produto |
| `SGI5_TAB_CUS_REP_VLR_MIN_VEN` | preço mínimo por margem, gravado no item do pedido como no SGI6R |
| `SGI5_TAB_LOG_TRA` | endereço de entrega das transportadoras |
| `SGI5_TAB_VEN_PV1_V2`, `SGI5_TAB_VEN_PV2_V2` | histórico das escolhas do representante, próximo número de pedido e andamento dos pedidos do CRM |
| `SGI5_VIEW_VEN_TP2_VLR_LIQ_CLI` | preço líquido do cliente |
| `SGI5_VIEW_ENG_PAC_SEM_ARVORE` | produtos sem árvore, que ficam fora do catálogo |
| `SGI5_VIEW_COND_PAGTO` | condições de pagamento (1000 a 1349) |
| `SGI5_VIEW_VEPD_CART_PV` | quantidade já reservada em carteira, para o saldo |
| `SGI5_VIEW_DIR_CME_DIA_ULT_COT` | câmbio do dia, para tabela em moeda estrangeira |

```sql
GRANT SELECT ON ABC71.NFDE TO CRM_EXTRATOR;
-- … um GRANT por objeto da tabela acima
```

### 4. Só da máquina do extrator

A conta só deve entrar a partir da máquina do extrator na LAN, a máquina virtual de IP **192.168.0.12** (informado pelo Lucas em 2026-11-17; a máquina ainda está sendo preparada pelo TI). Um gatilho de logon, de um usuário DBA, resolve:

```sql
CREATE OR REPLACE TRIGGER <dono_dba>.CRM_EXTRATOR_SO_DA_LAN
AFTER LOGON ON DATABASE
BEGIN
  IF USER = 'CRM_EXTRATOR' AND SYS_CONTEXT('USERENV', 'IP_ADDRESS') NOT IN ('192.168.0.12') THEN
    RAISE_APPLICATION_ERROR(-20001, 'CRM_EXTRATOR só entra da máquina do extrator.');
  END IF;
END;
/
```

### 5. Registro do que a conta faz

Se o banco usa a auditoria unificada (12c ou mais novo):

```sql
CREATE AUDIT POLICY CRM_EXTRATOR_PEDIDOS
  ACTIONS EXECUTE ON ABC71.SGI5_IUD_VEN_PV1_V2,
          EXECUTE ON ABC71.SGI5_IUD_VEN_PV2_V2,
          LOGON;
AUDIT POLICY CRM_EXTRATOR_PEDIDOS BY CRM_EXTRATOR;
```

## Como conferir depois

Conectado como `CRM_EXTRATOR`:
- `SELECT COUNT(*) FROM CRM_DADOS.CRCL` funciona;
- `SELECT LM_CREDITO FROM CRM_DADOS.CRCL` dá ORA-00904;
- `SELECT COUNT(*) FROM ABC71.CRCL` dá ORA-00942 (a tabela inteira não);
- `UPDATE ABC71.SGI5_TAB_VEN_PV1_V2 SET PV1_OBS = PV1_OBS WHERE 1 = 0` dá ORA-01031 ou ORA-00942;
- a mesma conexão a partir de outra máquina é recusada pelo gatilho do item 4.

## O que muda do nosso lado

O extrator passa a ler `CRCL`, `CFOR`, `NFME` e `VEPM` pelo esquema `CRM_DADOS`, e o resto pelo `ABC71`. Feito em 2026-11-18: com `ORACLE_ESQUEMA_DAS_VIEWS=CRM_DADOS` no `.env` do extrator, as consultas trocam `ABC71.` por `CRM_DADOS.` só nessas quatro tabelas (`extrator/src/oracle.ts`). Vazio, fica o `ABC71`, para a conta de desenvolvimento. Objeto novo no CRM vira um pedido de GRANT ao DBA, com o motivo.
