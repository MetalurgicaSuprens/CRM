import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { KeyRound, PackageSearch, ShoppingBasket, Trash, Users } from "lucide-react";
import botoes from "../componentes/Botao.module.css";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { CampoDeBusca } from "../componentes/CampoDeBusca";
import { Cartao } from "../componentes/Cartao";
import { Quantidade } from "../componentes/Quantidade";
import { DataRelativa } from "../componentes/Quando";
import { Segmentos } from "../componentes/Segmentos";
import { SITUACOES, SituacaoCliente } from "../componentes/SituacaoCliente";
import { AvisoDePedidoBloqueado, StatusDoCliente } from "../componentes/StatusDoCliente";
import { Identificacao, TabelaResponsiva } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { Voltar } from "../componentes/Voltar";
import { dataDoMomento } from "dominio/datas";
import {
  carregarCatalogo,
  carregarClientes,
  carregarRascunho,
  carregarSituacaoDosDados,
  enviarPedido,
  excluirRascunho,
  salvarRascunho,
} from "../dados/api";
import { PedidoBloqueado } from "../dados/fonteDeDados";
import { correspondeAoClienteOuCidade } from "../dados/busca";
import { LIMITE_DA_OBSERVACAO, problemasDoPedido, totalDoPedido, valorDaLinha } from "../dados/pedido";
import { ROTULOS_DE_STATUS } from "../dados/rotulos";
import type { CatalogoDoCliente, ProdutoDoCatalogo, Rascunho, RascunhoParaSalvar } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarCodigoDoCliente, formatarContagem, formatarMomento, formatarNumero, normalizarParaBusca } from "../formato";
import { Carregando } from "./Carregando";
import estilos from "./MontarPedido.module.css";

/** Tempo sem mexer no pedido até o rascunho ser salvo. */
const ESPERA_PARA_SALVAR_MS = 700;
/** Tempo que o protótipo finge esperar o aparelho liberar a chave. */
const ESPERA_SIMULADA_MS = 1_200;

/** /pedidos/novo?cliente=... começa um pedido; /pedidos/rascunhos/:id continua um rascunho. */
export function MontarPedido() {
  const { id } = useParams();
  const [parametros] = useSearchParams();
  if (id) return <ContinuarRascunho id={id} />;
  const codigoCliente = parametros.get("cliente");
  return codigoCliente ? <Montagem codigoCliente={codigoCliente} inicial={null} /> : <EscolherCliente />;
}

function ContinuarRascunho({ id }: { id: string }) {
  const { dados: rascunho, carregando } = useCarga(`rascunho:${id}`, () => carregarRascunho(id));
  if (carregando) return <Carregando />;
  if (!rascunho) return <Indisponivel texto="Rascunho não encontrado. No protótipo, os rascunhos somem quando a página é recarregada." />;
  return <Montagem key={rascunho.atualizadoEm} codigoCliente={rascunho.cliente.codigo} inicial={rascunho} />;
}

function Montagem({ codigoCliente, inicial }: { codigoCliente: string; inicial: Rascunho | null }) {
  const { dados: catalogo, carregando, erro } = useCarga(`catalogo:${codigoCliente}`, () => carregarCatalogo(codigoCliente));
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  if (carregando || !situacao) return <Carregando />;
  if (erro instanceof PedidoBloqueado) return <ClienteSemPedido aviso={erro.message} />;
  if (!catalogo) return <Indisponivel texto={erro?.message ?? "Cliente não encontrado na sua carteira."} />;
  return <Formulario catalogo={catalogo} inicial={inicial} relogio={situacao.relogio} />;
}

// ---------------------------------------------------------------- formulário

type Quantidades = Record<string, number>;

function Formulario({ catalogo, inicial, relogio }: { catalogo: CatalogoDoCliente; inicial: Rascunho | null; relogio: string }) {
  const navegar = useNavigate();
  const hoje = dataDoMomento(relogio);
  const [quantidades, setQuantidades] = useState<Quantidades>(() =>
    Object.fromEntries((inicial?.itens ?? []).map((item) => [item.codigo, item.quantidade])),
  );
  const [entrega, setEntrega] = useState<string | null>(inicial?.entrega ?? null);
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const [confirmando, setConfirmando] = useState(false);
  const [erroAoEnviar, setErroAoEnviar] = useState<string | null>(null);
  const { idDoRascunho, salvoEm, erroAoSalvar, salvarAgora } = useRascunhoAutomatico(catalogo, inicial, { quantidades, entrega, observacao });

  const escolhidos = catalogo.produtos.filter((produto) => (quantidades[produto.codigo] ?? 0) > 0);
  const linhas = escolhidos.map((produto) => ({ ...produto, quantidade: quantidades[produto.codigo] ?? 0 }));
  const total = totalDoPedido(linhas);
  const problemas = problemasDoPedido(linhas, observacao, entrega, hoje);
  const alterar = useCallback((codigo: string, pecas: number) => setQuantidades((atuais) => ({ ...atuais, [codigo]: pecas })), []);

  const enviar = useCallback(async () => {
    try {
      const rascunho = await salvarAgora();
      const pedido = await enviarPedido(rascunho.id);
      navegar(`/pedidos/${pedido.numero}?enviado=1`, { replace: true });
    } catch (erro) {
      setConfirmando(false);
      setErroAoEnviar(mensagemDo(erro));
    }
  }, [salvarAgora, navegar]);

  const descartar = () => {
    if (!idDoRascunho || !window.confirm("Descartar este rascunho?")) return;
    void excluirRascunho(idDoRascunho).then(() => navegar("/pedidos?aba=rascunhos", { replace: true }));
  };

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        antes={<Voltar para="/pedidos" rotulo="Pedidos" />}
        titulo="Novo pedido"
        descricao={`${catalogo.cliente.nome} · ${catalogo.cliente.cidade}/${catalogo.cliente.uf} · ${catalogo.tabela}`}
      />
      <div className={estilos.grade}>
        <Catalogo catalogo={catalogo} quantidades={quantidades} alterar={alterar} />
        <div className={estilos.barraDoPedido}>
          <span>
            {formatarContagem(escolhidos.length, "produto", "produtos")} · <Valor valor={total} />
          </span>
          <a href="#pedido" className={`${botoes.secundario} ${estilos.compacto}`}>
            Ver pedido
          </a>
        </div>
        <section id="pedido" className={estilos.resumo} aria-label="Seu pedido">
          <Cartao titulo="Seu pedido" icone={ShoppingBasket} subtitulo={`Preços da ${catalogo.tabela}`} className={estilos.cartaoDoPedido}>
            <ItensEscolhidos linhas={linhas} alterar={alterar} />
            <div className={estilos.campos}>
              <label className={estilos.campo}>
                <span>Entrega desejada</span>
                <input type="date" min={hoje} value={entrega ?? ""} onChange={(evento) => setEntrega(evento.target.value || null)} />
              </label>
              <label className={estilos.campo}>
                <span>
                  Observação{" "}
                  <span className={estilos.suave}>
                    ({observacao.length}/{LIMITE_DA_OBSERVACAO})
                  </span>
                </span>
                <textarea rows={3} maxLength={LIMITE_DA_OBSERVACAO} value={observacao} onChange={(evento) => setObservacao(evento.target.value)} />
              </label>
            </div>
            <Fechamento
              total={total}
              problemas={linhas.length > 0 ? problemas : []}
              podeEnviar={problemas.length === 0}
              aoEnviar={() => setConfirmando(true)}
            />
            <p className={estilos.nota}>Preço da tabela do cliente, só para referência: o SGI recalcula quando recebe o pedido.</p>
            <p className={estilos.salvo} role="status">
              {erroAoEnviar ?? erroAoSalvar ?? (salvoEm ? `Rascunho salvo ${formatarMomento(salvoEm, relogio)}.` : "O rascunho é salvo sozinho enquanto você monta o pedido.")}
            </p>
            {idDoRascunho ? (
              <button type="button" className={estilos.descartar} onClick={descartar}>
                <Trash size={14} aria-hidden="true" />
                Descartar rascunho
              </button>
            ) : null}
          </Cartao>
        </section>
      </div>
      <ConfirmarEnvio
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        aoConfirmar={enviar}
        resumo={
          <>
            {catalogo.cliente.nome} · {formatarContagem(escolhidos.length, "produto", "produtos")} · <Valor valor={total} /> estimado
          </>
        }
      />
    </div>
  );
}

type ConteudoDoRascunho = { quantidades: Quantidades; entrega: string | null; observacao: string };

/**
 * Salva o rascunho sozinho, um pouco depois da última mudança. Só começa quando há o que guardar:
 * abrir um pedido novo e sair sem escolher nada não deixa rascunho vazio.
 */
function useRascunhoAutomatico(catalogo: CatalogoDoCliente, inicial: Rascunho | null, conteudo: ConteudoDoRascunho) {
  const [idDoRascunho, setIdDoRascunho] = useState(inicial?.id ?? null);
  const [salvoEm, setSalvoEm] = useState(inicial?.atualizadoEm ?? null);
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null);
  const { quantidades, entrega, observacao } = conteudo;
  const dados = useMemo<Omit<RascunhoParaSalvar, "id">>(
    () => ({
      codigoCliente: catalogo.cliente.codigo,
      itens: Object.entries(quantidades)
        .filter(([, pecas]) => pecas > 0)
        .map(([codigo, pecas]) => ({ codigo, quantidade: pecas })),
      entrega,
      observacao,
    }),
    [catalogo, quantidades, entrega, observacao],
  );
  const conteudoAtual = JSON.stringify(dados);
  const ultimoSalvo = useRef(conteudoAtual);

  const salvarAgora = useCallback(async () => {
    const rascunho = await salvarRascunho({ id: idDoRascunho, ...dados });
    ultimoSalvo.current = conteudoAtual;
    setIdDoRascunho(rascunho.id);
    setSalvoEm(rascunho.atualizadoEm);
    setErroAoSalvar(null);
    return rascunho;
  }, [dados, conteudoAtual, idDoRascunho]);

  useEffect(() => {
    if (conteudoAtual === ultimoSalvo.current) return;
    if (!idDoRascunho && dados.itens.length === 0) return;
    // Com os dados reais, o rascunho ainda não é gravado (F3): o motivo aparece na linha de status.
    const espera = window.setTimeout(() => salvarAgora().catch((erro: unknown) => setErroAoSalvar(mensagemDo(erro))), ESPERA_PARA_SALVAR_MS);
    return () => window.clearTimeout(espera);
  }, [conteudoAtual, idDoRascunho, dados.itens.length, salvarAgora]);

  return { idDoRascunho, salvoEm, erroAoSalvar, salvarAgora };
}

// ---------------------------------------------------------------- catálogo

type Filtro = "comprados" | "todos";

type PropsDoCatalogo = {
  catalogo: CatalogoDoCliente;
  quantidades: Quantidades;
  alterar: (codigo: string, pecas: number) => void;
};

function Catalogo({ catalogo, quantidades, alterar }: PropsDoCatalogo) {
  const comprados = useMemo(() => catalogo.produtos.filter((produto) => produto.jaComprou), [catalogo.produtos]);
  const [filtro, setFiltro] = useState<Filtro>(comprados.length > 0 ? "comprados" : "todos");
  const [busca, setBusca] = useState("");
  const termo = normalizarParaBusca(busca.trim());
  const visiveis = useMemo(
    () => (filtro === "comprados" ? comprados : catalogo.produtos).filter((produto) => correspondeABusca(produto, termo)),
    [filtro, comprados, catalogo.produtos, termo],
  );
  return (
    <Cartao titulo="Produtos" icone={PackageSearch} subtitulo="Busque pelo código, pela família, pela medida ou pelo part number.">
      <div className={estilos.ferramentas}>
        <CampoDeBusca rotulo="Buscar produto" valor={busca} dica="Código, família ou medida" aoMudar={setBusca} />
        <Segmentos
          rotulo="Produtos"
          opcoes={[
            { valor: "comprados", rotulo: "Já comprados", contagem: comprados.length },
            { valor: "todos", rotulo: "Todos", contagem: catalogo.produtos.length },
          ]}
          selecionado={filtro}
          aoEscolher={setFiltro}
        />
      </div>
      <TabelaResponsiva
        descricao="Produtos do catálogo"
        itens={visiveis}
        chaveDe={(produto) => produto.codigo}
        vazio={filtro === "comprados" ? "Nada entre os já comprados. Procure em Todos." : "Nenhum produto com essa busca."}
        colunas={[
          { titulo: "Produto", ordenarPor: (produto) => produto.codigo, celula: (produto) => <Identificacao titulo={produto.codigo} detalhe={descricaoDe(produto)} /> },
          { titulo: "Embalagem", numerica: true, largura: 5.5, ordenarPor: (produto) => produto.embalagem, celula: (produto) => `${formatarNumero(produto.embalagem)} pç` },
          { titulo: "Cento", numerica: true, largura: 5, ordenarPor: (produto) => produto.precoCento, celula: (produto) => <Valor valor={produto.precoCento} /> },
          {
            titulo: "Quantidade",
            numerica: true,
            largura: 9.5,
            celula: (produto) => (
              <Quantidade
                valor={quantidades[produto.codigo] ?? 0}
                embalagem={produto.embalagem}
                rotulo={produto.codigo}
                aoMudar={(pecas) => alterar(produto.codigo, pecas)}
              />
            ),
          },
        ]}
      />
    </Cartao>
  );
}

type LinhaEscolhida = ProdutoDoCatalogo & { quantidade: number };

function ItensEscolhidos({ linhas, alterar }: { linhas: LinhaEscolhida[]; alterar: (codigo: string, pecas: number) => void }) {
  if (linhas.length === 0) return <p className={estilos.vazio}>Escolha os produtos na lista e as quantidades.</p>;
  return (
    <ul className={estilos.itens}>
      {linhas.map((linha) => (
        <li key={linha.codigo} className={estilos.item}>
          <span className={estilos.descricaoDoItem}>
            <span className={estilos.codigo}>{linha.codigo}</span>
            <span className={estilos.suave}>{descricaoDe(linha)}</span>
          </span>
          <Quantidade valor={linha.quantidade} embalagem={linha.embalagem} rotulo={linha.codigo} aoMudar={(pecas) => alterar(linha.codigo, pecas)} />
          <span className={estilos.valorDoItem}>
            <Valor valor={valorDaLinha(linha)} />
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- envio

type PropsDoFechamento = {
  total: number;
  /** Os que a tela mostra: nenhum enquanto o pedido está vazio. */
  problemas: string[];
  podeEnviar: boolean;
  aoEnviar: () => void;
};

function Fechamento({ total, problemas, podeEnviar, aoEnviar }: PropsDoFechamento) {
  return (
    <div className={estilos.fechamento}>
      <div className={estilos.total}>
        <span>Total estimado</span>
        <Valor valor={total} />
      </div>
      {problemas.length > 0 ? (
        <ul className={estilos.problemas} role="status">
          {problemas.map((problema) => (
            <li key={problema}>{problema}</li>
          ))}
        </ul>
      ) : null}
      <button type="button" className={`${botoes.primario} ${estilos.enviar}`} disabled={!podeEnviar} onClick={aoEnviar}>
        Enviar pedido
      </button>
    </div>
  );
}

type PropsDoEnvio = {
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: () => Promise<void>;
  resumo: ReactNode;
};

/** Confirmação do envio: na F5, pede a digital ou o PIN de novo, ligado ao conteúdo do pedido. */
function ConfirmarEnvio({ aberto, aoFechar, aoConfirmar, resumo }: PropsDoEnvio) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [aguardando, setAguardando] = useState(false);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto && !elemento.open) elemento.showModal();
    if (!aberto && elemento.open) elemento.close();
  }, [aberto]);

  useEffect(() => {
    if (!aguardando) return;
    const espera = window.setTimeout(() => void aoConfirmar(), ESPERA_SIMULADA_MS);
    return () => window.clearTimeout(espera);
  }, [aguardando, aoConfirmar]);

  return (
    <dialog ref={dialogo} className={estilos.dialogo} onClose={aoFechar} aria-labelledby="titulo-do-envio">
      <h2 id="titulo-do-envio" className={estilos.tituloDoDialogo}>
        Enviar o pedido?
      </h2>
      <p className={estilos.resumoDoEnvio}>{resumo}</p>
      <p className={estilos.texto}>
        O pedido entra bloqueado no SGI e passa pelas aprovações de sempre. Depois de enviado, não dá para alterar pelo CRM.
      </p>
      <div className={estilos.acoesDoDialogo}>
        <button type="button" className={botoes.secundario} onClick={aoFechar} disabled={aguardando}>
          Voltar
        </button>
        <button type="button" className={`${botoes.primario} ${botoes.aguardando}`} onClick={() => setAguardando(true)} disabled={aguardando}>
          <KeyRound size={18} aria-hidden="true" />
          {aguardando ? "Confirme no seu aparelho…" : "Confirmar com chave de acesso"}
        </button>
      </div>
      <p className={estilos.suave}>Protótipo: a confirmação é simulada.</p>
    </dialog>
  );
}

// ---------------------------------------------------------------- escolha do cliente

function EscolherCliente() {
  const { dados: clientes } = useCarga("clientes", carregarClientes);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const [busca, setBusca] = useState("");
  if (!clientes || !situacao) return <Carregando />;
  const visiveis = clientes.filter((cliente) => correspondeAoClienteOuCidade(cliente, busca));
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina antes={<Voltar para="/pedidos" rotulo="Pedidos" />} titulo="Novo pedido" descricao="Para qual cliente é o pedido?" />
      <CampoDeBusca
        rotulo="Buscar cliente"
        valor={busca}
        dica="Nome, código ou cidade"
        aoMudar={setBusca}
        focarAoAbrir
        className={estilos.buscaDeCliente}
      />
      <Cartao titulo="Clientes da carteira" icone={Users}>
        <TabelaResponsiva
          descricao="Clientes da carteira"
          itens={visiveis}
          chaveDe={(cliente) => cliente.codigo}
          linkDe={(cliente) => `/pedidos/novo?cliente=${cliente.codigo}`}
          vazio="Nenhum cliente com essa busca."
          colunas={[
            {
              titulo: "Cliente",
              ordenarPor: (cliente) => cliente.nome,
              celula: (cliente) => (
                <Identificacao titulo={cliente.nome} detalhe={`${cliente.cidade}/${cliente.uf} · ${formatarCodigoDoCliente(cliente.codigoErp)}`} />
              ),
            },
            {
              titulo: "Status",
              largura: 7,
              ordenarPor: (cliente) => ROTULOS_DE_STATUS[cliente.status],
              celula: (cliente) => <StatusDoCliente status={cliente.status} />,
            },
            { titulo: "Situação", ordenarPor: (cliente) => SITUACOES[cliente.situacao].rotulo, celula: (cliente) => <SituacaoCliente situacao={cliente.situacao} /> },
            { titulo: "Última compra", ordenarPor: (cliente) => cliente.ultimaCompra, celula: (cliente) => <DataRelativa data={cliente.ultimaCompra} hoje={situacao.hoje} /> },
          ]}
        />
      </Cartao>
    </div>
  );
}

function ClienteSemPedido({ aviso }: { aviso: string }) {
  return (
    <div className={estilos.pagina}>
      <Voltar para="/pedidos" rotulo="Pedidos" />
      <AvisoDePedidoBloqueado texto={aviso} />
    </div>
  );
}

function Indisponivel({ texto }: { texto: string }) {
  return (
    <div className={estilos.pagina}>
      <Voltar para="/pedidos" rotulo="Pedidos" />
      <p className={estilos.vazio}>{texto}</p>
    </div>
  );
}

// ---------------------------------------------------------------- apoio

function mensagemDo(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Não deu para falar com o servidor. Tente de novo.";
}

/** "FLEXIL · 14–22 mm · part number CF420118": a medida e o part number só quando existem. */
function descricaoDe(produto: Pick<ProdutoDoCatalogo, "familia" | "medida" | "partNumber">): string {
  const partNumber = produto.partNumber ? `part number ${produto.partNumber}` : null;
  return [produto.familia, produto.medida, partNumber].filter(Boolean).join(" · ");
}

function correspondeABusca(produto: ProdutoDoCatalogo, termo: string): boolean {
  if (!termo) return true;
  return [produto.codigo, produto.familia, produto.medida ?? "", produto.partNumber ?? ""].some((campo) =>
    normalizarParaBusca(campo).includes(termo),
  );
}
