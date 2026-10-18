import { useState, type ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { Cartao } from "../componentes/Cartao";
import { Segmentos } from "../componentes/Segmentos";
import { Variacao } from "../componentes/Variacao";
import {
  compararNoMesmoMes,
  montarAcumulados,
  montarBlocosDe12Meses,
  montarMapaDeCalor,
  montarTendencia,
  resumirATendencia,
} from "../dados/faturamentoDoCliente";
import type { FichaCliente } from "../dados/tipos";
import { formatarMesAno, formatarNomeDoMes } from "../formato";
import { BlocosDe12Meses } from "../graficos/BlocosDe12Meses";
import { LinhaDeTendencia } from "../graficos/LinhaDeTendencia";
import { LinhasPorAno } from "../graficos/LinhasPorAno";
import { MapaDeCalor } from "../graficos/MapaDeCalor";
import estilos from "./FichaCliente.module.css";

/*
 * O cartão Tendência da ficha: o cliente compra mais, menos ou igual nos últimos 4 anos? Até o Lucas
 * escolher (pedido de 2026-10-18), são quatro modelos lado a lado num seletor. Escolhido o modelo, o
 * seletor e os outros saem.
 */

type PropsDoModelo = { ficha: FichaCliente; mesAtual: string };

type Modelo = {
  valor: "blocos" | "acumulado" | "mapa" | "linha";
  rotulo: string;
  subtitulo: string;
  Conteudo: (props: PropsDoModelo) => ReactNode;
};

const BLOCOS: Modelo = { valor: "blocos", rotulo: "Ano a ano", subtitulo: "Faturado e peças em cada 12 meses, nos últimos 4 anos", Conteudo: AnoAAno };
const MODELOS: readonly Modelo[] = [
  BLOCOS,
  { valor: "acumulado", rotulo: "Acumulado", subtitulo: "O faturado de cada ano, somado mês a mês", Conteudo: Acumulado },
  { valor: "mapa", rotulo: "Mapa de calor", subtitulo: "O faturado de cada mês, nos últimos 4 anos", Conteudo: MapaDosMeses },
  { valor: "linha", rotulo: "12 meses", subtitulo: "Faturado nos 12 meses até cada mês, nos últimos 4 anos", Conteudo: DozeMeses },
];

/** O modelo escolhido vale para as fichas seguintes, até recarregar a página: dá para comparar clientes no mesmo modelo. */
let modeloEscolhido: Modelo["valor"] = BLOCOS.valor;

export function TendenciaDaFicha({ ficha, mesAtual }: PropsDoModelo) {
  const [escolhido, setEscolhido] = useState(modeloEscolhido);
  const modelo = MODELOS.find(({ valor }) => valor === escolhido) ?? BLOCOS;
  const escolher = (valor: Modelo["valor"]) => {
    modeloEscolhido = valor;
    setEscolhido(valor);
  };
  return (
    <Cartao titulo="Tendência" icone={TrendingUp} subtitulo={modelo.subtitulo}>
      <div className={estilos.modelos}>
        <span className={estilos.rotuloDosModelos}>Modelo em teste</span>
        <Segmentos rotulo="Modelo do gráfico de tendência" opcoes={MODELOS} selecionado={escolhido} aoEscolher={escolher} />
      </div>
      <modelo.Conteudo ficha={ficha} mesAtual={mesAtual} />
    </Cartao>
  );
}

function AnoAAno({ ficha, mesAtual }: PropsDoModelo) {
  const blocos = montarBlocosDe12Meses(ficha.mensal, mesAtual);
  const [anterior, ultimo] = blocos.slice(-2);
  return (
    <>
      {anterior && ultimo ? (
        <p className={estilos.resumoDoGrafico}>
          <span>Últimos 12 meses contra os 12 anteriores:</span>
          <Variacao razao={ultimo.valor / anterior.valor - 1} referencia="no faturado" />
          <Variacao razao={ultimo.pecas / anterior.pecas - 1} referencia="nas peças" />
        </p>
      ) : null}
      <BlocosDe12Meses blocos={blocos} descricao={`Faturado e peças de ${ficha.nome} em cada 12 meses, nos últimos 4 anos`} />
      <p className={estilos.notaDoGrafico}>
        Cada barra soma 12 meses fechados, e a variação compara com os 12 meses anteriores. Se o faturado sobe e as peças não, a alta é preço.
      </p>
    </>
  );
}

function Acumulado({ ficha, mesAtual }: PropsDoModelo) {
  const anos = montarAcumulados(ficha.mensal, mesAtual);
  const comparacao = compararNoMesmoMes(anos);
  return (
    <>
      {comparacao && comparacao.comparacoes.length > 0 ? (
        <p className={estilos.resumoDoGrafico}>
          <span>
            {comparacao.ano}
            {comparacao.mes < 12 ? ` até ${formatarNomeDoMes(`${comparacao.ano}-${String(comparacao.mes).padStart(2, "0")}`)}` : ""}:
          </span>
          {comparacao.comparacoes.map(({ ano, razao }) => (
            <Variacao key={ano} razao={razao} referencia={`vs ${ano}`} />
          ))}
        </p>
      ) : null}
      <LinhasPorAno anos={anos} descricao={`Faturado de ${ficha.nome} em cada ano, somado mês a mês`} altura={220} />
      <p className={estilos.notaDoGrafico}>
        Cada linha soma o faturado do ano, mês a mês. No mesmo mês, a linha mais alta é o ano em que ele mais comprou até ali, e a ponta é o total do ano.
      </p>
    </>
  );
}

function MapaDosMeses({ ficha, mesAtual }: PropsDoModelo) {
  const anos = montarMapaDeCalor(ficha.mensal, mesAtual);
  const [anterior, recente] = anos.slice(-2);
  return (
    <>
      {anterior && recente ? (
        <p className={estilos.resumoDoGrafico}>
          Comprou em {recente.mesesComCompra} dos {recente.mesesFechados} meses de {recente.ano}, e em {anterior.mesesComCompra} dos {anterior.mesesFechados} de{" "}
          {anterior.ano}.
        </p>
      ) : null}
      <MapaDeCalor anos={anos} descricao={`Faturado de ${ficha.nome} em cada mês, nos últimos 4 anos`} />
      <p className={estilos.notaDoGrafico}>
        Cada quadrado é um mês: quanto mais escuro, mais ele faturou, comparado ao maior mês dos 4 anos. O cinza é mês sem compra.
      </p>
    </>
  );
}

function DozeMeses({ ficha, mesAtual }: PropsDoModelo) {
  const tendencia = montarTendencia(ficha.mensal, mesAtual);
  const andamento = resumirATendencia(tendencia);
  return (
    <>
      {andamento ? (
        <p className={estilos.resumoDoGrafico}>
          <span>Desde {formatarMesAno(andamento.desde)}:</span>
          <Variacao razao={andamento.variacao} referencia="no faturado em 12 meses" />
        </p>
      ) : null}
      <LinhaDeTendencia
        descricao={`Faturado de ${ficha.nome} nos 12 meses até cada mês, nos últimos 4 anos`}
        rotulo="Faturado em 12 meses"
        pontos={tendencia}
        altura={220}
      />
      <p className={estilos.notaDoGrafico}>Somar 12 meses tira o vaivém dos pedidos e a época do ano. O último ponto é o faturado em 12 meses do alto da ficha.</p>
    </>
  );
}
