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
import type { ContextoDaLente, LenteDoMapa } from "./lente";

/*
 * "Esquecidas": há quanto tempo alguém da carteira compra em cada cidade. A cidade onde ninguém compra
 * há mais de 90 dias pede uma visita, mesmo que nenhum cliente dela tenha entrado em Análises.
 */

/** Acima disto, em dias sem compra, a cidade está esquecida: as faixas 3 e 4 de faixaDeRecencia. */
const DIAS_DA_CIDADE_ESQUECIDA = 90;
/** A barra da lista enche com um ano sem compra. */
const DIAS_DA_BARRA_CHEIA = 365;
const FAIXAS = ["até 30 dias", "31 a 90 dias", "91 a 180 dias", "mais de 180 dias"] as const;

export const ESQUECIDAS: LenteDoMapa = {
  rotulo: "Esquecidas",
  subtitulo: "Há quanto tempo alguém da carteira compra em cada cidade",
  lista: {
    titulo: "Sem compra há mais tempo",
    icone: CalendarClock,
    subtitulo: "As cidades com cliente, da mais esquecida à mais recente",
    barra: estilos.barraDeRecencia,
    vazio: () => "Nenhuma cidade com cliente neste estado.",
  },
  Indicadores,
  circulos: () => [],
  classes: ({ territorio, hoje }) =>
    new Map([...territorio.municipios.values()].map((presenca) => [presenca.municipio.codigo, `recencia-${faixaDeRecencia(diasSemCompra(presenca, hoje))}`])),
  Legenda,
  Dica,
  itens: ({ territorio, hoje }) =>
    [...territorio.municipios.values()]
      .map((presenca) => ({ presenca, dias: diasSemCompra(presenca, hoje) }))
      .sort((a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity))
      .map(({ presenca, dias }) => ({
        tipo: "municipio",
        codigo: presenca.municipio.codigo,
        nome: presenca.municipio.nome,
        valor: dias === null ? "nunca comprou" : `há ${formatarNumero(dias)} dias`,
        parte: dias === null ? 1 : Math.min(1, dias / DIAS_DA_BARRA_CHEIA),
        detalhe: `${formatarContagem(presenca.clientes.length, "cliente", "clientes")} · ${
          presenca.ultimaCompra ? `última compra em ${formatarData(presenca.ultimaCompra)}` : "nenhum comprou"
        }`,
      })),
  colunas: ({ hoje }) => [
    { titulo: "Situação", ordenarPor: (cliente) => cliente.situacao, celula: (cliente) => <SituacaoCliente situacao={cliente.situacao} /> },
    { titulo: "Última compra", ordenarPor: (cliente) => cliente.ultimaCompra, celula: (cliente) => <DataRelativa data={cliente.ultimaCompra} hoje={hoje} /> },
    { titulo: "Faturado 12 meses", numerica: true, largura: 8, ordenarPor: (cliente) => cliente.faturamento12m, celula: (cliente) => <Valor valor={cliente.faturamento12m} /> },
  ],
  ordemInicial: { coluna: "Última compra", sentido: "crescente" },
};

/** Dias desde a compra mais recente de algum cliente do município; null se nenhum comprou. */
function diasSemCompra(presenca: MunicipioNoTerritorio, hoje: string): number | null {
  return presenca.ultimaCompra ? diasEntre(presenca.ultimaCompra, hoje) : null;
}

function Indicadores({ territorio, hoje }: ContextoDaLente) {
  const cidades = [...territorio.municipios.values()].map((presenca) => ({ presenca, dias: diasSemCompra(presenca, hoje) }));
  const esquecidas = cidades.filter(({ dias }) => dias === null || dias > DIAS_DA_CIDADE_ESQUECIDA);
  const [maisAntiga] = [...esquecidas].sort((a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity));
  return (
    <div className={estilos.indicadores}>
      <Indicador
        destaque
        rotulo="Cidades esquecidas"
        icone={MapPinOff}
        valor={formatarContagem(esquecidas.length, "cidade", "cidades")}
        detalhe={`sem compra há mais de ${DIAS_DA_CIDADE_ESQUECIDA} dias, de ${cidades.length} com cliente`}
      />
      <Indicador
        rotulo="Clientes nelas"
        icone={Users}
        valor={formatarContagem(esquecidas.reduce((soma, { presenca }) => soma + presenca.clientes.length, 0), "cliente", "clientes")}
        detalhe="para visitar ou ligar"
      />
      <Indicador
        rotulo="Há mais tempo sem compra"
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
      <span className={estilos.itemDaLegenda}>Última compra na cidade:</span>
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
  const dias = diasSemCompra(presenca, hoje);
  return <p className={estilos.linhaDaDica}>{dias === null ? "Nenhum cliente comprou ainda" : `Última compra há ${formatarNumero(dias)} dias`}</p>;
}
