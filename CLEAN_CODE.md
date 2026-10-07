# Clean Code — regras do projeto

Fonte única de regras de estilo e limpeza de código para este repositório. Vale para código de produção e testes, em qualquer módulo (web, server).

## Preceitos

O código é lido muito mais do que é escrito. Otimize para o próximo leitor.
Clareza vale mais que esperteza. Limpeza incremental vale mais que rewrite.

## 0. Inegociáveis

- **Regra do Escoteiro.** Cada arquivo que você toca deve ficar um pouco mais limpo: um nome, uma extração, um comentário morto, um teste. Sem reescrever módulos vizinhos "já que estou aqui".
- **Não quebre comportamento** salvo pedido explícito.
- **Sem generalidade especulativa.** Não crie abstração, config ou "gancho para o futuro" que ninguém usa agora.
- Rascunho sujo só é aceito se você limpar no mesmo turno (nomes, tamanho, duplicação, testes).
- Se não der para deixar limpo, diga o que ficou sujo e por quê. Não entregue bagunça em silêncio.

## 1. Nomes

Nomes são a documentação principal.

- O nome revela intenção: por que existe, o que faz, como se usa.
- Pronunciável e pesquisável. Evite `d`, `tmp2`, `data`, `info`, `obj`, `mgr`, `proc`, salvo se for o termo real do domínio.
- Uma palavra por conceito. Não chame a mesma ideia de `fetch` num lugar e `get`/`retrieve`/`load` em outro sem motivo.
- Tipos/classes/records: substantivos (`Invoice`, `Pedido`, `SessaoCarga`).
- Funções/métodos: verbos (`calcularTotal`, `agendarEntrega`, `isAtrasado`).
- Booleanos: predicados (`isAtivo`, `hasPermissao`, `canRetry`). Nunca `flag` nem `status` como bool.
- Sem Hungarian (`strNome`) e sem prefixo `m_` salvo convenção da linguagem.
- `i` serve como índice de loop curto. Não serve como variável de módulo.
- Proibido: nome engraçado; `Produto` vs `ProdutoInfo` vs `ProdutoData` com os mesmos campos; nome que precisa de comentário para ser entendido.
- Ao renomear, atualize o alcance real. Não deixe alias "por precaução".

## 2. Funções

Uma função faz uma coisa, num único nível de abstração.

- Se um bloco ganha um nome que não é só repetir o pai, extraia.
- Meta: < 20 linhas de lógica real e ≤ 2 argumentos. Terceiro argumento precisa de motivo. Quatro ou mais → objeto de parâmetro.
- Argumento booleano que escolhe caminho (`processar(pedido, true)`) quase sempre são duas funções.
- `switch`/`if-elif` longo por tipo ou modo: isole num lugar só; prefira estratégia/tabela/polimorfismo quando o idioma do projeto já usa isso.
- Função de alto nível lê como sumário. Detalhe fica nas funções logo abaixo (regra do step-down).
- Comando muda estado. Consulta devolve valor. `getUsuario` não grava no banco.
- Prefira exceção ou `Result` a código mágico de retorno. Não use `null`/`undefined` como falha silenciosa se o tipo pode expressar ausência.

Forma boa:

```
cumprirPedido(pedido)
  reservarEstoque(pedido)
  cobrarCliente(pedido)
  agendarEnvio(pedido)
```

Forma ruim: uma função de 80 linhas com SQL + HTTP + PDF + e-mail.

## 3. Comentários

Último recurso. Escreva comentário só para:

- **por quê** (restrição, workaround, regra legal, performance não óbvia);
- contrato de API pública que o tipo não expressa;
- aviso ("não reordene", "esta ordem de lock evita deadlock").

Não escreva:

- narração da linha seguinte (`// incrementa contador`);
- código comentado (git já guarda história);
- banner/"seção" se a estrutura já agrupa;
- `TODO` sem dono e sem condição.

Se o comentário explica o quê, renomeie ou extraia.

## 4. Duplicação

- Conhecimento repetido (a mesma regra de negócio em dois lugares) deve virar um só.
- Semelhança acidental (dois blocos parecidos que vão mudar por motivos diferentes) não deve ser unificada. Isso é abstração errada.
- Antes de extrair helper, nomeie a regra. Se não consegue nomear, ainda não extraia.

## 5. Módulos e classes/componentes

- Um módulo/classe/componente/arquivo tem um motivo para mudar (SRP). Se a descrição usa "e" (`ParserEUploader`, componente que busca + valida + renderiza), separe.
- Poucos métodos/exports públicos e coesos. Dezena de exports públicos é cheiro.
- Código relacionado fica perto (distância vertical).
- Na borda do app, dependa de abstração que o projeto controla. Biblioteca de terceiro não vaza para o domínio inteiro. Encapsule uma vez (ex.: `api.ts` encapsula as chamadas HTTP; `oracle.ts` encapsula o driver Oracle).
- Tipo que cruza a borda API↔web (request/response) fica burro e explícito. Comportamento de domínio fica no domínio.

## 6. Erros

- O happy path continua legível. Tire o tratamento de erro do meio do fluxo (early return, extração, `Result`).
- Falhe alto na borda (rota HTTP, componente de página). Não engula exceção em silêncio.
- Exceção não é fluxo normal.
- Valide na borda (query params, formulário, arquivo). O núcleo (SQL, cálculo) trabalha com dados já validados quando der.

## 7. Testes

- Código sem teste da lógica que importa não está limpo.
- Mudou comportamento ou extraiu regra: atualize/crie teste no mesmo turno.
- O harness deste projeto é o **vitest**. Nasce com teste, no mesmo turno:
  - toda regra de negócio: faturamento, atribuição, ciclo de compra, análises, conversão de unidade, validação de pedido;
  - toda regra de segurança: escopo por representante, sessão, convite, validação de entrada.
- Tela é conferida no navegador (Browser pane), no desktop e no celular, antes de dar a mudança como concluída.
- FIRST (rápido, independente, repetível, auto-validável, escrito junto do código); um conceito por teste; nome descreve comportamento (`calcula_multa_apos_carencia`), não `test1`; arrange/act/assert; não testar privado se a API pública já cobre.

## 8. Formatação

- Siga o estilo do arquivo que você está editando.
- Linha em branco separa conceitos; não espalhe vazio no meio de um algoritmo curto.
- Declare variável perto do primeiro uso.
- Não misture reformatação cosmética com mudança de lógica.

## 9. Design simples (gate antes de encerrar)

Nesta ordem:

1. `tsc --noEmit` e vitest passam, e a tela foi conferida no navegador?
2. Sumiu o conhecimento duplicado?
3. Nomes e estrutura expressam intenção sem comentário?
4. Sobrou classe/função que não paga o próprio custo? Remova.
5. SOLID só no grão da mudança atual. Componente de 10 linhas não ganha três arquivos novos. YAGNI vence.

## 10. Como trabalhar

- Leia o código vizinho. Use o vocabulário que já existe (nomes em português para conceitos de negócio — `produto`, `faixa`, `apontamento` — como já é a convenção deste repositório).
- Descreva a menor mudança de comportamento (uma frase) antes de mexer.
- Teste/checagem manual → implementação mínima → extrair/renomear → escoteiro.
- Não invente API, coluna de banco, env var ou arquivo.
- Não adicione markdown ou config que ninguém pediu.
- Prioridade: instrução explícita do pedido atual > convenção já existente nos arquivos > este `CLEAN_CODE.md` > idioma genérico da linguagem.
