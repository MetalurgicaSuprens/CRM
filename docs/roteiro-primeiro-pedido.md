# Roteiro do primeiro pedido do CRM no SGI

O teste de ponta a ponta da F5, com o Lucas: um pedido real, enviado pelo CRM, gravado no SGI pela máquina do extrator (192.168.0.12) e cancelado depois no SGI. Fora deste teste, o envio no servidor e a gravação no SGI ficam desligados.

Tempo: uns 30 minutos.

Quem faz:
- **Henry:** o servidor, pelo computador dele, e a 192.168.0.12, onde só ele entra.
- **Lucas:** o pedido no CRM, a conferência no SGI e o cancelamento.

## Antes: combinar o pedido

- **Login:** o "Suprens" (códigos 1109 e 1701). O Lucas precisa conseguir entrar em `https://crm.suprens.com.br` com a chave de acesso dele. Se o convite venceu, gere outro:

  ```bash
  ssh -t cpd@crm.suprens.com.br sudo crm-admin novo-convite --usuario 50c159bb7ce4f0ed
  ```

- **Cliente:** um da carteira desses códigos:
  - ATIVO;
  - com tabela de preço PRINCIPAL em real;
  - de preferência um que já comprou pelo SGI6R, para comparar o pedido com um dele.
- **Itens:** um ou dois produtos, poucas peças, por exemplo 100 (1 cento).
- **Transportadora:** uma já cadastrada no ERP, não uma nova.
- **Entrega:** "Assim que possível".
- **Observação:** `TESTE CRM - CANCELAR`, para ninguém da Suprens liberar o pedido por engano.

## 1. Publicar a versão nova do servidor (Henry)

A versão leva o envio do pedido e as mudanças do Lucas desde 19/11: a cotação, o xPed e o PDF. O pacote já foi mandado ao servidor. No PowerShell do seu computador:

```bash
ssh -t cpd@crm.suprens.com.br sudo /opt/crm/publicar.sh /home/cpd/<pacote>.tar.gz
```

O nome do pacote está na mensagem de quem o montou. Depois, abra o CRM e confira que a tela de pedidos abre e chama "Cotação" o que era "Rascunho".

## 2. Ligar o envio no servidor (Henry)

Entre no servidor e rode, um de cada vez:

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

## 3. Ligar a gravação na 192.168.0.12 (Henry)

No cmd, em `C:\CRM`:

```bash
git pull
```

Abra o `extrator.env` no Bloco de Notas e acrescente, numa linha nova, `CRM_GRAVAR_NO_SGI=ligado`. Salve.

```bash
notepad %USERPROFILE%\crm-dados\extrator.env
```

## 4. Enviar o pedido (Lucas)

No CRM, monte o pedido combinado, revise e clique em "Enviar pedido", "Confirmar com chave de acesso". Anote o número: o primeiro é `CRM-00001`.

## 5. Acompanhar a gravação (Henry, na 192.168.0.12)

A tarefa "CRM - pedidos" faz tudo sozinha em até 5 minutos. Para não esperar, rode à mão. A trava impede que ela e a tarefa gravem ao mesmo tempo.

```bash
npm run pedidos -- --env "%USERPROFILE%\crm-dados\extrator.env" --dados "%USERPROFILE%\crm-dados"
```

| O resumo diz | O que é | O que fazer |
|---|---|---|
| `Gravado no SGI: CRM-00001 é o pedido 1234567, PEDIDO BLOQUEADO.` | Deu certo | Passo 6, com o número do SGI |
| `Em quarentena (veja o motivo na pasta quarentena)` | A conferência recusou | Ler `crm-dados\pedidos\quarentena\CRM-00001.motivo.txt` e mandar ao Claude |
| `Aguardando o cadastro da transportadora` | A transportadora não está no ERP | Escolher outra no próximo teste |
| `Não entrou no SGI, tenta de novo na próxima passada` | O SGI recusou ou deu erro | Criar o arquivo `PAUSAR` (abaixo) e mandar a mensagem ao Claude |
| `Outra passada de pedidos está rodando` | A tarefa agendada está com o pedido | Esperar um minuto e ver o registro: `Get-Content $env:USERPROFILE\crm-dados\registro\pedidos-*.log -Tail 20` |

Para parar tudo na hora, crie o arquivo `PAUSAR`:

```bash
type nul > %USERPROFILE%\crm-dados\pedidos\PAUSAR
```

## 6. Conferir no SGI (Lucas)

Abra o pedido pelo número que o resumo mostrou e compare com um pedido do SGI6R do mesmo cliente.

**Cabeçalho:**
- status PEDIDO BLOQUEADO;
- cliente, vendedor, condição de pagamento, transportadora e frete;
- classificação, tipo de entrega e data de entrega;
- CFOP, tabela e observação.

**Itens:**
- produto, quantidade em CT, preço de venda, preço de tabela e líquido;
- ICMS, IPI e ordem de compra.

Se algo estiver diferente do SGI6R, anote campo e valor e mande ao Claude.

## 7. Cancelar e desligar (Lucas e Henry)

1. **Lucas:** cancela o pedido no SGI, com a justificativa `TESTE CRM`.
2. **Henry, no servidor:** volta o envio para desligado.

   ```bash
   sudo sed -i 's/^CRM_ENVIO_DE_PEDIDOS=.*/CRM_ENVIO_DE_PEDIDOS=desligado/' /etc/crm/server.env && sudo systemctl restart crm
   ```

3. **Henry, na 192.168.0.12:** troca no `extrator.env` para `CRM_GRAVAR_NO_SGI=desligado` e apaga o `PAUSAR`, se foi criado.

O pedido `CRM-00001` continua no CRM como enviado. A situação dele no SGI só aparece na tela com a etapa 5.
