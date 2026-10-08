import { useSearchParams } from "react-router";
import { CirclePause, CirclePlus, Lightbulb, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { somarMeses } from "../calendario";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { DataRelativa } from "../componentes/Quando";
import { Segmentos } from "../componentes/Segmentos";
import { Selo } from "../componentes/Selo";
import { Identificacao, TabelaResponsiva, type ColunaDaTabela } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { carregarAnalises, carregarSituacaoDosDados } from "../dados/api";
import { ROTULOS_DE_MERCADO, ROTULOS_DE_PORTE } from "../dados/rotulos";
import type {
  Analises as ListasDeAnalise,
  ClienteResumo,
  ClienteComMix,
  ClienteComVariacao,
  ClienteNovoOuReativado,
  ClienteParado,
} from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarContagem, formatarParticipacao, formatarPeriodo } from "../formato";
import { Carregando } from "./Carregando";
import estilos from "./Analises.module.css";

type Lista = keyof Omit<ListasDeAnalise, "semestre">;

const LISTAS: { valor: Lista; rotulo: string }[] = [
  { valor: "pararam", rotulo: "Pararam de comprar" },
  { valor: "menos", rotulo: "Comprando menos" },
  { valor: "mais", rotulo: "Comprando mais" },
  { valor: "novos", rotulo: "Novos e reativados" },
  { valor: "mix", rotulo: "Oportunidades de mix" },
];

export function Analises() {
  const { dados: analises } = useCarga("analises", carregarAnalises);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const [parametros, setParametros] = useSearchParams();
  const lista = lerLista(parametros.get("lista"));
  if (!analises || !situacao) return <Carregando />;
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina titulo="Análises" descricao="Quem pede atenção na carteira, pelas regras do CRM" />
      <Segmentos
        rotulo="Análise"
        opcoes={LISTAS.map((opcao) => ({ ...opcao, contagem: analises[opcao.valor].length }))}
        selecionado={lista}
        aoEscolher={(valor) => setParametros(valor === "pararam" ? {} : { lista: valor }, { replace: true })}
        className={estilos.listas}
      />
      <ListaEscolhida lista={lista} analises={analises} hoje={situacao.hoje} />
    </div>
  );
}

function ListaEscolhida({ lista, analises, hoje }: { lista: Lista; analises: ListasDeAnalise; hoje: string }) {
  switch (lista) {
    case "pararam":
      return <Pararam itens={analises.pararam} hoje={hoje} />;
    case "menos":
    case "mais":
      return <Ritmo direcao={lista} itens={analises[lista]} semestre={analises.semestre} />;
    case "novos":
      return <NovosEReativados itens={analises.novos} hoje={hoje} />;
    case "mix":
      return <Mix itens={analises.mix} />;
  }
}

function Pararam({ itens, hoje }: { itens: ClienteParado[]; hoje: string }) {
  const colunas: ColunaDaTabela<ClienteParado>[] = [
    { titulo: "Última compra", celula: (item) => <DataRelativa data={item.cliente.ultimaCompra} hoje={hoje} /> },
    { titulo: "Ciclo típico", celula: (item) => (item.cicloDias ? `${item.cicloDias} dias` : "irregular") },
    {
      titulo: "Deixou de entrar",
      numerica: true,
      celula: (item) => (
        <>
          <Valor valor={item.perdaMensal} />
          <span className={estilos.suave}>por mês</span>
        </>
      ),
    },
  ];
  return (
    <Cartao
      titulo="Pararam de comprar"
      icone={CirclePause}
      tom="critico"
      subtitulo="Sem comprar há mais que o dobro do ciclo típico (no mínimo 60 dias; 180 para quem compra sem ritmo) e sem pedido em aberto. Com 24 meses sem comprar, o cliente vira inativo e sai da lista."
    >
      <p className={estilos.resumo}>
        {formatarContagem(itens.length, "cliente", "clientes")} · <Valor valor={somar(itens.map((item) => item.perdaMensal))} compacto /> por mês deixaram de entrar
      </p>
      <TabelaDeClientes
        descricao="Clientes que pararam de comprar"
        itens={itens}
        colunas={colunas}
        vazio="Nenhum cliente parou de comprar."
      />
    </Cartao>
  );
}

type PropsRitmo = {
  direcao: "menos" | "mais";
  itens: ClienteComVariacao[];
  semestre: ListasDeAnalise["semestre"];
};

const RITMOS = {
  menos: { titulo: "Comprando menos", icone: TrendingDown, tom: "alerta", mudanca: "queda", vazio: "Nenhuma queda relevante no semestre." },
  mais: { titulo: "Comprando mais", icone: TrendingUp, tom: "ok", mudanca: "alta", vazio: "Nenhuma alta relevante no semestre." },
} as const;

function Ritmo({ direcao, itens, semestre }: PropsRitmo) {
  const ritmo = RITMOS[direcao];
  const atual = formatarPeriodo(semestre.inicio, semestre.fim);
  const anterior = formatarPeriodo(somarMeses(semestre.inicio, -12), somarMeses(semestre.fim, -12));
  const colunas: ColunaDaTabela<ClienteComVariacao>[] = [
    { titulo: anterior, numerica: true, celula: (item) => <Valor valor={item.semestreAnoAnterior} /> },
    { titulo: atual, numerica: true, celula: (item) => <Valor valor={item.semestre} /> },
    { titulo: "Diferença", numerica: true, celula: (item) => <Valor valor={diferenca(item)} comSinal /> },
    { titulo: "Variação", numerica: true, celula: (item) => <Variacao razao={item.variacao} /> },
    { titulo: "Em peças", numerica: true, celula: (item) => <Variacao razao={item.variacaoPecas} /> },
  ];
  return (
    <Cartao
      titulo={ritmo.titulo}
      icone={ritmo.icone}
      tom={ritmo.tom}
      subtitulo={`${atual} contra ${anterior}: ${ritmo.mudanca} de 20% ou mais e de pelo menos R$ 2 mil, com 3 compras ou mais nos dois períodos.`}
    >
      <p className={estilos.resumo}>
        {formatarContagem(itens.length, "cliente", "clientes")} · <Valor valor={somar(itens.map(diferenca))} compacto comSinal /> em {atual}
      </p>
      <TabelaDeClientes
        descricao={`Clientes ${ritmo.titulo.toLowerCase()}`}
        itens={itens}
        colunas={colunas}
        vazio={ritmo.vazio}
      />
      <p className={estilos.nota}>Em peças: a mesma comparação em quantidade, sem o efeito do reajuste de preço.</p>
    </Cartao>
  );
}

function NovosEReativados({ itens, hoje }: { itens: ClienteNovoOuReativado[]; hoje: string }) {
  const reativados = itens.filter((item) => item.tipo === "reativado").length;
  const colunas: ColunaDaTabela<ClienteNovoOuReativado>[] = [
    { titulo: "Tipo", celula: (item) => <TipoDeEntrada tipo={item.tipo} /> },
    { titulo: "Desde", celula: (item) => <DataRelativa data={item.desde} hoje={hoje} /> },
    { titulo: "Faturado desde então", numerica: true, celula: (item) => <Valor valor={item.faturadoDesde} /> },
  ];
  return (
    <Cartao
      titulo="Novos e reativados"
      icone={CirclePlus}
      subtitulo="Novo: primeira compra nos últimos 12 meses. Reativado: voltou a comprar nos últimos 12 meses depois de um ano ou mais sem comprar."
    >
      <p className={estilos.resumo}>
        {formatarContagem(itens.length - reativados, "novo", "novos")} e {formatarContagem(reativados, "reativado", "reativados")} ·{" "}
        <Valor valor={somar(itens.map((item) => item.faturadoDesde))} compacto /> desde que chegaram
      </p>
      <TabelaDeClientes
        descricao="Clientes novos e reativados"
        itens={itens}
        colunas={colunas}
        vazio="Nenhum cliente novo ou reativado nos últimos 12 meses."
      />
    </Cartao>
  );
}

function Mix({ itens }: { itens: ClienteComMix[] }) {
  const colunas: ColunaDaTabela<ClienteComMix>[] = [
    {
      titulo: "Famílias a oferecer",
      celula: (item) => (
        <span className={estilos.familias}>
          {item.oportunidades.map((oportunidade) => (
            <span key={oportunidade.familia} className={estilos.familia}>
              {oportunidade.familia} <span className={estilos.suave}>{formatarParticipacao(oportunidade.penetracao)}</span>
            </span>
          ))}
        </span>
      ),
    },
    {
      titulo: "Comparado a",
      celula: (item) =>
        `${ROTULOS_DE_MERCADO[item.cliente.mercado]}${item.porte ? `, porte ${ROTULOS_DE_PORTE[item.porte]}` : ", mercado todo"}`,
    },
    { titulo: "Faturado 12 meses", numerica: true, celula: (item) => <Valor valor={item.cliente.faturamento12m} /> },
  ];
  return (
    <Cartao
      titulo="Oportunidades de mix"
      icone={Lightbulb}
      subtitulo="Famílias que pelo menos metade dos clientes parecidos (mesmo mercado e porte, em toda a Suprens) comprou em 12 meses e que o cliente não compra há 24. O percentual é a parte dos parecidos que compra."
    >
      <p className={estilos.resumo}>{formatarContagem(itens.length, "cliente tem", "clientes têm")} famílias a oferecer, dos maiores para os menores</p>
      <TabelaDeClientes
        descricao="Clientes com oportunidades de mix"
        itens={itens}
        colunas={colunas}
        vazio="Todos os clientes já compram as famílias mais comuns entre os parecidos."
      />
    </Cartao>
  );
}

type PropsDaTabela<T> = { descricao: string; itens: T[]; colunas: ColunaDaTabela<T>[]; vazio: string };

/** Toda lista de análise começa pelo cliente, e a linha leva à ficha dele. */
function TabelaDeClientes<T extends { cliente: ClienteResumo }>({ colunas, ...props }: PropsDaTabela<T>) {
  return (
    <TabelaResponsiva
      {...props}
      chaveDe={(item) => item.cliente.codigo}
      linkDe={(item) => `/clientes/${item.cliente.codigo}`}
      colunas={[
        { titulo: "Cliente", celula: (item) => <Identificacao titulo={item.cliente.nome} detalhe={`${item.cliente.cidade}/${item.cliente.uf}`} /> },
        ...colunas,
      ]}
    />
  );
}

function TipoDeEntrada({ tipo }: { tipo: ClienteNovoOuReativado["tipo"] }) {
  return tipo === "reativado" ? <Selo rotulo="Reativado" icone={RotateCcw} tom="ok" /> : <Selo rotulo="Novo" icone={CirclePlus} tom="neutro" />;
}

function diferenca(item: ClienteComVariacao): number {
  return item.semestre - item.semestreAnoAnterior;
}

function somar(valores: number[]): number {
  return valores.reduce((soma, valor) => soma + valor, 0);
}

function lerLista(valor: string | null): Lista {
  return LISTAS.find((opcao) => opcao.valor === valor)?.valor ?? "pararam";
}
