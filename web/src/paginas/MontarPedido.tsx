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
import { useValores } from "../contexto/valores";
import { dataDoMomento } from "dominio/datas";
import { LIMITE_DA_OBSERVACAO, totalDoPedido, valorDaLinha } from "dominio/pedido";
import {
  carregarCatalogo,
  carregarClientes,
  carregarRascunho,
  carregarSituacaoDosDados,
  enviarPedido,
  excluirRascunho,
  isDadosReais,
  salvarRascunho,
} from "../dados/api";
import { PedidoBloqueado } from "../dados/fonteDeDados";
import { correspondeAoClienteOuCidade, correspondeAoProduto, partNumberDaBusca } from "../dados/busca";
import { precoDigitado, precoInicialDoItem, problemasDoPedido, rascunhoNoCatalogo } from "../dados/pedido";
import { ROTULOS_DE_STATUS } from "../dados/rotulos";
import type { CatalogoDoCliente, ItemDoPedido, ProdutoDoCatalogo, Rascunho, RascunhoParaSalvar } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarComCentavos, formatarContagem, formatarDataCurta, formatarLocalECodigo, formatarMomento, formatarNumero } from "../formato";
import { Carregando } from "./Carregando";
import estilos from "./MontarPedido.module.css";

/** Tempo sem mexer no pedido até o rascunho ser salvo. */
const ESPERA_PARA_SALVAR_MS = 700;
/** Tempo que o protótipo finge esperar o aparelho liberar a chave. */
const ESPERA_SIMULADA_MS = 1_200;

/**
 * /pedidos/novo?cliente=... começa um pedido e põe no endereço o id do rascunho (&rascunho=...): recarregar
 * a página, ou o navegador reabrir a aba depois de o computador desligar, continua o mesmo pedido.
 * /pedidos/novo?grupo=... escolhe antes o CNPJ do grupo; /pedidos/rascunhos/:id continua um rascunho.
 */
export function MontarPedido() {
  const { id } = useParams();
  const [parametros, setParametros] = useSearchParams();
  const codigoCliente = parametros.get("cliente");
  const idDoNovo = parametros.get("rascunho");
  useEffect(() => {
    if (id || !codigoCliente || idDoNovo) return;
    const proximos = new URLSearchParams(parametros);
    proximos.set("rascunho", crypto.randomUUID());
    setParametros(proximos, { replace: true });
  }, [id, codigoCliente, idDoNovo, parametros, setParametros]);
  if (id) return <ContinuarRascunho id={id} codigoDoNovo={null} />;
  if (!codigoCliente) return <EscolherCliente codigoDoGrupo={parametros.get("grupo")} />;
  return idDoNovo ? <ContinuarRascunho id={idDoNovo} codigoDoNovo={codigoCliente} /> : <Carregando />;
}

type BuscaDoRascunho = { id: string; rascunho: Rascunho | null; erro: string | null };

/**
 * O rascunho como está no servidor agora: sem o cache das telas, que podia trazer uma versão de antes.
 * No pedido novo, o rascunho ainda não existe e começa vazio, com o id do endereço.
 */
function ContinuarRascunho({ id, codigoDoNovo }: { id: string; codigoDoNovo: string | null }) {
  const [busca, setBusca] = useState<BuscaDoRascunho | null>(null);
  useEffect(() => {
    let atual = true;
    carregarRascunho(id).then(
      (rascunho) => {
        if (atual) setBusca({ id, rascunho, erro: null });
      },
      (erro: unknown) => {
        if (atual) setBusca({ id, rascunho: null, erro: mensagemDo(erro) });
      },
    );
    return () => {
      atual = false;
    };
  }, [id]);
  if (busca?.id !== id) return <Carregando />;
  if (busca.erro) return <Indisponivel texto={busca.erro} />;
  const codigoCliente = busca.rascunho?.cliente.codigo ?? codigoDoNovo;
  if (!codigoCliente) return <Indisponivel texto={RASCUNHO_NAO_ENCONTRADO} />;
  return <Montagem codigoCliente={codigoCliente} idDoRascunho={id} inicial={busca.rascunho} />;
}

const RASCUNHO_NAO_ENCONTRADO = isDadosReais
  ? "Rascunho não encontrado: ele foi enviado ou descartado."
  : "Rascunho não encontrado. No protótipo, os rascunhos somem quando a página é recarregada.";

type PropsDaMontagem = { codigoCliente: string; idDoRascunho: string; inicial: Rascunho | null };

function Montagem({ codigoCliente, idDoRascunho, inicial }: PropsDaMontagem) {
  const { dados: catalogo, carregando, erro } = useCarga(`catalogo:${codigoCliente}`, () => carregarCatalogo(codigoCliente));
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  if (carregando || !situacao) return <Carregando />;
  if (erro instanceof PedidoBloqueado) return <ClienteSemPedido aviso={erro.message} />;
  if (!catalogo) return <Indisponivel texto={erro?.message ?? "Cliente não encontrado na sua carteira."} />;
  return <Formulario catalogo={catalogo} idDoRascunho={idDoRascunho} inicial={inicial} relogio={situacao.relogio} />;
}

// ---------------------------------------------------------------- formulário

type Quantidades = Record<string, number>;
/** Só os preços que o representante mudou, ou que vieram do rascunho; o resto usa o preço inicial do item. */
type Precos = Record<string, number>;

type PropsDoFormulario = { catalogo: CatalogoDoCliente; idDoRascunho: string; inicial: Rascunho | null; relogio: string };

function Formulario({ catalogo, idDoRascunho, inicial, relogio }: PropsDoFormulario) {
  const navegar = useNavigate();
  const hoje = dataDoMomento(relogio);
  // O rascunho diante do catálogo de hoje: o produto que saiu dele fica de fora, e o preço abaixo da tabela sobe para ela.
  const [doRascunho] = useState(() => rascunhoNoCatalogo(inicial?.itens ?? [], catalogo.produtos));
  const [quantidades, setQuantidades] = useState<Quantidades>(() => Object.fromEntries(doRascunho.itens.map((item) => [item.codigo, item.quantidade])));
  const [precos, setPrecos] = useState<Precos>(() => Object.fromEntries(doRascunho.itens.map((item) => [item.codigo, item.precoCento])));
  const [entrega, setEntrega] = useState<string | null>(inicial?.entrega ?? null);
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const [confirmando, setConfirmando] = useState(false);
  const [erroAoEnviar, setErroAoEnviar] = useState<string | null>(null);

  const linhas = useMemo(
    () =>
      catalogo.produtos
        .filter((produto) => (quantidades[produto.codigo] ?? 0) > 0)
        .map((produto) => ({ ...produto, quantidade: quantidades[produto.codigo] ?? 0, precoCento: precos[produto.codigo] ?? precoInicialDoItem(produto) })),
    [catalogo, quantidades, precos],
  );
  const conteudo = useMemo(() => conteudoDoPedido(catalogo.cliente.codigo, linhas, entrega, observacao), [catalogo, linhas, entrega, observacao]);
  const { existe, salvoEm, erroAoSalvar, salvarAgora, pararDeSalvar } = useRascunhoAutomatico(idDoRascunho, inicial, conteudo);
  const total = totalDoPedido(linhas);
  const problemas = problemasDoPedido(linhas, observacao, entrega, hoje);
  const alterar = useCallback((codigo: string, pecas: number) => setQuantidades((atuais) => ({ ...atuais, [codigo]: pecas })), []);
  const alterarPreco = useCallback((codigo: string, preco: number) => setPrecos((atuais) => ({ ...atuais, [codigo]: preco })), []);

  const enviar = useCallback(async () => {
    try {
      const rascunho = await salvarAgora();
      const pedido = await enviarPedido(rascunho.id);
      pararDeSalvar();
      navegar(`/pedidos/${pedido.numero}?enviado=1`, { replace: true });
    } catch (erro) {
      setConfirmando(false);
      setErroAoEnviar(mensagemDo(erro));
    }
  }, [salvarAgora, pararDeSalvar, navegar]);

  const descartar = () => {
    if (!existe || !window.confirm("Descartar este rascunho?")) return;
    pararDeSalvar();
    excluirRascunho(idDoRascunho).then(
      () => navegar("/pedidos?aba=rascunhos", { replace: true }),
      (erro: unknown) => setErroAoEnviar(mensagemDo(erro)),
    );
  };

  return (
    <div className={`${estilos.pagina} ${estilos.paginaDaMontagem}`}>
      <CabecalhoPagina
        antes={<Voltar para="/pedidos" rotulo="Pedidos" />}
        titulo="Incluir pedido"
        descricao={`${catalogo.cliente.nome} · ${catalogo.cliente.cidade}/${catalogo.cliente.uf} · ${catalogo.tabela}`}
      />
      <div className={estilos.grade}>
        <Catalogo catalogo={catalogo} quantidades={quantidades} alterar={alterar} />
        <div className={estilos.barraDoPedido}>
          <span>
            {formatarContagem(linhas.length, "produto", "produtos")} · <Valor valor={total} comCentavos />
          </span>
          <a href="#pedido" className={`${botoes.secundario} ${estilos.compacto}`}>
            Ver pedido
          </a>
        </div>
        {/* Em cima, o que fecha o pedido, sempre à vista; embaixo, os itens, que rolam (pedido do Lucas em 2026-10-20). */}
        <section id="pedido" className={estilos.resumo} aria-label="Seu pedido">
          <Cartao
            titulo="Seu pedido"
            icone={ShoppingBasket}
            subtitulo={`Preço da última compra; o mínimo é a ${catalogo.tabela}`}
            className={estilos.cartaoDoPedido}
          >
            <div className={estilos.campos}>
              <label className={`${estilos.campo} ${estilos.campoEmLinha}`}>
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
                <textarea rows={1} maxLength={LIMITE_DA_OBSERVACAO} value={observacao} onChange={(evento) => setObservacao(evento.target.value)} />
              </label>
            </div>
            <Fechamento
              total={total}
              problemas={linhas.length > 0 ? problemas : []}
              podeEnviar={problemas.length === 0}
              aoEnviar={() => setConfirmando(true)}
            />
            <AvisoDoRascunho foraDoCatalogo={doRascunho.foraDoCatalogo} subiramAoMinimo={doRascunho.subiramAoMinimo} />
            <ItensEscolhidos linhas={linhas} alterar={alterar} alterarPreco={alterarPreco} />
            <div className={estilos.rodapeDoPedido}>
              <p className={estilos.salvo} role="status">
                {erroAoEnviar ??
                  erroAoSalvar ??
                  (salvoEm ? `Rascunho salvo ${formatarMomento(salvoEm, relogio)}: fica em Pedidos, na aba Rascunhos.` : "O rascunho é salvo sozinho enquanto você monta o pedido.")}
              </p>
              {existe ? (
                <button type="button" className={estilos.descartar} onClick={descartar}>
                  <Trash size={14} aria-hidden="true" />
                  Descartar rascunho
                </button>
              ) : null}
            </div>
          </Cartao>
        </section>
      </div>
      <ConfirmarEnvio
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        aoConfirmar={enviar}
        resumo={
          <>
            {catalogo.cliente.nome} · {formatarContagem(linhas.length, "produto", "produtos")} · <Valor valor={total} comCentavos /> estimado
          </>
        }
      />
    </div>
  );
}

/** O que vai para o servidor: a mesma ordem de chaves sempre, para comparar com o que já foi salvo. */
function conteudoDoPedido(codigoCliente: string, itens: readonly ItemDoPedido[], entrega: string | null, observacao: string): Omit<RascunhoParaSalvar, "id"> {
  return { codigoCliente, itens: itens.map(({ codigo, quantidade, precoCento }) => ({ codigo, quantidade, precoCento })), entrega, observacao };
}

/**
 * Salva o rascunho sozinho, um pouco depois da última mudança e, na hora, quando a página fecha, sai da
 * tela ou o representante vai para outra tela: o pedido sobrevive ao computador desligar (pedido do
 * Lucas em 2026-11-05). Só começa quando há o que guardar: abrir um pedido novo e sair sem escolher nada
 * não deixa rascunho vazio. O id vem do endereço, então salvar de novo nunca duplica.
 */
function useRascunhoAutomatico(id: string, inicial: Rascunho | null, conteudo: Omit<RascunhoParaSalvar, "id">) {
  const [existe, setExiste] = useState(inicial !== null);
  const [salvoEm, setSalvoEm] = useState(inicial?.atualizadoEm ?? null);
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null);
  const conteudoAtual = JSON.stringify(conteudo);
  const ultimoSalvo = useRef(inicial ? JSON.stringify(conteudoDoPedido(inicial.cliente.codigo, inicial.itens, inicial.entrega, inicial.observacao)) : conteudoAtual);
  const parado = useRef(false);
  const temOQueGuardar = existe || conteudo.itens.length > 0;

  const salvarAgora = useCallback(async () => {
    const rascunho = await salvarRascunho({ id, ...conteudo });
    ultimoSalvo.current = conteudoAtual;
    setExiste(true);
    setSalvoEm(rascunho.atualizadoEm);
    setErroAoSalvar(null);
    return rascunho;
  }, [id, conteudo, conteudoAtual]);

  useEffect(() => {
    if (parado.current || conteudoAtual === ultimoSalvo.current || !temOQueGuardar) return;
    const espera = window.setTimeout(() => salvarAgora().catch((erro: unknown) => setErroAoSalvar(mensagemDo(erro))), ESPERA_PARA_SALVAR_MS);
    return () => window.clearTimeout(espera);
  }, [conteudoAtual, temOQueGuardar, salvarAgora]);

  // O que ainda não foi salvo, para mandar de uma vez quando a página sai; null quando não há nada.
  const pendente = useRef<(() => void) | null>(null);
  useEffect(() => {
    pendente.current =
      conteudoAtual === ultimoSalvo.current || !temOQueGuardar
        ? null
        : () => {
            ultimoSalvo.current = conteudoAtual;
            // A página já está saindo: o erro não teria onde aparecer, e o salvamento normal mostra os dele.
            salvarRascunho({ id, ...conteudo }, { aoSairDaPagina: true }).catch(() => undefined);
          };
  });
  useEffect(() => {
    const salvarJa = () => {
      if (!parado.current) pendente.current?.();
    };
    const aoMudarDeVisibilidade = () => {
      if (document.visibilityState === "hidden") salvarJa();
    };
    window.addEventListener("pagehide", salvarJa);
    document.addEventListener("visibilitychange", aoMudarDeVisibilidade);
    return () => {
      salvarJa();
      window.removeEventListener("pagehide", salvarJa);
      document.removeEventListener("visibilitychange", aoMudarDeVisibilidade);
    };
  }, []);

  /** Depois de enviar ou descartar, o rascunho não é salvo de novo. */
  const pararDeSalvar = useCallback(() => {
    parado.current = true;
  }, []);

  return { existe, salvoEm, erroAoSalvar, salvarAgora, pararDeSalvar };
}

/** O rascunho que voltou diferente do salvo, porque o catálogo do cliente mudou. */
function AvisoDoRascunho({ foraDoCatalogo, subiramAoMinimo }: { foraDoCatalogo: number; subiramAoMinimo: number }) {
  if (foraDoCatalogo === 0 && subiramAoMinimo === 0) return null;
  const avisos = [
    foraDoCatalogo === 1 ? "1 produto do rascunho saiu do catálogo do cliente e ficou fora do pedido." : null,
    foraDoCatalogo > 1 ? `${formatarNumero(foraDoCatalogo)} produtos do rascunho saíram do catálogo do cliente e ficaram fora do pedido.` : null,
    subiramAoMinimo > 0 ? `O preço de ${formatarContagem(subiramAoMinimo, "produto", "produtos")} subiu para a tabela do cliente, que aumentou.` : null,
  ];
  return (
    <p className={estilos.avisoDoRascunho} role="status">
      {avisos.filter(Boolean).join(" ")}
    </p>
  );
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
  const visiveis = useMemo(
    () => (filtro === "comprados" ? comprados : catalogo.produtos).filter((produto) => correspondeAoProduto(produto, busca)),
    [filtro, comprados, catalogo.produtos, busca],
  );
  return (
    <Cartao titulo="Produtos" icone={PackageSearch} subtitulo="Busque pelo código, pela família, pela medida ou pelo part number." className={estilos.cartaoDoCatalogo}>
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
        className={estilos.listaQueRola}
        itens={visiveis}
        chaveDe={(produto) => produto.codigo}
        vazio={filtro === "comprados" ? "Nada entre os já comprados. Procure em Todos." : "Nenhum produto com essa busca."}
        colunas={[
          { titulo: "Produto", ordenarPor: (produto) => produto.codigo, celula: (produto) => <Identificacao titulo={produto.codigo} detalhe={<DescricaoDoProduto produto={produto} busca={busca} />} /> },
          { titulo: "Embalagem", numerica: true, largura: 5.5, ordenarPor: (produto) => produto.embalagem, celula: (produto) => `${formatarNumero(produto.embalagem)} pç` },
          { titulo: "Cento", numerica: true, largura: 5, ordenarPor: precoInicialDoItem, celula: (produto) => <Valor valor={precoInicialDoItem(produto)} comCentavos /> },
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

type LinhaEscolhida = ProdutoDoCatalogo & { quantidade: number; precoCento: number };

type PropsDosItens = {
  linhas: LinhaEscolhida[];
  alterar: (codigo: string, pecas: number) => void;
  alterarPreco: (codigo: string, preco: number) => void;
};

function ItensEscolhidos({ linhas, alterar, alterarPreco }: PropsDosItens) {
  if (linhas.length === 0) return <p className={estilos.vazio}>Escolha os produtos na lista e as quantidades.</p>;
  return (
    <ul className={`${estilos.itens} ${estilos.listaQueRola}`}>
      {linhas.map((linha) => (
        <li key={linha.codigo} className={estilos.item}>
          <span className={estilos.descricaoDoItem}>
            <span className={estilos.codigo}>{linha.codigo}</span>
            <DescricaoDoProduto produto={linha} className={`${estilos.suave} ${estilos.detalheDoItem}`} />
          </span>
          <Quantidade valor={linha.quantidade} embalagem={linha.embalagem} rotulo={linha.codigo} aoMudar={(pecas) => alterar(linha.codigo, pecas)} />
          <span className={estilos.valorDoItem}>
            <Valor valor={valorDaLinha(linha)} comCentavos />
          </span>
          <PrecoDoItem linha={linha} aoMudar={(preco) => alterarPreco(linha.codigo, preco)} />
        </li>
      ))}
    </ul>
  );
}

/**
 * O preço do cento do item, que o representante pode mudar: vale ao sair do campo ou com Enter. Abaixo
 * da tabela do cliente, que é o mínimo, ele sobe para ela e avisa. Com os valores ocultos, o campo some.
 */
function PrecoDoItem({ linha, aoMudar }: { linha: LinhaEscolhida; aoMudar: (preco: number) => void }) {
  const { visiveis } = useValores();
  const [digitado, setDigitado] = useState(formatarComCentavos(linha.precoCento));
  const [subiuAoMinimo, setSubiuAoMinimo] = useState(false);
  useEffect(() => setDigitado(formatarComCentavos(linha.precoCento)), [linha.precoCento]);
  const confirmar = () => {
    const resultado = precoDigitado(digitado, linha.precoDaTabela);
    setSubiuAoMinimo(resultado?.subiuAoMinimo ?? false);
    setDigitado(formatarComCentavos(resultado?.preco ?? linha.precoCento));
    if (resultado) aoMudar(resultado.preco);
  };
  return (
    <div className={estilos.precoDoItem}>
      <label className={estilos.campoDoPreco}>
        <span>Cento R$</span>
        {visiveis ? (
          <input
            type="text"
            inputMode="decimal"
            value={digitado}
            aria-label={`Preço do cento de ${linha.codigo}, em reais`}
            onChange={(evento) => setDigitado(evento.target.value)}
            onBlur={confirmar}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") confirmar();
            }}
          />
        ) : (
          <span className={estilos.precoOculto}>••••</span>
        )}
      </label>
      {subiuAoMinimo ? (
        <span className={estilos.avisoDoPreco} role="status" title="O menor preço é o da tabela do cliente, com o desconto dele">
          Subiu para o mínimo: a tabela do cliente
        </span>
      ) : (
        // O mínimo primeiro: se faltar espaço, o que se corta é a última compra.
        <span className={estilos.referenciasDoPreco}>
          Mínimo <Valor valor={linha.precoDaTabela} comCentavos />
          {linha.ultimaCompra ? (
            <>
              {" "}
              · Última <Valor valor={linha.ultimaCompra.precoCento} comCentavos /> em {formatarDataCurta(linha.ultimaCompra.data)}
            </>
          ) : null}
        </span>
      )}
    </div>
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
        <span className={estilos.rotuloDoTotal}>Total estimado</span>
        <Valor valor={total} comCentavos />
      </div>
      {problemas.length > 0 ? (
        <ul className={estilos.problemas} role="status">
          {problemas.map((problema) => (
            <li key={problema}>{problema}</li>
          ))}
        </ul>
      ) : null}
      <button type="button" className={`${botoes.primario} ${botoes.positivo} ${estilos.enviar}`} disabled={!podeEnviar} onClick={aoEnviar}>
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
        O pedido entra bloqueado no SGI e passa pelas aprovações de sempre, e o SGI recalcula os preços pela tabela do cliente. Depois de enviado, não dá
        para alterar pelo CRM.
      </p>
      <div className={estilos.acoesDoDialogo}>
        <button type="button" className={botoes.secundario} onClick={aoFechar} disabled={aguardando}>
          Voltar
        </button>
        <button type="button" className={`${botoes.primario} ${botoes.positivo} ${botoes.aguardando}`} onClick={() => setAguardando(true)} disabled={aguardando}>
          <KeyRound size={18} aria-hidden="true" />
          {aguardando ? "Confirme no seu aparelho…" : "Confirmar com chave de acesso"}
        </button>
      </div>
      <p className={estilos.suave}>Protótipo: a confirmação é simulada.</p>
    </dialog>
  );
}

// ---------------------------------------------------------------- escolha do cliente

/** O pedido é sempre de um CNPJ: o grupo entra pelos CNPJs dele, e com ?grupo= só eles aparecem. */
function EscolherCliente({ codigoDoGrupo }: { codigoDoGrupo: string | null }) {
  const { dados: clientes } = useCarga("clientes", carregarClientes);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const [busca, setBusca] = useState("");
  if (!clientes || !situacao) return <Carregando />;
  const grupo = clientes.find((cliente) => cliente.codigo === codigoDoGrupo && cliente.cnpjs);
  const cnpjs = grupo?.cnpjs ?? clientes.flatMap((cliente) => cliente.cnpjs ?? [cliente]);
  const visiveis = cnpjs.filter((cliente) => correspondeAoClienteOuCidade(cliente, busca));
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        antes={grupo ? <Voltar para={`/clientes/${grupo.codigo}`} rotulo={grupo.nome} /> : <Voltar para="/pedidos" rotulo="Pedidos" />}
        titulo="Incluir pedido"
        descricao={grupo ? `Para qual CNPJ de ${grupo.nome} é o pedido?` : "Para qual cliente é o pedido?"}
      />
      <CampoDeBusca
        rotulo="Buscar cliente"
        valor={busca}
        dica="Nome, código ou cidade"
        aoMudar={setBusca}
        focarAoAbrir
        className={estilos.buscaDeCliente}
      />
      <Cartao titulo={grupo ? `CNPJs de ${grupo.nome}` : "Clientes da carteira"} icone={Users}>
        <TabelaResponsiva
          descricao={grupo ? `CNPJs de ${grupo.nome}` : "Clientes da carteira"}
          itens={visiveis}
          chaveDe={(cliente) => cliente.codigo}
          linkDe={(cliente) => `/pedidos/novo?cliente=${cliente.codigo}`}
          vazio="Nenhum cliente com essa busca."
          colunas={[
            {
              titulo: "Cliente",
              ordenarPor: (cliente) => cliente.nome,
              celula: (cliente) => (
                <Identificacao titulo={cliente.nome} detalhe={formatarLocalECodigo(cliente)} />
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

type PropsDaDescricao = { produto: Pick<ProdutoDoCatalogo, "familia" | "medida" | "partNumbers">; busca?: string; className?: string };

/** A descrição do produto, com todos os part numbers na dica quando ele tem mais de um. */
function DescricaoDoProduto({ produto, busca = "", className }: PropsDaDescricao) {
  const dica = produto.partNumbers.length > 1 ? `Part numbers: ${produto.partNumbers.join(", ")}` : undefined;
  return (
    <span className={className} title={dica}>
      {descricaoDe(produto, busca)}
    </span>
  );
}

/**
 * "FLEXIL · 14–22 mm · part number N906227 +1": a medida e o part number só quando existem. Com mais
 * de um part number, o que a busca achou (ou o primeiro) e quantos mais o produto tem.
 */
function descricaoDe(produto: PropsDaDescricao["produto"], busca: string): string {
  const destaque = partNumberDaBusca(produto.partNumbers, busca) ?? produto.partNumbers[0];
  const outros = produto.partNumbers.length - 1;
  const partNumber = destaque ? `part number ${destaque}${outros > 0 ? ` +${outros}` : ""}` : null;
  return [produto.familia, produto.medida, partNumber].filter(Boolean).join(" · ");
}
