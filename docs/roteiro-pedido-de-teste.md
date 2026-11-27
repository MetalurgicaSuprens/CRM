# Roteiro do pedido de teste do CRM no SGI

O teste de ponta a ponta dos pedidos, com o Lucas: um pedido real, enviado pelo CRM no ar, gravado no SGI pela máquina do extrator (192.168.0.12), conferido no SGI e de volta no CRM. Fora do teste, o envio no servidor e a gravação no SGI ficam desligados.

O primeiro teste foi em 2026-11-23: o `CRM-00001` virou o pedido 1149872 ([`pedido-no-sgi.md`](pedido-no-sgi.md), "Gravação no SGI").

**O segundo teste** confere o que mudou depois dele e só passou nos testes automáticos:
- o part number do item gravado no SGI (`PV2_PNU`, commit `dc93a0d`);
- o número do SGI no andamento do pedido no CRM (commit `1379fe0`);
- a ordem de compra do pedido no SGI e na tela.

Tempo: uns 40 minutos, mais a espera da foto seguinte para o passo 8.

Quem faz:
- **Henry:** o servidor, pelo computador dele, e a 192.168.0.12, onde só ele entra.
- **Lucas:** o pedido no CRM, a conferência no SGI e no CRM.

## Antes: o pedido combinado

- **Cliente:** MITSUBISHI CATALAO HPE, código do ERP `543057430011`, do representante 1401, ATIVO, tabela própria `MITSUBISHI CATA`.
- **Login:** um login de teste com o código 1401 (passo 2). O 1401 já está no login da Star Vendas, e o mesmo código em dois logins só vale com a versão do passo 1.
- **Itens:** os dois que a Mitsubishi comprou por último e que têm part number na tabela dela. Na montagem, o campo PN de cada um já vem preenchido; não mexa.

  | Produto | Peças | Part number que vem no item |
  |---|---|---|
  | `CRIF7090` | 100 | `CA150243` |
  | `CRIF80100` | 100 | `CA611363` |

- **Condições:** as que a Mitsubishi usa nos pedidos dela:
  - transportadora TK LOGISTICA(S), CNPJ 04.657.635/0007-02;
  - condição de pagamento 30 DDL (1002), a do cadastro;
  - classificação industrialização;
  - frete parcial: não aceita; xPed: não.
- **Ordem de compra:** `TESTE CRM 2`, para conferir a ordem de compra no SGI.
- **Entrega:** "Assim que possível".
- **Observação:** `TESTE CRM - NAO LIBERAR`, para ninguém da Suprens liberar o pedido por engano.
- **Ninguém faz outro pedido da Mitsubishi no SGI durante o teste:** o SGI recusa dois pedidos do mesmo cliente em menos de 4 minutos.

## 1. Publicar a versão nova do servidor (Henry)

A versão leva o mesmo código em mais de um login (commit `cd4129d`), o Fastify 5.12.8 e o Mapa fora do menu. Ela não muda o extrator, a foto nem o `app.db`. No computador de desenvolvimento, com o `main` atualizado:

```bash
npm run pacote
```

```bash
scp deploy/pacotes/crm-<versão>.tar.gz cpd@crm.suprens.com.br:
```

```bash
ssh -t cpd@crm.suprens.com.br sudo /opt/crm/publicar.sh crm-<versão>.tar.gz
```

Confira no CRM que o Mapa saiu do menu: é a versão nova.

## 2. Criar o login de teste (Henry, e depois o Lucas)

```bash
ssh -t cpd@crm.suprens.com.br sudo crm-admin convidar --nome "Lucas - teste 1401" --codigos 1401
```

A resposta traz o id do login, entre parênteses, e o link do convite. Anote o id (passo 9) e mande o link ao Lucas, que o abre no aparelho dele e cria a chave de acesso.

## 3. Ligar o envio no servidor (Henry)

```bash
ssh cpd@crm.suprens.com.br
```

```bash
sudo sed -i 's/^CRM_ENVIO_DE_PEDIDOS=.*/CRM_ENVIO_DE_PEDIDOS=ligado/' /etc/crm/server.env
```

```bash
sudo systemctl restart crm && sudo journalctl -u crm -n 5 --no-pager
```

O registro tem de mostrar **"Pedidos enviados vão para /srv/crm-troca/saida."**

## 4. Ligar a gravação na 192.168.0.12 (Henry)

O extrator dessa máquina já está no commit `00c9088`, que tem o part number e a correção do número do SGI: não precisa de `git pull`. Abra o `extrator.env` e troque para `CRM_GRAVAR_NO_SGI=ligado` (ou acrescente a linha). Salve.

```bash
notepad %USERPROFILE%\crm-dados\extrator.env
```

## 5. Enviar o pedido (Lucas)

No CRM, com o login de teste: Incluir pedido, a Mitsubishi, os itens e as condições combinados. Confira o PN embaixo de cada item antes de enviar. "Enviar pedido", "Confirmar com chave de acesso". Anote o número do CRM (o `CRM-00002` ou o seguinte).

## 6. Acompanhar a gravação (Henry, na 192.168.0.12)

A tarefa "CRM - pedidos" faz tudo sozinha em até 5 minutos. Para não esperar, rode à mão; a trava impede que ela e a tarefa gravem ao mesmo tempo.

```bash
npm run pedidos -- --env "%USERPROFILE%\crm-dados\extrator.env" --dados "%USERPROFILE%\crm-dados"
```

| O resumo diz | O que é | O que fazer |
|---|---|---|
| `Gravado no SGI: CRM-0000N é o pedido 1234567, PEDIDO BLOQUEADO.` | Deu certo | Passo 7, com o número do SGI |
| `Em quarentena (veja o motivo na pasta quarentena)` | A conferência recusou | Ler `crm-dados\pedidos\quarentena\CRM-0000N.motivo.txt` e mandar ao Claude |
| `Aguardando o cadastro da transportadora` | A transportadora não está no ERP | Mandar ao Claude: a TK LOGISTICA(S) está ativa na foto |
| `Não entrou no SGI, tenta de novo na próxima passada` | O SGI recusou ou deu erro | Criar o arquivo `PAUSAR` (abaixo) e mandar a mensagem ao Claude |
| `Outra passada de pedidos está rodando` | A tarefa agendada está com o pedido | Esperar um minuto e ver o registro: `Get-Content $env:USERPROFILE\crm-dados\registro\pedidos-*.log -Tail 20` |

Para parar tudo na hora, crie o arquivo `PAUSAR`:

```bash
type nul > %USERPROFILE%\crm-dados\pedidos\PAUSAR
```

## 7. Conferir no SGI (Lucas)

Abra o pedido pelo número que o resumo mostrou e compare com o último pedido da Mitsubishi feito pelo SGI6R.

**Cabeçalho:**
- status PEDIDO BLOQUEADO;
- cliente, vendedor 1401, condição 30 DDL, transportadora TK LOGISTICA(S) e frete;
- classificação industrialização, entrega e data de entrega;
- ordem de compra `TESTE CRM 2`;
- CFOP, tabela `MITSUBISHI CATA` e observação.

**Itens, o ponto principal deste teste:**
- part number `CA150243` no `CRIF7090` e `CA611363` no `CRIF80100`;
- produto, quantidade em CT, preço de venda, preço de tabela e líquido;
- ICMS, IPI e ordem de compra do item.

Se algo estiver diferente do SGI6R, anote campo e valor e mande ao Claude.

## 8. Conferir no CRM (Lucas)

Depois da foto seguinte (até 30 minutos, das 7h às 19h), em Pedidos, aba "Enviados pelo CRM", abra o pedido:
- a situação "Em aprovação" e o **número do SGI** do passo 6 (antes da correção, aparecia "undefined");
- o part number e a ordem de compra dos itens;
- a transportadora com o CNPJ inteiro e as condições.

## 9. Desligar (Henry)

1. **No servidor:** volta o envio para desligado e desativa o login de teste, com o id do passo 2:

   ```bash
   sudo sed -i 's/^CRM_ENVIO_DE_PEDIDOS=.*/CRM_ENVIO_DE_PEDIDOS=desligado/' /etc/crm/server.env && sudo systemctl restart crm
   ```

   ```bash
   sudo crm-admin desativar --usuario <id do login de teste>
   ```

2. **Na 192.168.0.12:** troca no `extrator.env` para `CRM_GRAVAR_NO_SGI=desligado` e apaga o `PAUSAR`, se foi criado.

O pedido fica no SGI como PEDIDO BLOQUEADO até o Lucas decidir. A tela de pedidos do SGI não cancela, só exclui; o pedido excluído aparece no CRM como cancelado, e o que fica bloqueado aparece em aprovação. Nos dois casos, ninguém libera.
