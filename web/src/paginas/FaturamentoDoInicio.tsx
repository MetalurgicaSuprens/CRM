import { useState } from "react";
import { ChartNoAxesColumn, TrendingUp } from "lucide-react";
import { Cartao } from "../componentes/Cartao";
import { Segmentos, type Segmento } from "../componentes/Segmentos";
import { Variacao } from "../componentes/Variacao";
import { montarTendencia, resumirATendencia } from "../dados/faturamentoDoCliente";
import type { PainelInicio } from "../dados/tipos";
import { formatarMesAno } from "../formato";
import { BarrasMensais } from "../graficos/BarrasMensais";
import { LinhaDeTendencia } from "../graficos/LinhaDeTendencia";
import moldura from "../graficos/moldura.module.css";

/*
 * O faturamento do Início, na visão do representante, em duas vistas (pedido do Lucas em 2026-10-19):
 * o mensal do ano contra o anterior, o padrão, e a tendência dos últimos 4 anos, no mesmo modelo da
 * ficha do cliente: cada ponto é a média por mês dos 12 meses até ele.
 */

type Vista = "mensal" | "tendencia";

const VISTAS: readonly Segmento<Vista>[] = [
  { valor: "mensal", rotulo: "Mensal" },
  { valor: "tendencia", rotulo: "Tendência" },
];

export function FaturamentoDoInicio({ painel }: { painel: PainelInicio }) {
  const [vista, setVista] = useState<Vista>("mensal");
  const ano = Number(painel.mesAtual.mes.slice(0, 4));
  const isTendencia = vista === "tendencia";
  return (
    <Cartao
      titulo={isTendencia ? "Tendência" : "Faturamento mensal"}
      icone={isTendencia ? TrendingUp : ChartNoAxesColumn}
      subtitulo={isTendencia ? "Média por mês nos 12 meses até cada mês, nos últimos 4 anos" : `${ano}, comparado a ${ano - 1}`}
    >
      <Segmentos rotulo="Como ver o faturamento" opcoes={VISTAS} selecionado={vista} aoEscolher={setVista} className={moldura.vistas} />
      {isTendencia ? (
        <Tendencia painel={painel} />
      ) : (
        <BarrasMensais
          descricao={`Faturamento mensal de ${ano} comparado a ${ano - 1}`}
          rotulos={{ valor: String(ano), comparacao: String(ano - 1), aFaturar: "A faturar no mês" }}
          barras={painel.mensal.map((mes) => ({ mes: mes.mes, valor: mes.faturado, comparacao: mes.anoAnterior, aFaturar: mes.aFaturar }))}
        />
      )}
    </Cartao>
  );
}

function Tendencia({ painel }: { painel: PainelInicio }) {
  const pontos = montarTendencia(painel.historico, painel.mesAtual.mes);
  const andamento = resumirATendencia(pontos);
  return (
    <>
      {andamento ? (
        <p className={moldura.resumoDoGrafico}>
          <span>Desde {formatarMesAno(andamento.desde)}:</span>
          <Variacao razao={andamento.variacao} referencia="na média por mês" />
        </p>
      ) : null}
      <LinhaDeTendencia descricao="Sua média por mês nos 12 meses até cada mês, nos últimos 4 anos" rotulo="Média por mês" pontos={pontos} altura={240} />
      <p className={moldura.notaDoGrafico}>
        A média de 12 meses tira o vaivém dos pedidos e a época do ano. São as vendas atribuídas aos seus códigos, como os números do alto.
      </p>
    </>
  );
}
