import { CalendarClock, Hourglass, MapPinOff, Users } from "lucide-react";
import { diasEntre } from "dominio/datas";
import type { MunicipioDoMapa } from "dominio/mapa";
import { Indicador } from "../../componentes/Indicador";
import { DataRelativa } from "../../componentes/Quando";
import { SituacaoCliente } from "../../componentes/SituacaoCliente";
import { Valor } from "../../componentes/Valor";
import { faixaDeRecencia, type MunicipioNoTerritorio } from "../../dados/mapa";
import { formatarContagem, formatarData, formatarNumero } from "../../formato";
import estilos from "../Mapa.module.css";
import { colunaDaVisita, type ContextoDaLente, type LenteDoMapa } from "./lente";

/*
 * "Esquecidas": há quanto tempo a cidade não tem compra nem visita. A cidade sem contato há mais de 90
 * dias pede uma viagem, mesmo que nenhum cliente dela tenha entrado em Análises.
 */

/** Acima disto, em dias sem compra nem visita, a cidade está esquecida: as faixas 3 e 4 de faixaDeRecencia. */
const DIAS_DA_CIDADE_ESQUECIDA = 90;
/** A barra da lista enche com um ano sem compra. */
const DIAS_DA_BARRA_CHEIA = 365;
const FAIXAS = ["até 30 dias", "31 a 90 dias", "91 a 180 dias", "mais de 180 dias"] as const;

export const ESQUECIDAS: LenteDoMapa = {
  rotulo: "Esquecidas",
  icone: CalendarClock,
  subtitulo: "Há quanto tempo cada cidade não tem compra nem visita sua",
  lista: {
    titulo: "Sem compra há mais tempo",
    subtitulo: "As cidades com cliente, da mais esquecida à mais recente",
    barra: estilos.barraDeRecencia,
    vazio: () => "Nenhuma cidade com cliente neste estado.",
  },
  Indicadores,
  circulos: () => [],
  classes: ({ territorio, hoje }) =>
    new Map([...territorio.municipios.values()].map((presenca) => [presenca.municipio.codigo, `recencia-${faixaDeRecencia(diasSemContato(presenca, hoje))}`])),
  Legenda,
  Dica,
  itens: ({ territorio, hoje }) =>
    [...territorio.municipios.values()]
      .map((presenca) => ({ presenca, dias: diasSemContato(presenca, hoje) }))
      .sort((a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity))
      .map(({ presenca, dias }) => ({
        tipo: "municipio",
        codigo: presenca.municipio.codigo,
        nome: presenca.municipio.nome,
        valor: dias === null ? "nunca" : `há ${formatarNumero(dias)} dias`,
        parte: dias === null ? 1 : Math.min(1, dias / DIAS_DA_BARRA_CHEIA),
        detalhe: [
          formatarContagem(presenca.clientes.length, "cliente", "clientes"),
          presenca.ultimaCompra ? `compra em ${formatarData(presenca.ultimaCompra)}` : "nenhum comprou",
          presenca.ultimaVisita ? `visita em ${formatarData(presenca.ultimaVisita)}` : null,
        ]
          .filter((parte) => parte !== null)
          .join(" · "),
      })),
  colunas: (contexto) => [
    { titulo: "Situação", ordenarPor: (cliente) => cliente.situacao, celula: (cliente) => <SituacaoCliente situacao={cliente.situacao} /> },
    { titulo: "Última compra", ordenarPor: (cliente) => cliente.ultimaCompra, celula: (cliente) => <DataRelativa data={cliente.ultimaCompra} hoje={contexto.hoje} /> },
    colunaDaVisita(contexto),
    { titulo: "Faturado 12 meses", numerica: true, largura: 8, ordenarPor: (cliente) => cliente.faturamento12m, celula: (cliente) => <Valor valor={cliente.faturamento12m} /> },
  ],
  ordemInicial: { coluna: "Última compra", sentido: "crescente" },
};

/**
 * Dias desde o último contato com o município: a compra mais recente de algum cliente ou a visita
 * mais recente do login; null sem nenhum dos dois. A visita de hoje, com a foto de ontem, conta zero.
 */
function diasSemContato(presenca: MunicipioNoTerritorio, hoje: string): number | null {
  const [contato] = [presenca.ultimaCompra, presenca.ultimaVisita].filter((data) => data !== null).sort().reverse();
  return contato ? Math.max(0, diasEntre(contato, hoje)) : null;
}

function Indicadores({ territorio, hoje }: ContextoDaLente) {
  const cidades = [...territorio.municipios.values()].map((presenca) => ({ presenca, dias: diasSemContato(presenca, hoje) }));
  const esquecidas = cidades.filter(({ dias }) => dias === null || dias > DIAS_DA_CIDADE_ESQUECIDA);
  const [maisAntiga] = [...esquecidas].sort((a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity));
  return (
    <div className={estilos.indicadores}>
      <Indicador
        destaque
        rotulo="Cidades esquecidas"
        icone={MapPinOff}
        valor={formatarContagem(esquecidas.length, "cidade", "cidades")}
        detalhe={`sem compra nem visita há mais de ${DIAS_DA_CIDADE_ESQUECIDA} dias, de ${cidades.length} com cliente`}
      />
      <Indicador
        rotulo="Clientes nelas"
        icone={Users}
        valor={formatarContagem(esquecidas.reduce((soma, { presenca }) => soma + presenca.clientes.length, 0), "cliente", "clientes")}
        detalhe="para visitar ou ligar"
      />
      <Indicador
        rotulo="Há mais tempo sem contato"
        icone={Hourglass}
        valor={maisAntiga ? (maisAntiga.dias === null ? "Nunca comprou" : `${formatarNumero(maisAntiga.dias)} dias`) : "—"}
        detalhe={maisAntiga ? maisAntiga.presenca.municipio.nome : "nenhuma cidade esquecida"}
      />
    </div>
  );
}

function Legenda() {
  return (
    <div className={estilos.legenda}>
      <span className={estilos.itemDaLegenda}>Última compra ou visita na cidade:</span>
      {FAIXAS.map((rotulo, i) => (
        <span key={rotulo} className={estilos.itemDaLegenda}>
          <span className={estilos.amostra} data-classe={`recencia-${i + 1}`} aria-hidden="true" />
          {rotulo}
        </span>
      ))}
    </div>
  );
}

function Dica({ territorio, hoje, municipio }: ContextoDaLente & { municipio: MunicipioDoMapa }) {
  const presenca = territorio.municipios.get(municipio.codigo);
  if (!presenca) return null;
  const dias = diasSemContato(presenca, hoje);
  return <p className={estilos.linhaDaDica}>{dias === null ? "Nenhuma compra nem visita ainda" : `Sem compra nem visita há ${formatarNumero(dias)} dias`}</p>;
}
