import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { Caixa, MapaDaUf, MapaDoBrasil, MunicipioDoMapa, Ponto } from "dominio/mapa";
import { posicionarNomes, type Vista } from "./nomesNoMapa";
import { useLargura } from "./useLargura";
import estilos from "./MapaDoTerritorio.module.css";

/*
 * O mapa da carteira em SVG, desenhado à mão como os outros gráficos: o Brasil de fundo, os estados da
 * carteira com os municípios, as regiões imediatas do estado escolhido e um círculo por município, do
 * tamanho do valor e no tom que a visão dá a ele. A dica sai ao passar o mouse; o toque escolhe o
 * município.
 */

/** As cores dos círculos (tokens.css, --cor-mapa-*): as ações de "Onde agir" e a direção da receita. */
export type TomDoCirculo = "critico" | "atencao" | "oportunidade" | "alta" | "estavel" | "queda";

/** O círculo de valor 0 aparece no tamanho mínimo: o lugar que tem algo, mas sem dinheiro para medir. */
export type CirculoDoMapa = { municipio: MunicipioDoMapa; valor: number; tom: TomDoCirculo };

type Props = {
  descricao: string;
  brasil: MapaDoBrasil;
  /** Os estados da carteira, com os municípios desenhados; o escolhido fica por cima e mais forte. */
  mapas: readonly MapaDaUf[];
  uf: string;
  /** A parte do mapa à vista; a troca é animada. */
  visao: Caixa;
  /**
   * A cor de cada município do estado escolhido, pelo código IBGE (as classes de MapaDoTerritorio.module.css);
   * o que não está aqui fica com a cor de fundo.
   */
  classes: ReadonlyMap<string, string>;
  /** Nos estados vizinhos da carteira, a cor só mostra onde há cliente. */
  comCliente: ReadonlySet<string>;
  circulos: readonly CirculoDoMapa[];
  /** Os municípios que podem ter o nome ao lado do círculo, do que mais pesa ao que menos (nomesNoMapa.ts). */
  rotulos: readonly MunicipioDoMapa[];
  municipioEscolhido: string | null;
  regiaoEscolhida: string | null;
  /** Onde o aparelho está ("Perto de mim"); null sem a localização. */
  posicao: Ponto | null;
  /** As paradas do roteiro, na ordem, numeradas a partir de 1 e ligadas pelo caminho. */
  roteiro: readonly MunicipioDoMapa[];
  dicaDe: (municipio: MunicipioDoMapa) => ReactNode;
  aoEscolher: (municipio: MunicipioDoMapa) => void;
};

const ALTURA_MINIMA = 300;
const ALTURA_MAXIMA = 620;
/** O raio do maior círculo, em px, no desenho largo e no estreito. */
const RAIO_MAXIMO = { largo: 30, estreito: 20 };
const RAIO_MINIMO = 3.5;
/** O raio do círculo numerado de cada parada do roteiro, em px. */
const RAIO_DA_PARADA = 10;
const DURACAO_DA_ANIMACAO_MS = 450;

export function MapaDoTerritorio(props: Props) {
  const { descricao, brasil, mapas, uf, visao, classes, comCliente, circulos, rotulos, municipioEscolhido, regiaoEscolhida, posicao, roteiro, dicaDe, aoEscolher } =
    props;
  const { referencia, largura } = useLargura<HTMLDivElement>();
  const caixa = useVisaoAnimada(visao);
  const [sobre, setSobre] = useState<{ municipio: MunicipioDoMapa; x: number; y: number } | null>(null);
  const porCodigo = useMemo(() => new Map(mapas.flatMap((mapa) => mapa.municipios.map((municipio) => [municipio.codigo, municipio] as const))), [mapas]);
  const escolhido = mapas.find((mapa) => mapa.uf === uf);

  const altura = Math.round(Math.min(ALTURA_MAXIMA, Math.max(ALTURA_MINIMA, largura * ((visao[3] - visao[1]) / (visao[2] - visao[0])))));
  const vista = ajustarAoQuadro(caixa, largura, altura);
  const escala = largura > 0 ? vista.largura / largura : 1;
  const raioMaximo = largura < 520 ? RAIO_MAXIMO.estreito : RAIO_MAXIMO.largo;
  const maiorValor = Math.max(0, ...circulos.map((circulo) => circulo.valor));
  const raioEmPx = (valor: number) => (maiorValor > 0 && valor > 0 ? Math.max(RAIO_MINIMO, Math.sqrt(valor / maiorValor) * raioMaximo) : RAIO_MINIMO);
  const valorDe = new Map(circulos.map((circulo) => [circulo.municipio.codigo, circulo.valor]));
  const nomes = posicionarNomes(rotulos, { vista, escala, raioDe: (municipio) => raioEmPx(valorDe.get(municipio.codigo) ?? 0) });

  const municipioDoEvento = (evento: PointerEvent<SVGSVGElement>) => {
    const codigo = (evento.target as Element).getAttribute("data-municipio");
    return codigo ? porCodigo.get(codigo) : undefined;
  };
  const aoMover = (evento: PointerEvent<SVGSVGElement>) => {
    const municipio = evento.pointerType === "mouse" ? municipioDoEvento(evento) : undefined;
    const quadro = evento.currentTarget.getBoundingClientRect();
    setSobre(municipio ? { municipio, x: evento.clientX - quadro.left, y: evento.clientY - quadro.top } : null);
  };

  return (
    <div ref={referencia} className={estilos.quadro}>
      {largura > 0 ? (
        <svg
          className={estilos.mapa}
          width={largura}
          height={altura}
          viewBox={`${vista.x} ${vista.y} ${vista.largura} ${vista.altura}`}
          role="img"
          aria-label={descricao}
          onPointerMove={aoMover}
          onPointerLeave={() => setSobre(null)}
          onClick={(evento) => {
            const codigo = (evento.target as Element).getAttribute("data-municipio");
            const municipio = codigo ? porCodigo.get(codigo) : undefined;
            if (municipio) aoEscolher(municipio);
          }}
        >
          <g className={estilos.brasil}>
            {brasil.ufs.map((outro) => (
              <path key={outro.uf} d={outro.contorno} />
            ))}
          </g>
          {mapas
            .filter((mapa) => mapa.uf !== uf)
            .map((mapa) => (
              <Estado key={mapa.uf} mapa={mapa} isEscolhido={false} classeDe={(codigo) => (comCliente.has(codigo) ? "cliente" : undefined)} />
            ))}
          {escolhido ? <Estado mapa={escolhido} isEscolhido classeDe={(codigo) => classes.get(codigo)} /> : null}
          {regiaoEscolhida && escolhido ? (
            <path className={estilos.regiaoEscolhida} d={escolhido.regioes.find((regiao) => regiao.codigo === regiaoEscolhida)?.contorno} />
          ) : null}
          <g className={estilos.circulos}>
            {[...circulos]
              .sort((a, b) => b.valor - a.valor)
              .map(({ municipio, valor, tom }) => (
                <circle
                  key={municipio.codigo}
                  data-municipio={municipio.codigo}
                  data-tom={tom}
                  cx={municipio.centro[0]}
                  cy={municipio.centro[1]}
                  r={raioEmPx(valor) * escala}
                />
              ))}
          </g>
          {municipioEscolhido && porCodigo.get(municipioEscolhido) ? (
            <path className={estilos.municipioEscolhido} d={porCodigo.get(municipioEscolhido)?.d} />
          ) : null}
          <Roteiro paradas={roteiro} partida={posicao} escala={escala} />
          {posicao ? <AquiEstou posicao={posicao} escala={escala} /> : null}
          <g className={estilos.rotulos} fontSize={12 * escala} strokeWidth={3.5 * escala}>
            {nomes.map(({ municipio, x, y, isAEsquerda }) => (
              <text key={municipio.codigo} x={x} y={y} textAnchor={isAEsquerda ? "end" : "start"}>
                {municipio.nome}
              </text>
            ))}
          </g>
        </svg>
      ) : null}
      {sobre ? <Dica x={sobre.x} y={sobre.y} largura={largura}>{dicaDe(sobre.municipio)}</Dica> : null}
    </div>
  );
}

type PropsDoEstado = {
  mapa: MapaDaUf;
  isEscolhido: boolean;
  classeDe: (codigoDoMunicipio: string) => string | undefined;
};

/** Os municípios do estado, as divisas das regiões (só no escolhido) e o contorno. */
function Estado({ mapa, isEscolhido, classeDe }: PropsDoEstado) {
  return (
    <g className={isEscolhido ? estilos.estadoEscolhido : estilos.estadoVizinho}>
      {mapa.municipios.map((municipio) => (
        <path key={municipio.codigo} d={municipio.d} data-municipio={municipio.codigo} data-classe={classeDe(municipio.codigo)} />
      ))}
      {isEscolhido ? <path className={estilos.regioes} d={mapa.regioes.map((regiao) => regiao.contorno).join("")} /> : null}
      <path className={estilos.contornoDoEstado} d={mapa.contorno} />
    </g>
  );
}

/** O caminho do roteiro, tracejado, de onde o aparelho está até a última parada, e o número de cada parada. */
function Roteiro({ paradas, partida, escala }: { paradas: readonly MunicipioDoMapa[]; partida: Ponto | null; escala: number }) {
  if (paradas.length === 0) return null;
  const pontos = [...(partida ? [partida] : []), ...paradas.map(({ centro }) => centro)];
  return (
    <g className={estilos.roteiro}>
      {pontos.length > 1 ? <polyline className={estilos.caminhoDoRoteiro} points={pontos.map(([x, y]) => `${x},${y}`).join(" ")} /> : null}
      {paradas.map(({ codigo, centro: [x, y] }, i) => (
        <g key={codigo} className={estilos.parada}>
          <circle cx={x} cy={y} r={RAIO_DA_PARADA * escala} />
          <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={11 * escala}>
            {i + 1}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Onde o aparelho está: o ponto azul com o halo que pulsa, como nos mapas do celular. */
function AquiEstou({ posicao: [x, y], escala }: { posicao: Ponto; escala: number }) {
  return (
    <g className={estilos.aquiEstou} aria-hidden="true">
      <circle className={estilos.haloDoAquiEstou} cx={x} cy={y} r={16 * escala} />
      <circle className={estilos.pontoDoAquiEstou} cx={x} cy={y} r={6.5 * escala} />
    </g>
  );
}

/** A dica acima do ponteiro; perto das bordas, ela recua para não sair do quadro. */
function Dica({ x, y, largura, children }: { x: number; y: number; largura: number; children: ReactNode }) {
  const recuo = largura > 0 ? Math.min(100, Math.max(0, (x / largura) * 100)) : 50;
  return (
    <div className={estilos.dica} style={{ left: x, top: y, transform: `translate(-${recuo}%, calc(-100% - 14px))` }} role="status">
      {children}
    </div>
  );
}

/** A caixa crescida para a proporção do quadro, com o centro no mesmo lugar: o mapa enche o quadro todo. */
function ajustarAoQuadro([x0, y0, x1, y1]: Caixa, largura: number, altura: number): Vista {
  const larguraDaCaixa = Math.max(1, x1 - x0);
  const alturaDaCaixa = Math.max(1, y1 - y0);
  const proporcao = largura > 0 && altura > 0 ? largura / altura : larguraDaCaixa / alturaDaCaixa;
  const larguraFinal = Math.max(larguraDaCaixa, alturaDaCaixa * proporcao);
  const alturaFinal = larguraFinal / proporcao;
  return { x: (x0 + x1) / 2 - larguraFinal / 2, y: (y0 + y1) / 2 - alturaFinal / 2, largura: larguraFinal, altura: alturaFinal };
}

/** Vai da caixa à vista até a nova, suave; quem pediu menos movimento no aparelho vê a troca direta. */
function useVisaoAnimada(alvo: Caixa): Caixa {
  const [atual, setAtual] = useState<Caixa>(alvo);
  const naTela = useRef<Caixa>(alvo);
  const [ax0, ay0, ax1, ay1] = alvo;
  useEffect(() => {
    const destino: Caixa = [ax0, ay0, ax1, ay1];
    const origem = naTela.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      naTela.current = destino;
      setAtual(destino);
      return;
    }
    const inicio = performance.now();
    let quadro = requestAnimationFrame(function passo(agora) {
      const t = Math.min(1, (agora - inicio) / DURACAO_DA_ANIMACAO_MS);
      const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const caixa = origem.map((valor, i) => valor + ((destino[i] as number) - valor) * k) as unknown as Caixa;
      naTela.current = caixa;
      setAtual(caixa);
      if (t < 1) quadro = requestAnimationFrame(passo);
    });
    return () => cancelAnimationFrame(quadro);
  }, [ax0, ay0, ax1, ay1]);
  return atual;
}
