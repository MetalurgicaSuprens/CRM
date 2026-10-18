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
import estilos from "./FichaCliente.module.css";

/*
 * O cartão Tendência da ficha: o faturado dos últimos 4 anos em duas vistas, a escolha do Lucas em
 * 2026-10-18. A soma de 12 meses, o padrão, mostra se o cliente cresce; as barras de cada mês mostram
 * o vaivém dos pedidos e a época do ano que a soma tira.
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
      subtitulo={isPorMes ? "Faturado de cada mês, nos últimos 4 anos" : "Faturado nos 12 meses até cada mês, nos últimos 4 anos"}
    >
      <Segmentos rotulo="Como ver o faturado" opcoes={VISTAS} selecionado={vista} aoEscolher={setVista} className={estilos.vistas} />
      {andamento ? (
        <p className={estilos.resumoDoGrafico}>
          <span>Desde {formatarMesAno(andamento.desde)}:</span>
          <Variacao razao={andamento.variacao} referencia="no faturado em 12 meses" />
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
          descricao={`Faturado de ${ficha.nome} nos 12 meses até cada mês, nos últimos 4 anos`}
          rotulo="Faturado em 12 meses"
          pontos={tendencia}
          altura={220}
        />
      )}
      <p className={estilos.notaDoGrafico}>
        {isPorMes
          ? "Cada barra é o faturado de um mês fechado: mostra o vaivém dos pedidos e a época do ano, que a soma de 12 meses tira."
          : "Somar 12 meses tira o vaivém dos pedidos e a época do ano. O último ponto é o faturado em 12 meses do alto da ficha."}
      </p>
    </Cartao>
  );
}
