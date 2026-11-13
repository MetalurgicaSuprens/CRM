# Passagem do projeto

Este documento reúne, para quem continua o projeto, o que não está no código nem no plano: onde paramos, as decisões do Lucas, o que se aprendeu sobre o ERP e os cuidados no Windows. A situação vale para 2026-11-10.

Leia nesta ordem: `CLAUDE.md`, `CLEAN_CODE.md`, `docs/plano.md`, este documento e `docs/dados-por-tela.md` (a lista campo a campo, com as perguntas decididas).

## Quem decide

O Lucas é o gestor do projeto e continua decidindo:
- as dúvidas de segurança;
- os pacotes novos;
- as telas que entram no menu;
- o visual.

Ele não é técnico. Nos resumos e nos próximos passos que vão para ele:
- use linguagem simples: "confere se o arquivo chegou inteiro", e não "confere o sha256";
- dê a cada item um nome simples e uma descrição técnica curta, que ele possa repassar ao TI;
- não cite nome de arquivo, função ou tabela;
- quando ele precisar decidir, faça uma pergunta simples, com o efeito prático de cada opção.

Ele discorda com clareza quando não concorda. Ele gosta de soluções pensadas desde o princípio, sem herdar o jeito antigo.

Nomes:
- Use o nome que o SGI já dá a cada conceito: o status do cadastro é Ativo, Inativo ou Substituído; o botão é "Incluir pedido".
- Não invente termo: o "negativo" e o "suspenso" já causaram retrabalho.
- Quando duas coisas dividirem a mesma palavra, mostre a diferença com números e deixe o Lucas escolher o nome. Exemplo: o "Inativo" do cadastro e a situação de compra, que virou "perdido".
- Antes de afirmar "nenhum" ou "todos" sobre os dados, diga de qual campo saiu a contagem.

O que proteger:
- **A carteira**, ou seja, quem compra o quê e quanto: só dentro do escopo do login.
- **A pessoa física:** fica fora do CRM.
- **O dado público da empresa,** como o endereço do CNPJ: pode entrar se alguma tela usa. O Lucas acha exagero protegê-lo.
- **Serviços de fora:** antes de mandar qualquer dado a um, leia os termos dele. A geocodificação do Google, por exemplo, proíbe usar o ponto fora do mapa dele.

## Montar o computador

1. Instale o Node 24.
2. No Windows, confirme que o OpenSSH está instalado em `C:\Windows\System32\OpenSSH`.
3. Baixe o repositório e rode `npm install`. O `.npmrc` não deixa rodar scripts de instalação.
4. Sem banco nenhum: `npm run dev:web` abre o protótipo com dados fictícios.
5. Com dados reais, siga o `README.md`:
   - crie o `extrator/.env` com a sua conta de leitura do Oracle, usando as chaves de `extrator/.env.example`;
   - crie o `data/representantes-autorizados.txt`;
   - rode `ver-crm-com-dados-reais.bat`.
6. O Oracle só é alcançado pela rede interna. Fora da empresa, é preciso VPN.
7. Os endereços do IBGE (CNEFE) põem os clientes no mapa a cada carga:
   - copie `data/cnefe` (766 zips, 1,4 GB) e `data/pontos-dos-enderecos.db` do computador do Lucas. São dados públicos;
   - do resto de `data/` não copie nada: lá ficam o app.db, as fotos com dados de clientes e as chaves;
   - cidade nova: baixe o zip dela no FTP do IBGE (Censo 2022, Arquivos_CNEFE/CSV/Municipio). O resumo do extrator lista os municípios que faltam.
8. A chave do id do cliente (`data/chave-do-id-do-cliente`) nasce na primeira foto:
   - cada computador gera a sua, e os ids mudam de uma chave para outra;
   - em produção, vale só a chave da máquina do extrator.

Contas:
- **Oracle:** a conta de leitura de cada programador serve para o desenvolvimento.
- **Antes do piloto (F4):** o extrator precisa de uma conta própria. Ela terá SELECT só nas tabelas e views da lista do plano, sem READ ANY TABLE, com views de colunas restritas, porque o Oracle não concede SELECT por coluna.
- **Bíblia Montadora:** essa conta também precisa de SELECT nas tabelas de preço TP1 e TP2.

## Onde paramos

Feito até agora: F1, F2, F3 e parte da F4 (veja as fases no plano).
- **Foto:** com manifesto e travas contra mudança grande. Ela não é gerada de novo quando nada mudou no ERP; isso é a impressão digital.
- **Envio:** por SFTP, testado com um servidor simulado.
- **Login:** chave de acesso.
- **Administração:** é um site à parte e mostra o aviso de carga recusada.
- **Limpeza:** os registros com mais de 12 meses são apagados.
- **Rascunho de pedido:** fica no servidor. O envio ao ERP é da F5.

Falta, em ordem:
1. **Conferir na tela o aviso de carga recusada da administração,** no computador e no celular. Para provocar o aviso, entregue na entrada de uma API de teste uma foto com o manifesto estragado.
2. **Investigar um teste que falhou uma vez.** O teste "recusa enviar sem foto com manifesto" falhou uma vez no `npm test` da raiz e não se repetiu em 20 rodadas. Suspeita: um erro sem ouvinte no servidor simulado, vindo do teste anterior.
3. **Hospedagem na Locaweb.** O plano já foi atualizado (2026-11-13). Escolhida a VPS 4 GB Linux (2 vCPU, 70 GB), separada da do site. A Locaweb confirmou acesso root, IP fixo, firewall, snapshots, datacenter no Brasil e contrato LGPD.
   - O firewall do painel não foi conferido quanto à regra por IP de origem. Não faz falta: o `ufw` do servidor e o `from=` da chave do extrator já limitam a porta 22 ao IP da Suprens.
   - Falta contratar, apontar o DNS do domínio e saber o IP fixo da Suprens.
4. **Instalar o servidor:** a pasta `deploy/` ficou pronta em 2026-11-13 (`deploy/README.md`). Ela traz o `npm run pacote`, que já foi testado aqui, e os scripts do servidor, que ainda não rodaram num Ubuntu de verdade: confira cada passo na primeira instalação. Faltam a rota `/api/saude` e os alertas.
5. **Chave do envio:** fica numa pasta só da conta do extrator.
   - O Windows recusa a chave privada em `data/` ("bad permissions"), porque todo usuário do computador lê a pasta.
   - O mesmo vale para a chave do id do cliente e para a lista de autorizados: elas também saem de `data/` quando a máquina do extrator for escolhida.
   - A chave nasce com ssh-keygen, e o icacls tira o acesso dos outros usuários.
6. **F5, pedidos sem depender do TI:**
   - a rota de envio, com confirmação pela chave de acesso;
   - a saída do pedido no servidor;
   - uma rotina na LAN que busca os pedidos, revalida no Oracle e grava o arquivo na pasta de cargas do SGI;
   - um operador importa o arquivo.
   - O importador do SGI precisa de um layout "CRM". Só isso depende de quem mantém o SGI.
   - Na revalidação:
     - o preço não pode ficar abaixo da tabela do cliente, porque o navegador manda o preço do cento;
     - a entrega fica a pelo menos 5 dias úteis, com a mesma `primeiraEntregaPossivel` da tela;
     - a quantidade é livre e não precisa ser múltipla da embalagem;
     - o pedido nasce PEDIDO BLOQUEADO.
   - Para não duplicar, ligue o pedido pelo número do CRM.
7. **Cópia da auditoria e backup:** a cópia da auditoria para a LAN e o backup do servidor também ficam para a F5, porque antes não há o que buscar.

Teste na rede interna (2026-11-10, pedido do Lucas): o `iniciar-crm-servidor.bat` abre os dados reais para o celular com um login provisório por senha (veja o `README.md`).
- É só para teste: o login seguro é a chave de acesso.
- Não leve o login por senha para o servidor da internet.

Esperando resposta do Lucas, sem pressa:
- **Visual que ele ainda não confirmou:**
  - ícone grande nos números do alto (o commit 3cb0f6b sai sozinho com `git revert`);
  - alerta amarelo (a tag `alerta-mostarda` guarda o anterior);
  - página travada (a tag `listas-com-rolagem-da-pagina` guarda o anterior);
  - gráfico em azul ou em verde (a recomendação foi manter o azul).
- **Regras dos dados que ele ainda não confirmou:**
  - a embalagem do EAN como passo da quantidade;
  - "já comprou" em 24 meses;
  - carteira de 36 meses;
  - o "alerta rápido de queda" do plano, que ainda não foi feito.
- **Calendário:** ele quer um calendário em que diz quais dias são úteis. Hoje é segunda a sexta menos os feriados nacionais.
- **Classificação por ramo:** quando a área de Vendas terminar a classificação dos clientes por ramo, o mix passa a comparar com clientes do mesmo ramo. A sugestão foi gravar o ramo no campo `SEGMENTO` do SGI, que hoje está vazio.

## Decisões do Lucas que não estão no plano

Dados e regras:
- **Carteira:** pelo `CRCL.VEND_1`, com compra nos últimos 36 meses.
- **Login com vários códigos:** um login tem um ou mais códigos, e as telas somam todos. Uma representação pode ter dois códigos porque cada contrato tem a sua comissão. Não proponha um login por código.
- **Pedidos e Faturados:** só os dos códigos do login.
- **Status do cadastro:** pelo `CLI3_STA`. O cliente fora de ativo fica na carteira e não recebe pedido. O `CRCL.SUSPENSO` não é lido.
- **Grupo de clientes:** o mesmo texto no campo "Grupo" do SGI (`CLI3_GRP`), digitado ou não, é um grupo quando tem 2 ou mais CNPJs na carteira do mesmo código.
  - Vazio, a tela do SGI grava o nome fantasia.
  - O grupo vira um cliente só, com os números somados. A ficha tem a parte "Por CNPJ", e o pedido pergunta o CNPJ.
  - Não volte à regra do "só o digitado" nem use a raiz do CNPJ.
  - Somar entre carteiras mexe na regra 4 do `CLAUDE.md`.
- **Código do ERP:** perde os zeros da esquerda da raiz do CNPJ. Para buscar ou mostrar como CNPJ, complete até 12 dígitos.
- **Projeção do mês:** o faturado mais o ritmo dos últimos 6 meses fechados, por dia útil, vezes os dias úteis que faltam, com a carteira do mês como piso (`dominio/projecao.ts`).
- **"Comprando menos" e "comprando mais":** exigem a mudança também no último trimestre, e o selo mostra o motivo.
- **Part numbers:** saem da Bíblia Montadora, só dos itens ativos.
- **Preço no pedido:**
  - começa na última compra do cliente (`NFDE.VLR_UNIT`, por cento) e nunca fica abaixo da tabela dele;
  - o catálogo usa a tabela padrão do cliente com o desconto do modelo, igual à view `SGI5_VIEW_VEN_TP2_VLR_LIQ_CLI`.
- **Endereço:** só o de empresa sai da LAN. O ponto no mapa vem do CNEFE, buscado dentro da empresa.
- **Potencial do mapa ("Onde crescer"):** pelo PIB agro mais indústria de 2021.
  - A cidade de usina ou de extração fica só com a agropecuária.
  - A regra completa está no cabeçalho de `extrator/src/mapas/gerarMapas.ts`.
- **Arquivos das cidades:** os arquivos estáticos das 766 cidades revelam em quais cidades a empresa tem cliente. O Lucas sabe disso.

Visual (o Lucas é exigente; mantenha a consistência):
- **Linha geral:** "bonito, caprichado, porém sóbrio, sem carnaval".
- **Cores:**
  - preto e vermelho;
  - o vermelho só no item ativo do menu, no traço dos títulos e num brilho leve do fundo, e nunca em ícone neutro nem em dado;
  - todo R$ em verde (`Valor`). Perda fica em vermelho (`Valor comoPerda`);
  - "Incluir pedido" e "Enviar pedido" em verde.
  - O título das colunas fica numa faixa grafite #3a3a38 com texto branco. A tabela que abre dentro de um pedido fica clara.
- **Gráficos:**
  - em azul, com a rampa de `--cor-dado-1..5`;
  - o ano anterior em cinza;
  - nunca dois eixos, sem caixa de legenda;
  - dica por mouse e teclado e o botão "Ver tabela".
- **Telas:**
  - os valores em R$ abrem ocultos;
  - sem centavos, a não ser nos pedidos;
  - toda tabela ordena pelo título da coluna.
- **Componentes:** use os que existem (`Cartao`, `Indicador`, `Valor`, `Selo`, `TabelaResponsiva`, `Filtros`, `IconeNoCirculo`, `IdentidadeDaAnalise`) e os tokens de `web/src/estilos/tokens.css`.
  - Cor nova de dado só depois de passar num validador de contraste.
  - Antes de trocar o visual inteiro, crie uma tag, para ele poder voltar. As tags já existentes são `visual-sobrio`, `visual-azul`, `graficos-aco`, `cabecalhos-cinza` e `cabecalhos-apagados`.
- **Larguras e ícones:**
  - confira nas larguras 360/390, 820/1024 e 1280/1366/1536/1920/2560;
  - no celular, confira também que a página não passa de 390 px de largura;
  - o ícone e o círculo em volta dele têm tamanho em px inteiros, e a diferença entre os dois é múltiplo de 8, senão o ícone sai do centro.

## O ERP

Banco:
- São dois sistemas no mesmo esquema Oracle (ABC71):
  - o Omega é o ERP comprado (VEPM, VEPD, CRCL, NFME, NFDE…);
  - o SGI é o sistema Delphi da casa (tabelas SGI5_*).
- O faturamento segue o RELCUS001:
  - TMO 310/315/316/317/320/325/326;
  - data `NFME.DT_EMISSAO`;
  - valor `VLR_TOTAL − NVL(Z_FRANCA_DESC, 0)`;
  - fica de fora `ID_CANCEL = 'S'`;
  - CT vezes 100.
- Somas do Oracle variam no último algarismo de uma carga para outra. Por isso a impressão digital arredonda a 12 algarismos.

Pedidos:
- O pedido nasce no SGI como PEDIDO BLOQUEADO e passa por aprovações (CTR/VD1/CON/VD2). Depois um operador o exporta ao Omega.
- O importador de arquivo do SGI tem dois cuidados:
  - aprova sozinho os TMO 320/325/326 (montadora). Por isso o layout "CRM" força PEDIDO BLOQUEADO em todo pedido;
  - recalcula o preço pela tabela do cliente.

## Cuidados no Windows

- **Edição de arquivos:**
  - não edite código com Get-Content/Set-Content do PowerShell 5.1: ele estraga os acentos;
  - `Out-File -Encoding utf8` grava com BOM, e o JSON.parse do Node recusa;
  - o `sed -i` do Git Bash troca o CRLF do arquivo por LF.
- **Vite:**
  - o watcher do Vite às vezes perde edições seguidas no mesmo arquivo, ou lê o arquivo no meio da gravação e serve o módulo vazio, com a tela em branco;
  - com o site aberto, grave num temporário e troque com um rename;
  - para destravar, atualize a data de modificação do arquivo.
- **SFTP:** no Git Bash, "sftp" é o do Git. O envio usa o do Windows (`programaDoOpenSsh`).
- **Testes:**
  - rode `npm test` na raiz, que roda os de cada pacote;
  - o `npx vitest run` na raiz pega também os testes de worktrees antigos em `.claude/worktrees`.
- **Teste de ponta a ponta no navegador:**
  - Chrome sem tela (headless), controlado por CDP, com o autenticador virtual (`WebAuthn.addVirtualAuthenticator`) para a chave de acesso;
  - o `--user-data-dir` precisa de caminho absoluto, senão ele se junta ao Chrome aberto;
  - o convite é de uso único;
  - o Chrome aceita o cookie `__Host-` com Secure em http://localhost.
- **Mudança de versão da foto:** ao subir `VERSAO_DO_ESQUEMA`, a API aberta recusa a foto velha até sair outra. Rode `npm run foto` logo depois.
- **Portas:**
  - 5175 é o site (fictício ou real);
  - 5176 é a API;
  - 5178 é a API de admin;
  - 5179 é a administração;
  - 4175 é o teste na rede interna, com a API dele na 5186.
  - As configurações "web" e "web-real" do `.claude/launch.json` dividem a 5175.
