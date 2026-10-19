import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { Cartao } from "../componentes/Cartao";
import { Segmentos, type Segmento } from "../componentes/Segmentos";
import { Variacao } from "../componentes/Variacao";
import { montarFaturadoPorMes, montarTendencia, resumirATendencia } from "../dados/faturamentoDoCliente";
import type { FichaCliente } from "../dados/tipos";
import { formatarMesAno } from "../formato";
import { BarrasMensais } from "../graficos/BarrasMensais";
import { LinhaDeTendencia } from "../graficos/LinhaDeTendencia";
import moldura from "../graficos/moldura.module.css";

/*
 * O cartão Tendência da ficha: o faturado dos últimos 4 anos em duas vistas, a escolha do Lucas em
 * 2026-10-18. A média por mês de 12 meses, o padrão, mostra se o cliente cresce; as barras de cada
 * mês mostram o vaivém dos pedidos e a época do ano que a média tira.
 */

type Vista = "doze-meses" | "por-mes";

const VISTAS: readonly Segmento<Vista>[] = [
  { valor: "doze-meses", rotulo: "12 meses" },
  { valor: "por-mes", rotulo: "Por mês" },
];

export function TendenciaDaFicha({ ficha, mesAtual }: { ficha: FichaCliente; mesAtual: string }) {
  const [vista, setVista] = useState<Vista>("doze-meses");
  const tendencia = montarTendencia(ficha.mensal, mesAtual);
  const andamento = resumirATendencia(tendencia);
  const isPorMes = vista === "por-mes";
  return (
    <Cartao
      titulo="Tendência"
      icone={TrendingUp}
      subtitulo={isPorMes ? "Faturado de cada mês, nos últimos 4 anos" : "Média por mês nos 12 meses até cada mês, nos últimos 4 anos"}
    >
      <Segmentos rotulo="Como ver o faturado" opcoes={VISTAS} selecionado={vista} aoEscolher={setVista} className={moldura.vistas} />
      {andamento ? (
        <p className={moldura.resumoDoGrafico}>
          <span>Desde {formatarMesAno(andamento.desde)}:</span>
          <Variacao razao={andamento.variacao} referencia="na média por mês" />
        </p>
      ) : null}
      {isPorMes ? (
        <BarrasMensais
          descricao={`Faturado de ${ficha.nome} em cada mês, nos últimos 4 anos`}
          rotulos={{ valor: "Faturado no mês" }}
          barras={montarFaturadoPorMes(ficha.mensal, mesAtual)}
          altura={220}
        />
      ) : (
        <LinhaDeTendencia
          descricao={`Média por mês de ${ficha.nome} nos 12 meses até cada mês, nos últimos 4 anos`}
          rotulo="Média por mês"
          pontos={tendencia}
          altura={220}
        />
      )}
      <p className={moldura.notaDoGrafico}>
        {isPorMes
          ? "Cada barra é o faturado de um mês fechado: mostra o vaivém dos pedidos e a época do ano, que a média de 12 meses tira."
          : "A média de 12 meses tira o vaivém dos pedidos e a época do ano. O último ponto é o faturado em 12 meses do alto da ficha dividido por 12."}
      </p>
    </Cartao>
  );
}
