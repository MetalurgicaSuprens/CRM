import { TrendingUp } from "lucide-react";
import { Cartao } from "../componentes/Cartao";
import { montarTendencia, resumirATendencia } from "../dados/faturamentoDoCliente";
import type { FichaCliente } from "../dados/tipos";
import { LinhaDeTendencia, ResumoDaTendencia } from "../graficos/LinhaDeTendencia";
import moldura from "../graficos/moldura.module.css";

/*
 * O cartão Tendência da ficha: os últimos 4 anos num gráfico só (a escolha do Lucas em 2026-11-18,
 * que tirou a vista "Por mês"). A média por mês de 12 meses, a linha, mostra se o cliente cresce; o
 * faturado de cada mês, as barras atrás dela, mostra o vaivém dos pedidos e a época do ano que a média tira.
 */

export function TendenciaDaFicha({ ficha, mesAtual }: { ficha: FichaCliente; mesAtual: string }) {
  const tendencia = montarTendencia(ficha.mensal, mesAtual);
  const andamento = resumirATendencia(tendencia);
  return (
    <Cartao titulo="Tendência" icone={TrendingUp} subtitulo="Média por mês nos 12 meses até cada mês, sobre o faturado de cada mês, nos últimos 4 anos">
      <LinhaDeTendencia
        descricao={`Faturado de ${ficha.nome} em cada mês e a média por mês nos 12 meses até cada um, nos últimos 4 anos`}
        rotulo="Média por mês"
        pontos={tendencia}
        resumo={andamento ? <ResumoDaTendencia desde={andamento.desde} variacao={andamento.variacao} /> : undefined}
        altura={220}
      />
      <p className={moldura.notaDoGrafico}>
        Cada ponto da linha é a média das barras dos 12 meses até ele: aponte um mês para ver quais. O último ponto é o faturado em 12 meses do alto da ficha
        dividido por 12.
      </p>
    </Cartao>
  );
}
