import { MapPinPlus, Sprout, Target } from "lucide-react";
import type { MunicipioDoMapa } from "dominio/mapa";
import { Indicador } from "../../componentes/Indicador";
import { DataRelativa } from "../../componentes/Quando";
import { SituacaoCliente } from "../../componentes/SituacaoCliente";
import { Valor } from "../../componentes/Valor";
import { classeDaLacuna, type RegiaoNoTerritorio, type Territorio } from "../../dados/mapa";
import { formatarCompacto, formatarContagem, formatarReaisCompacto } from "../../formato";
import estilos from "../Mapa.module.css";
import type { ContextoDaLente, LenteDoMapa } from "./lente";

/*
 * "Onde crescer": as regiões da área pelo potencial que falta, que pedem prospecção, e as cidades sem
 * cliente nelas. O potencial mede pelo PIB da agropecuária e da indústria, que acompanha o mercado da
 * Suprens melhor que a população (dados/mapa.ts). Recuperar cliente parado está em "Onde agir". O PIB
 * é dado público do IBGE e aparece mesmo com os valores ocultos.
 */

/** Quantas cidades sem cliente a região escolhida lista, das de maior PIB agro + indústria. */
const CIDADES_SEM_CLIENTE = 8;

export const ONDE_CRESCER: LenteDoMapa = {
  rotulo: "Onde crescer",
  icone: Sprout,
  subtitulo: "Em verde, o potencial que falta onde você tem cliente e nas regiões vizinhas",
  lista: {
    titulo: "Onde crescer",
    subtitulo: "Onde você tem cliente e as regiões vizinhas, pelo que faturariam na sua média pelo PIB agro + indústria",
    barra: estilos.barraDePotencial,
    vazio: ({ territorio }) =>
      territorio.receita > 0 ? "Todas as regiões estão na sua média ou acima." : "Sem faturado em 12 meses neste estado para medir o potencial.",
  },
  Indicadores,
  circulos: () => [],
  classes: ({ territorio }) => {
    const daArea = territorio.regioes.filter(({ isDaArea }) => isDaArea);
    const lacunas = daArea.map(({ lacuna }) => lacuna);
    return new Map(
      daArea.flatMap((regiao) =>
        municipiosDaRegiao(regiao).map((municipio) => [municipio.codigo, `potencial-${classeDaLacuna(regiao.lacuna, lacunas)}`] as const),
      ),
    );
  },
  Legenda,
  Dica,
  itens: ({ territorio }) => {
    const regioes = territorio.regioes.filter(({ lacuna }) => lacuna > 0).sort((a, b) => b.lacuna - a.lacuna);
    const maior = Math.max(1, ...regioes.map(({ lacuna }) => lacuna));
    return regioes.map((regiao) => ({
      tipo: "regiao",
      codigo: regiao.regiao.codigo,
      nome: regiao.regiao.nome,
      valor: <Valor valor={regiao.lacuna} compacto comSinal />,
      parte: regiao.lacuna / maior,
      detalhe: `PIB agro + indústria de ${formatarReaisCompacto(regiao.mercado)} · ${
        regiao.clientes > 0 ? formatarContagem(regiao.clientes, "cliente", "clientes") : "nenhum cliente ainda"
      }`,
    }));
  },
  colunas: ({ hoje }) => [
    { titulo: "Situação", ordenarPor: (cliente) => cliente.situacao, celula: (cliente) => <SituacaoCliente situacao={cliente.situacao} /> },
    { titulo: "Faturado 12 meses", numerica: true, largura: 8, ordenarPor: (cliente) => cliente.faturamento12m, celula: (cliente) => <Valor valor={cliente.faturamento12m} /> },
    { titulo: "Última compra", ordenarPor: (cliente) => cliente.ultimaCompra, celula: (cliente) => <DataRelativa data={cliente.ultimaCompra} hoje={hoje} /> },
  ],
  ordemInicial: { coluna: "Faturado 12 meses", sentido: "decrescente" },
  SobreARegiao,
};

function municipiosDaRegiao(regiao: RegiaoNoTerritorio): MunicipioDoMapa[] {
  return [...regiao.municipios.map(({ municipio }) => municipio), ...regiao.semCliente];
}

function cidadesSemClienteNaArea(territorio: Territorio): MunicipioDoMapa[] {
  return territorio.regioes
    .filter(({ isDaArea }) => isDaArea)
    .flatMap(({ semCliente }) => semCliente)
    .sort((a, b) => (b.mercado ?? 0) - (a.mercado ?? 0));
}

function Indicadores({ territorio }: ContextoDaLente) {
  const comLacuna = territorio.regioes.filter(({ lacuna }) => lacuna > 0);
  const [maior] = [...comLacuna].sort((a, b) => b.lacuna - a.lacuna);
  const semCliente = cidadesSemClienteNaArea(territorio);
  return (
    <div className={estilos.indicadores}>
      <Indicador
        destaque
        rotulo="Potencial por ano"
        icone={Sprout}
        valor={<Valor valor={comLacuna.reduce((soma, { lacuna }) => soma + lacuna, 0)} compacto />}
        detalhe={`${formatarContagem(comLacuna.length, "região abaixo", "regiões abaixo")} da sua média pelo PIB agro + indústria`}
      />
      <Indicador
        rotulo="Maior oportunidade"
        icone={Target}
        valor={maior ? maior.regiao.nome : "—"}
        detalhe={
          maior ? (
            <>
              potencial de <Valor valor={maior.lacuna} compacto comSinal /> por ano
            </>
          ) : territorio.receita > 0 ? (
            "todas as regiões na média"
          ) : (
            "sem faturado em 12 meses para medir"
          )
        }
      />
      <Indicador
        rotulo="Cidades sem cliente"
        icone={MapPinPlus}
        valor={formatarContagem(semCliente.length, "cidade", "cidades")}
        detalhe={semCliente.length > 0 ? `na sua área; as de maior PIB, ${semCliente.slice(0, 2).map(({ nome }) => nome).join(" e ")}` : "na sua área"}
      />
    </div>
  );
}

function Legenda() {
  return (
    <div className={estilos.legenda}>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.amostraNeutra} aria-hidden="true" />
        longe dos seus clientes
      </span>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.amostraComCliente} aria-hidden="true" />
        na sua média ou acima
      </span>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.rampa} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        potencial por ano, do menor ao maior
      </span>
    </div>
  );
}

function Dica({ territorio, municipio }: ContextoDaLente & { municipio: MunicipioDoMapa }) {
  const regiao = territorio.regioes.find(({ regiao: daRegiao }) => daRegiao.codigo === municipio.regiao);
  return (
    <>
      {!territorio.municipios.has(municipio.codigo) ? (
        <p className={estilos.linhaDaDica}>
          {[
            municipio.mercado ? `PIB agro + indústria de ${formatarReaisCompacto(municipio.mercado)}` : null,
            municipio.populacao ? `${formatarCompacto(municipio.populacao)} habitantes` : null,
          ]
            .filter((parte) => parte !== null)
            .join(" · ")}
        </p>
      ) : null}
      {regiao && regiao.lacuna > 0 ? (
        <p className={estilos.linhaDaDica}>
          Potencial de <Valor valor={regiao.lacuna} compacto comSinal /> por ano na região
        </p>
      ) : null}
    </>
  );
}

function SobreARegiao({ regiao }: ContextoDaLente & { regiao: RegiaoNoTerritorio }) {
  const semCliente = regiao.semCliente.slice(0, CIDADES_SEM_CLIENTE);
  return (
    <>
      <dl className={estilos.numeros}>
        <div>
          <dt>PIB agro + indústria</dt>
          <dd>{formatarReaisCompacto(regiao.mercado)}</dd>
        </div>
        <div>
          <dt>Faturado em 12 meses</dt>
          <dd>
            <Valor valor={regiao.receita} compacto />
          </dd>
        </div>
        <div>
          <dt>Na sua média pelo PIB</dt>
          <dd>
            <Valor valor={regiao.potencial} compacto />
          </dd>
        </div>
        <div>
          <dt>Potencial que falta</dt>
          <dd>{regiao.lacuna > 0 ? <Valor valor={regiao.lacuna} compacto comSinal /> : "—"}</dd>
        </div>
      </dl>
      {semCliente.length > 0 ? (
        <div className={estilos.semCliente}>
          <p className={estilos.tituloSemCliente}>
            Cidades sem cliente
            {regiao.semCliente.length > CIDADES_SEM_CLIENTE ? `, as ${CIDADES_SEM_CLIENTE} de maior PIB agro + indústria de ${regiao.semCliente.length}` : ""}
          </p>
          <ul>
            {semCliente.map((municipio) => (
              <li key={municipio.codigo}>
                {municipio.nome}
                {municipio.mercado ? <span> · {formatarReaisCompacto(municipio.mercado)}</span> : null}
                {municipio.populacao ? <span> · {formatarCompacto(municipio.populacao)} hab.</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
