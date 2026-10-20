import { useSearchParams } from "react-router";
import { CirclePlus, RotateCcw } from "lucide-react";
import { somarMeses } from "dominio/datas";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Filtros } from "../componentes/Filtros";
import { ANALISES, CartaoDaAnalise, type TipoDeAnalise } from "../componentes/IdentidadeDaAnalise";
import { NomeDoCliente } from "../componentes/NomeDoCliente";
import { DataRelativa } from "../componentes/Quando";
import { Selo } from "../componentes/Selo";
import travada from "../componentes/PaginaTravada.module.css";
import { Identificacao, TabelaResponsiva, type ColunaDaTabela } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import type { Ordem } from "../componentes/ordenacao";
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
import { formatarContagem, formatarLocalDoCliente, formatarParticipacao, formatarPeriodo, formatarSemestres } from "../formato";
import { Carregando } from "./Carregando";
import estilos from "./Analises.module.css";

/** Na ordem da tela: primeiro o que pede atenção, por último a oportunidade. */
const LISTAS: readonly TipoDeAnalise[] = ["pararam", "menos", "mais", "novos", "mix"];

export function Analises() {
  const { dados: analises } = useCarga("analises", carregarAnalises);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const [parametros, setParametros] = useSearchParams();
  const lista = lerLista(parametros.get("lista"));
  if (!analises || !situacao) return <Carregando />;
  return (
    <div className={`${estilos.pagina} ${travada.pagina}`}>
      <CabecalhoPagina titulo="Análises" descricao="Quem pede atenção na carteira, pelas regras do CRM" />
      <Filtros
        rotulo="Análise"
        opcoes={LISTAS.map((valor) => ({ valor, ...ANALISES[valor], quantidade: analises[valor].length }))}
        selecionado={lista}
        aoEscolher={(escolhida) => setParametros(escolhida === "pararam" ? {} : { lista: escolhida }, { replace: true })}
      />
      <ListaEscolhida lista={lista} analises={analises} hoje={situacao.hoje} />
    </div>
  );
}

function ListaEscolhida({ lista, analises, hoje }: { lista: TipoDeAnalise; analises: ListasDeAnalise; hoje: string }) {
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
    { titulo: "Última compra", ordenarPor: (item) => item.cliente.ultimaCompra, celula: (item) => <DataRelativa data={item.cliente.ultimaCompra} hoje={hoje} /> },
    { titulo: "Ciclo típico", ordenarPor: (item) => item.cicloDias, celula: (item) => (item.cicloDias ? `${item.cicloDias} dias` : "irregular") },
    {
      titulo: "Deixou de entrar",
      numerica: true,
      ordenarPor: (item) => item.perdaMensal,
      celula: (item) => (
        <>
          <Valor valor={item.perdaMensal} comoPerda />
          <span className={estilos.suave}>por mês</span>
        </>
      ),
    },
  ];
  return (
    <CartaoDaAnalise
      className={travada.estica}
      tipo="pararam"
      subtitulo="Sem comprar há mais que o dobro do ciclo típico (no mínimo 60 dias; 180 para quem compra sem ritmo) e sem pedido em aberto. Com 24 meses sem comprar, o cliente vira perdido e sai da lista."
    >
      <p className={estilos.resumo}>
        {formatarContagem(itens.length, "cliente", "clientes")} · <Valor valor={somar(itens.map((item) => item.perdaMensal))} compacto comoPerda /> por mês deixaram de entrar
      </p>
      <TabelaDeClientes
        descricao="Clientes que pararam de comprar"
        itens={itens}
        colunas={colunas}
        vazio="Nenhum cliente parou de comprar."
        ordemInicial={{ coluna: "Deixou de entrar", sentido: "decrescente" }}
      />
    </CartaoDaAnalise>
  );
}

type PropsRitmo = {
  direcao: "menos" | "mais";
  itens: ClienteComVariacao[];
  semestre: ListasDeAnalise["semestre"];
};

const RITMOS = {
  menos: { mudanca: "queda", vazio: "Nenhuma queda relevante no semestre.", sentidoInicial: "crescente" },
  mais: { mudanca: "alta", vazio: "Nenhuma alta relevante no semestre.", sentidoInicial: "decrescente" },
} as const;

function Ritmo({ direcao, itens, semestre }: PropsRitmo) {
  const ritmo = RITMOS[direcao];
  const { atual, anterior } = formatarSemestres(semestre);
  // A queda ou a alta precisa continuar nos 3 últimos meses do semestre (dominio/analises.ts).
  const trimestre = formatarPeriodo(somarMeses(semestre.fim, -2), semestre.fim);
  const colunas: ColunaDaTabela<ClienteComVariacao>[] = [
    { titulo: anterior, numerica: true, ordenarPor: (item) => item.semestreAnoAnterior, celula: (item) => <Valor valor={item.semestreAnoAnterior} /> },
    { titulo: atual, numerica: true, ordenarPor: (item) => item.semestre, celula: (item) => <Valor valor={item.semestre} /> },
    { titulo: "Diferença", numerica: true, ordenarPor: diferenca, celula: (item) => <Valor valor={diferenca(item)} comSinal /> },
    { titulo: "Variação", numerica: true, ordenarPor: (item) => item.variacao, celula: (item) => <Variacao razao={item.variacao} /> },
    { titulo: "Em peças", numerica: true, ordenarPor: (item) => item.variacaoPecas, celula: (item) => <Variacao razao={item.variacaoPecas} /> },
  ];
  return (
    <CartaoDaAnalise
      className={travada.estica}
      tipo={direcao}
      subtitulo={`${atual} contra ${anterior}: ${ritmo.mudanca} de 20% ou mais e de pelo menos R$ 2 mil, com 3 compras ou mais nos dois períodos. A ${ritmo.mudanca} precisa continuar em ${trimestre}.`}
    >
      <p className={estilos.resumo}>
        {formatarContagem(itens.length, "cliente", "clientes")} · <Valor valor={somar(itens.map(diferenca))} compacto comSinal /> em {atual}
      </p>
      <TabelaDeClientes
        descricao={`Clientes ${ANALISES[direcao].rotulo.toLowerCase()}`}
        itens={itens}
        colunas={colunas}
        vazio={ritmo.vazio}
        ordemInicial={{ coluna: "Diferença", sentido: ritmo.sentidoInicial }}
      />
      <p className={estilos.nota}>Em peças: a mesma comparação em quantidade, sem o efeito do reajuste de preço.</p>
    </CartaoDaAnalise>
  );
}

function NovosEReativados({ itens, hoje }: { itens: ClienteNovoOuReativado[]; hoje: string }) {
  const reativados = itens.filter((item) => item.tipo === "reativado").length;
  const colunas: ColunaDaTabela<ClienteNovoOuReativado>[] = [
    { titulo: "Tipo", ordenarPor: (item) => item.tipo, celula: (item) => <TipoDeEntrada tipo={item.tipo} /> },
    { titulo: "Desde", ordenarPor: (item) => item.desde, celula: (item) => <DataRelativa data={item.desde} hoje={hoje} /> },
    { titulo: "Faturado desde então", numerica: true, ordenarPor: (item) => item.faturadoDesde, celula: (item) => <Valor valor={item.faturadoDesde} /> },
  ];
  return (
    <CartaoDaAnalise
      className={travada.estica}
      tipo="novos"
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
        ordemInicial={{ coluna: "Faturado desde então", sentido: "decrescente" }}
      />
    </CartaoDaAnalise>
  );
}

function Mix({ itens }: { itens: ClienteComMix[] }) {
  const colunas: ColunaDaTabela<ClienteComMix>[] = [
    {
      titulo: "Famílias a oferecer",
      ordenarPor: (item) => item.oportunidades.length,
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
      ordenarPor: descreverComparacao,
      celula: descreverComparacao,
    },
    { titulo: "Faturado 12 meses", numerica: true, ordenarPor: (item) => item.cliente.faturamento12m, celula: (item) => <Valor valor={item.cliente.faturamento12m} /> },
  ];
  return (
    <CartaoDaAnalise
      className={travada.estica}
      tipo="mix"
      subtitulo="Famílias que pelo menos metade dos clientes parecidos (mesmo mercado e porte, em toda a Suprens) comprou em 12 meses e que o cliente não compra há 24. O percentual é a parte dos parecidos que compra."
    >
      <p className={estilos.resumo}>{formatarContagem(itens.length, "cliente tem", "clientes têm")} famílias a oferecer</p>
      <TabelaDeClientes
        descricao="Clientes com oportunidades de mix"
        itens={itens}
        colunas={colunas}
        vazio="Todos os clientes já compram as famílias mais comuns entre os parecidos."
        ordemInicial={{ coluna: "Faturado 12 meses", sentido: "decrescente" }}
      />
    </CartaoDaAnalise>
  );
}

type PropsDaTabela<T> = { descricao: string; itens: T[]; colunas: ColunaDaTabela<T>[]; vazio: string; ordemInicial: Ordem };

/** Toda lista de análise começa pelo cliente, e a linha leva à ficha dele. */
function TabelaDeClientes<T extends { cliente: ClienteResumo }>({ colunas, ...props }: PropsDaTabela<T>) {
  return (
    <TabelaResponsiva
      {...props}
      className={travada.rola}
      chaveDe={(item) => item.cliente.codigo}
      linkDe={(item) => `/clientes/${item.cliente.codigo}`}
      colunas={[
        { titulo: "Cliente", ordenarPor: (item) => item.cliente.nome, celula: (item) => <Identificacao titulo={<NomeDoCliente cliente={item.cliente} />} detalhe={formatarLocalDoCliente(item.cliente)} /> },
        ...colunas,
      ]}
    />
  );
}

function TipoDeEntrada({ tipo }: { tipo: ClienteNovoOuReativado["tipo"] }) {
  return tipo === "reativado" ? <Selo rotulo="Reativado" icone={RotateCcw} tom="ok" /> : <Selo rotulo="Novo" icone={CirclePlus} tom="novo" />;
}

function descreverComparacao(item: ClienteComMix): string {
  return `${ROTULOS_DE_MERCADO[item.cliente.mercado]}${item.porte ? `, porte ${ROTULOS_DE_PORTE[item.porte]}` : ", mercado todo"}`;
}

function diferenca(item: ClienteComVariacao): number {
  return item.semestre - item.semestreAnoAnterior;
}

function somar(valores: number[]): number {
  return valores.reduce((soma, valor) => soma + valor, 0);
}

function lerLista(valor: string | null): TipoDeAnalise {
  return LISTAS.find((lista) => lista === valor) ?? "pararam";
}
