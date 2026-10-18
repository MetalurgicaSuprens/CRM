import { CirclePause, HandCoins, Target, TrendingDown } from "lucide-react";
import type { MunicipioDoMapa } from "dominio/mapa";
import { Indicador } from "../../componentes/Indicador";
import { DataRelativa } from "../../componentes/Quando";
import { Valor } from "../../componentes/Valor";
import { emJogoPorMes, gravidadeDoCliente, gravidadeDoResumo, type AcoesDoCliente, type Gravidade, type ResumoDasAcoes } from "../../dados/mapa";
import { formatarContagem, formatarMesAno, formatarVariacao } from "../../formato";
import estilos from "../Mapa.module.css";
import { classesDosMunicipiosComCliente, type ContextoDaLente, type LenteDoMapa } from "./lente";

/*
 * "Onde agir", a visão que abre: em cada cidade, os clientes que pedem ação e o dinheiro em jogo por
 * mês. É o que decide a viagem; a lista dá as regiões nessa ordem, e a escolha, os clientes com o motivo.
 */

export const ONDE_AGIR: LenteDoMapa = {
  rotulo: "Onde agir",
  subtitulo: "Cada círculo é o dinheiro em jogo por mês nos clientes da cidade que pedem ação",
  lista: {
    titulo: "Onde agir primeiro",
    icone: Target,
    subtitulo: "Regiões imediatas do IBGE, pelo dinheiro em jogo por mês",
    barra: estilos.barraDePerda,
    vazio: () => "Nenhum cliente pede ação neste estado agora.",
  },
  Indicadores,
  circulos: (territorio) =>
    [...territorio.municipios.values()].flatMap(({ municipio, acoes }) => {
      const tom = gravidadeDoResumo(acoes);
      return tom ? [{ municipio, valor: acoes.emJogoPorMes, tom }] : [];
    }),
  classes: classesDosMunicipiosComCliente,
  Legenda,
  Dica,
  itens: ({ territorio }) => {
    const regioes = territorio.regioes
      .filter((regiao) => gravidadeDoResumo(regiao.acoes))
      .sort((a, b) => b.acoes.emJogoPorMes - a.acoes.emJogoPorMes || totalDeAcoes(b.acoes) - totalDeAcoes(a.acoes));
    const maior = Math.max(1, ...regioes.map((regiao) => regiao.acoes.emJogoPorMes));
    return regioes.map(({ regiao, acoes }) => ({
      tipo: "regiao",
      codigo: regiao.codigo,
      nome: regiao.nome,
      valor: acoes.emJogoPorMes > 0 ? <Valor valor={acoes.emJogoPorMes} compacto comoPerda /> : "—",
      parte: acoes.emJogoPorMes / maior,
      detalhe: descreverAcoes(acoes),
    }));
  },
  colunas: ({ territorio, hoje }) => {
    const acoesDe = (codigo: string) => territorio.acoesPorCliente.get(codigo);
    return [
      {
        titulo: "Motivo",
        largura: 14,
        ordenarPor: (cliente) => ORDEM_DA_GRAVIDADE.indexOf(gravidadeDoCliente(acoesDe(cliente.codigo)) ?? "oportunidade"),
        celula: (cliente) => <Motivo acoes={acoesDe(cliente.codigo)} />,
      },
      {
        titulo: "Em jogo por mês",
        numerica: true,
        largura: 8,
        ordenarPor: (cliente) => emJogoPorMes(acoesDe(cliente.codigo)),
        celula: (cliente) => {
          const valor = emJogoPorMes(acoesDe(cliente.codigo));
          return valor > 0 ? <Valor valor={valor} comoPerda /> : "—";
        },
      },
      { titulo: "Última compra", ordenarPor: (cliente) => cliente.ultimaCompra, celula: (cliente) => <DataRelativa data={cliente.ultimaCompra} hoje={hoje} /> },
    ];
  },
  ordemInicial: { coluna: "Em jogo por mês", sentido: "decrescente" },
};

/** Para a coluna Motivo ordenar do mais grave ao menos grave. */
const ORDEM_DA_GRAVIDADE: readonly Gravidade[] = ["oportunidade", "atencao", "critico"];

function Indicadores({ territorio }: ContextoDaLente) {
  const { acoes } = territorio;
  const cidadesComParados = [...territorio.municipios.values()].filter((presenca) => presenca.acoes.parados > 0).length;
  return (
    <div className={estilos.indicadores}>
      <Indicador
        destaque
        rotulo="Em jogo por mês"
        icone={HandCoins}
        valor={<Valor valor={acoes.emJogoPorMes} compacto comoPerda />}
        detalhe={formatarContagem(acoes.parados + acoes.emRisco + acoes.atrasados, "cliente parado, em risco ou atrasado", "clientes parados, em risco ou atrasados")}
      />
      <Indicador
        rotulo="Parados"
        icone={CirclePause}
        valor={formatarContagem(acoes.parados, "cliente", "clientes")}
        detalhe={acoes.parados > 0 ? `em ${formatarContagem(cidadesComParados, "cidade", "cidades")}` : "nenhum neste estado"}
      />
      <Indicador
        rotulo="Em risco ou atrasados"
        icone={TrendingDown}
        valor={formatarContagem(acoes.emRisco + acoes.atrasados, "cliente", "clientes")}
        detalhe={`${acoes.emRisco} comprando menos · ${acoes.atrasados} ${acoes.atrasados === 1 ? "passou" : "passaram"} do ciclo`}
      />
    </div>
  );
}

function Legenda({ territorio }: ContextoDaLente) {
  const maior = Math.max(0, ...[...territorio.municipios.values()].map((presenca) => presenca.acoes.emJogoPorMes));
  return (
    <div className={estilos.legenda}>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.bolinha} data-tom="critico" aria-hidden="true" />
        parado
      </span>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.bolinha} data-tom="atencao" aria-hidden="true" />
        comprando menos ou passou do ciclo
      </span>
      <span className={estilos.itemDaLegenda}>
        <span className={`${estilos.bolinha} ${estilos.bolinhaPequena}`} data-tom="oportunidade" aria-hidden="true" />
        mix para oferecer ou cliente novo
      </span>
      {maior > 0 ? (
        <span className={estilos.itemDaLegenda}>
          o maior círculo, <Valor valor={maior} compacto comoPerda /> por mês
        </span>
      ) : null}
    </div>
  );
}

function Dica({ territorio, municipio }: ContextoDaLente & { municipio: MunicipioDoMapa }) {
  const presenca = territorio.municipios.get(municipio.codigo);
  if (!presenca) return null;
  const { acoes } = presenca;
  if (!gravidadeDoResumo(acoes)) return <p className={estilos.linhaDaDica}>Nenhum cliente pede ação aqui</p>;
  return (
    <>
      {acoes.emJogoPorMes > 0 ? (
        <p className={estilos.linhaDaDica}>
          <Valor valor={acoes.emJogoPorMes} compacto comoPerda /> por mês em jogo
        </p>
      ) : null}
      <p className={estilos.linhaDaDica}>{descreverAcoes(acoes)}</p>
    </>
  );
}

/** O motivo da ação, com a cor da gravidade ao lado; "Em dia" quando nada pede ação. */
export function Motivo({ acoes }: { acoes: AcoesDoCliente | undefined }) {
  const gravidade = gravidadeDoCliente(acoes);
  if (!acoes || !gravidade) return <span className={estilos.emDia}>Em dia</span>;
  return (
    <span className={estilos.motivo}>
      <span className={estilos.pontoDoMotivo} data-tom={gravidade} aria-hidden="true" />
      {descreverMotivo(acoes)}
    </span>
  );
}

/** "Parou há 120 dias · Mix: FLEXIL, MICRO": cada ação do cliente numa frase curta. */
export function descreverMotivo(acoes: AcoesDoCliente): string {
  const partes = [
    acoes.parado ? `Parou há ${acoes.parado.diasSemComprar} dias` : null,
    acoes.emRisco ? `Comprando menos: ${formatarVariacao(acoes.emRisco.variacao)} no semestre` : null,
    acoes.atrasado ? `${acoes.atrasado.diasSemComprar} dias sem comprar; costuma a cada ${acoes.atrasado.cicloDias}` : null,
    acoes.mix ? `Mix: ${acoes.mix.familias.slice(0, 2).join(", ")}${acoes.mix.familias.length > 2 ? "…" : ""}` : null,
    acoes.novo ? `${acoes.novo.tipo === "novo" ? "Novo desde" : "Voltou em"} ${formatarMesAno(acoes.novo.desde.slice(0, 7))}` : null,
  ];
  return partes.filter((parte) => parte !== null).join(" · ");
}

/** "2 parados · 1 comprando menos · 3 com mix": só o que existe, na ordem da gravidade. */
export function descreverAcoes(acoes: ResumoDasAcoes): string {
  const partes = [
    acoes.parados > 0 ? formatarContagem(acoes.parados, "parado", "parados") : null,
    acoes.emRisco > 0 ? `${acoes.emRisco} comprando menos` : null,
    acoes.atrasados > 0 ? `${acoes.atrasados} fora do ciclo` : null,
    acoes.comMix > 0 ? `${acoes.comMix} com mix` : null,
    acoes.novos > 0 ? formatarContagem(acoes.novos, "novo", "novos") : null,
  ];
  return partes.filter((parte) => parte !== null).join(" · ") || "Nenhum cliente pede ação";
}

function totalDeAcoes(acoes: ResumoDasAcoes): number {
  return acoes.parados + acoes.emRisco + acoes.atrasados + acoes.comMix + acoes.novos;
}
