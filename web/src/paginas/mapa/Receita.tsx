import { ChartPie, MapPinned, ReceiptText } from "lucide-react";
import type { MunicipioDoMapa } from "dominio/mapa";
import { Indicador } from "../../componentes/Indicador";
import { SituacaoCliente } from "../../componentes/SituacaoCliente";
import { Valor } from "../../componentes/Valor";
import { Variacao } from "../../componentes/Variacao";
import { direcaoDaReceita } from "../../dados/mapa";
import { formatarContagem, formatarParticipacao } from "../../formato";
import estilos from "../Mapa.module.css";
import { classesDosMunicipiosComCliente, type ContextoDaLente, type LenteDoMapa } from "./lente";

/*
 * "Receita": de onde vem o faturado e para onde ele vai. O círculo é o faturado do município em 12
 * meses, e a cor diz se ele cresce ou cai contra os 12 anteriores: um círculo grande e vermelho é um
 * mercado grande encolhendo.
 */

const SEM_FATURADO = "sem faturado em 12 meses";

export const RECEITA: LenteDoMapa = {
  rotulo: "Receita",
  subtitulo: "Cada círculo é o faturado do município em 12 meses; a cor, se ele cresce ou cai",
  lista: {
    titulo: "Regiões que mais faturam",
    icone: ReceiptText,
    subtitulo: "Regiões imediatas do IBGE: a cidade-polo e o entorno",
    barra: estilos.barraDeReceita,
    vazio: () => "Nenhum faturado nos últimos 12 meses.",
  },
  Indicadores,
  circulos: (territorio) =>
    [...territorio.municipios.values()]
      .filter(({ receita }) => receita > 0)
      .map(({ municipio, receita, receitaAnoAntes }) => ({ municipio, valor: receita, tom: direcaoDaReceita(receita, receitaAnoAntes) })),
  classes: classesDosMunicipiosComCliente,
  Legenda,
  Dica,
  itens: ({ territorio }) => {
    const regioes = territorio.regioes.filter(({ receita }) => receita > 0).sort((a, b) => b.receita - a.receita);
    const maior = Math.max(1, ...regioes.map(({ receita }) => receita));
    return regioes.map((regiao) => ({
      tipo: "regiao",
      codigo: regiao.regiao.codigo,
      nome: regiao.regiao.nome,
      valor: <Valor valor={regiao.receita} compacto />,
      parte: regiao.receita / maior,
      detalhe: (
        <>
          {formatarParticipacao(regiao.participacao)} da receita · {formatarContagem(regiao.clientes, "cliente", "clientes")} ·{" "}
          <Variacao razao={variacaoDe(regiao.receita, regiao.receitaAnoAntes)} />
        </>
      ),
    }));
  },
  colunas: () => [
    { titulo: "Situação", ordenarPor: (cliente) => cliente.situacao, celula: (cliente) => <SituacaoCliente situacao={cliente.situacao} /> },
    { titulo: "Faturado 12 meses", numerica: true, largura: 8, ordenarPor: (cliente) => cliente.faturamento12m, celula: (cliente) => <Valor valor={cliente.faturamento12m} /> },
    { titulo: "Variação", numerica: true, largura: 6, ordenarPor: (cliente) => cliente.variacao12m, celula: (cliente) => <Variacao razao={cliente.variacao12m} /> },
  ],
  ordemInicial: { coluna: "Faturado 12 meses", sentido: "decrescente" },
};

function Indicadores({ territorio }: ContextoDaLente) {
  const principal = [...territorio.regioes].sort((a, b) => b.receita - a.receita)[0];
  return (
    <div className={estilos.indicadores}>
      <Indicador
        destaque
        rotulo="Faturado em 12 meses"
        icone={ReceiptText}
        valor={<Valor valor={territorio.receita} compacto />}
        detalhe={<Variacao razao={variacaoDe(territorio.receita, territorio.receitaAnoAntes)} referencia="vs os 12 meses anteriores" />}
      />
      <Indicador
        rotulo="Concentração"
        icone={ChartPie}
        valor={territorio.receita > 0 ? formatarContagem(territorio.municipiosPara80, "município", "municípios") : "—"}
        detalhe={territorio.receita > 0 ? "fazem 80% da receita no estado" : SEM_FATURADO}
      />
      <Indicador
        rotulo="Região que mais fatura"
        icone={MapPinned}
        valor={principal && principal.receita > 0 ? principal.regiao.nome : "—"}
        detalhe={principal && principal.receita > 0 ? `${formatarParticipacao(principal.participacao)} da receita no estado` : SEM_FATURADO}
      />
    </div>
  );
}

function Legenda({ territorio }: ContextoDaLente) {
  const maior = Math.max(0, ...[...territorio.municipios.values()].map(({ receita }) => receita));
  return (
    <div className={estilos.legenda}>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.bolinha} data-tom="alta" aria-hidden="true" />
        cresce 10% ou mais
      </span>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.bolinha} data-tom="estavel" aria-hidden="true" />
        estável
      </span>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.bolinha} data-tom="queda" aria-hidden="true" />
        cai 10% ou mais
      </span>
      {maior > 0 ? (
        <span className={estilos.itemDaLegenda}>
          o maior círculo, <Valor valor={maior} compacto />
        </span>
      ) : null}
    </div>
  );
}

function Dica({ territorio, municipio }: ContextoDaLente & { municipio: MunicipioDoMapa }) {
  const presenca = territorio.municipios.get(municipio.codigo);
  if (!presenca || presenca.receita <= 0) return null;
  return (
    <p className={estilos.linhaDaDica}>
      <Variacao razao={variacaoDe(presenca.receita, presenca.receitaAnoAntes)} referencia="vs os 12 meses anteriores" />
    </p>
  );
}

/** A variação contra a base; null sem base, porque não há como medir quanto cresceu do zero. */
function variacaoDe(receita: number, receitaAnoAntes: number): number | null {
  return receitaAnoAntes > 0 ? receita / receitaAnoAntes - 1 : null;
}
