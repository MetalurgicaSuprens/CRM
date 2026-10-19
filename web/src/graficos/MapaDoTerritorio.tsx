import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { DETALHE_DA_CIDADE, type Caixa, type MapaDaCidade, type MapaDaUf, type MapaDoBrasil, type MunicipioDoMapa, type Ponto } from "dominio/mapa";
import type { ClienteNoMapa } from "../dados/cidade";
import { posicionarNomes } from "./nomesNoMapa";
import { ajustarAoQuadro, useGestosDoMapa } from "./useGestosDoMapa";
import { useLargura } from "./useLargura";
import estilos from "./MapaDoTerritorio.module.css";

/*
 * O mapa da carteira em SVG, desenhado à mão como os outros gráficos: o Brasil de fundo, os estados da
 * carteira com os municípios, as regiões imediatas do estado escolhido e um círculo por município, do
 * tamanho do valor e no tom que a visão dá a ele. A dica sai ao passar o mouse; o toque escolhe o
 * município. De perto, a cidade escolhida ocupa o quadro, com os bairros e um ponto por cliente. O
 * representante aproxima e move o mapa à vontade (useGestosDoMapa.ts).
 */

/** As cores dos círculos (tokens.css, --cor-mapa-*): as ações de "Onde agir" e a direção da receita. */
export type TomDoCirculo = "critico" | "atencao" | "oportunidade" | "alta" | "estavel" | "queda";

/** O círculo de valor 0 aparece no tamanho mínimo: o lugar que tem algo, mas sem dinheiro para medir. */
export type CirculoDoMapa = { municipio: MunicipioDoMapa; valor: number; tom: TomDoCirculo };

/** A cidade de perto: o desenho dela (null sem arquivo: fica o do estado) e os clientes com ponto. */
export type CidadeDePerto = {
  municipio: MunicipioDoMapa;
  desenho: MapaDaCidade | null;
  clientes: readonly ClienteNoMapa[];
  clienteEscolhido: string | null;
};

/** O que está sob o mouse: a dica de cada um. */
type Sobre = { x: number; y: number } & (
  | { tipo: "municipio"; municipio: MunicipioDoMapa }
  | { tipo: "cliente"; cliente: ClienteNoMapa }
  | { tipo: "area"; nome: string }
);

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
  /** As paradas do roteiro, na ordem, numeradas a partir de 1 e ligadas pelo caminho, na unidade do estado. */
  roteiro: readonly Ponto[];
  cidade: CidadeDePerto | null;
  dicaDe: (municipio: MunicipioDoMapa) => ReactNode;
  dicaDoCliente: (cliente: ClienteNoMapa) => ReactNode;
  dicaDaArea: (nome: string) => ReactNode;
  aoEscolher: (municipio: MunicipioDoMapa) => void;
  aoEscolherCliente: (cliente: ClienteNoMapa) => void;
};

const ALTURA_MINIMA = 300;
const ALTURA_MAXIMA = 620;
/** O raio do maior círculo, em px, no desenho largo e no estreito. */
const RAIO_MAXIMO = { largo: 30, estreito: 20 };
const RAIO_MINIMO = 3.5;
/** O raio do círculo numerado de cada parada do roteiro, em px. */
const RAIO_DA_PARADA = 10;
/** O ponto do cliente, em px: do que menos fatura na cidade ao que mais. */
const RAIO_DO_CLIENTE = { minimo: 4.5, maximo: 10 };
const DURACAO_DA_ANIMACAO_MS = 450;

export function MapaDoTerritorio(props: Props) {
  const { descricao, brasil, mapas, uf, visao, classes, comCliente, circulos, rotulos, municipioEscolhido, regiaoEscolhida, posicao, roteiro, cidade } = props;
  const { referencia, largura } = useLargura<HTMLDivElement>();
  const [sobre, setSobre] = useState<Sobre | null>(null);
  const porCodigo = useMemo(() => new Map(mapas.flatMap((mapa) => mapa.municipios.map((municipio) => [municipio.codigo, municipio] as const))), [mapas]);
  const clientePorCodigo = new Map((cidade?.clientes ?? []).map((cliente) => [cliente.cliente.codigo, cliente]));
  const escolhido = mapas.find((mapa) => mapa.uf === uf);

  const altura = Math.round(Math.min(ALTURA_MAXIMA, Math.max(ALTURA_MINIMA, largura * ((visao[3] - visao[1]) / (visao[2] - visao[0])))));
  const gestos = useGestosDoMapa({ visao, quadro: { largura, altura }, elemento: referencia });
  const caixa = useVisaoAnimada(gestos.alvo, gestos.isAnimado);
  const vista = ajustarAoQuadro(caixa, largura, altura);
  const escala = largura > 0 ? vista.largura / largura : 1;
  const raioMaximo = largura < 520 ? RAIO_MAXIMO.estreito : RAIO_MAXIMO.largo;
  const maiorValor = Math.max(0, ...circulos.map((circulo) => circulo.valor));
  const raioEmPx = (valor: number) => (maiorValor > 0 && valor > 0 ? Math.max(RAIO_MINIMO, Math.sqrt(valor / maiorValor) * raioMaximo) : RAIO_MINIMO);
  const valorDe = new Map(circulos.map((circulo) => [circulo.municipio.codigo, circulo.valor]));
  const nomes = posicionarNomes(rotulos, { vista, escala, raioDe: (municipio) => raioEmPx(valorDe.get(municipio.codigo) ?? 0) });

  // A dica e o clique vêm do atributo do que está sob o ponteiro: o cliente, o bairro ou o município.
  const doAlvo = (alvo: Element) => {
    const cliente = clientePorCodigo.get(alvo.getAttribute("data-cliente") ?? "");
    if (cliente) return { tipo: "cliente" as const, cliente };
    const area = alvo.getAttribute("data-area");
    if (area) return { tipo: "area" as const, nome: area };
    const municipio = porCodigo.get(alvo.getAttribute("data-municipio") ?? "");
    return municipio ? { tipo: "municipio" as const, municipio } : null;
  };
  const aoMover = (evento: PointerEvent<SVGSVGElement>) => {
    const alvo = evento.pointerType === "mouse" ? doAlvo(evento.target as Element) : null;
    const quadro = evento.currentTarget.getBoundingClientRect();
    setSobre(alvo ? { ...alvo, x: evento.clientX - quadro.left, y: evento.clientY - quadro.top } : null);
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
          onPointerDown={gestos.aoPressionar}
          onPointerMove={(evento) => {
            if (gestos.aoMover(evento)) setSobre(null);
            else aoMover(evento);
          }}
          onPointerUp={gestos.aoSoltar}
          onPointerCancel={gestos.aoSoltar}
          onPointerLeave={() => setSobre(null)}
          onClick={(evento) => {
            if (gestos.isCliqueDoArraste()) return;
            const alvo = doAlvo(evento.target as Element);
            if (alvo?.tipo === "cliente") props.aoEscolherCliente(alvo.cliente);
            else if (alvo?.tipo === "municipio" && alvo.municipio.codigo !== cidade?.municipio.codigo) props.aoEscolher(alvo.municipio);
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
          {cidade ? <Cidade cidade={cidade} /> : null}
          <g className={estilos.circulos}>
            {[...circulos]
              // De perto, os clientes da cidade tomam o lugar do círculo dela.
              .filter(({ municipio }) => municipio.codigo !== cidade?.municipio.codigo)
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
          {municipioEscolhido && porCodigo.get(municipioEscolhido) && !cidade?.desenho ? (
            <path className={estilos.municipioEscolhido} d={porCodigo.get(municipioEscolhido)?.d} />
          ) : null}
          {cidade ? <ClientesDaCidade cidade={cidade} escala={escala} /> : null}
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
      {largura > 0 ? (
        <div className={estilos.controlesDoZoom}>
          <button type="button" className={estilos.botaoDoZoom} onClick={() => gestos.aproximarDoMeio("mais")} aria-label="Aproximar o mapa">
            <Plus size={18} aria-hidden="true" />
          </button>
          <button type="button" className={estilos.botaoDoZoom} onClick={() => gestos.aproximarDoMeio("menos")} aria-label="Afastar o mapa">
            <Minus size={18} aria-hidden="true" />
          </button>
          {gestos.isAjustada ? (
            <button type="button" className={estilos.botaoDoZoom} onClick={gestos.voltar} aria-label="Voltar ao enquadramento" title="Voltar ao enquadramento">
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
      {gestos.isAvisoDoCtrl ? (
        <p className={estilos.avisoDoZoom} role="status">
          Use Ctrl + rolagem para aproximar o mapa
        </p>
      ) : null}
      {largura > 0 ? <p className={estilos.dicaDoToque}>Dois dedos movem e aproximam o mapa</p> : null}
      {sobre ? (
        <Dica x={sobre.x} y={sobre.y} largura={largura}>
          {sobre.tipo === "cliente" ? props.dicaDoCliente(sobre.cliente) : sobre.tipo === "area" ? props.dicaDaArea(sobre.nome) : props.dicaDe(sobre.municipio)}
        </Dica>
      ) : null}
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
function Roteiro({ paradas, partida, escala }: { paradas: readonly Ponto[]; partida: Ponto | null; escala: number }) {
  if (paradas.length === 0) return null;
  const pontos = [...(partida ? [partida] : []), ...paradas];
  return (
    <g className={estilos.roteiro}>
      {pontos.length > 1 ? <polyline className={estilos.caminhoDoRoteiro} points={pontos.map(([x, y]) => `${x},${y}`).join(" ")} /> : null}
      {paradas.map(([x, y], i) => (
        <g key={i} className={estilos.parada}>
          <circle cx={x} cy={y} r={RAIO_DA_PARADA * escala} />
          <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={11 * escala}>
            {i + 1}
          </text>
        </g>
      ))}
    </g>
  );
}

/**
 * A cidade de perto, por baixo dos círculos: o desenho dela, com os bairros ou os distritos. Fica num
 * grupo com a escala da unidade da cidade, 5 m, por cima do estado.
 */
function Cidade({ cidade: { desenho, municipio } }: { cidade: CidadeDePerto }) {
  if (!desenho) return null;
  const [x0, y0, x1, y1] = desenho.caixa;
  const [largura, altura] = [x1 - x0, y1 - y0];
  return (
    <g className={estilos.cidade} transform={`scale(${1 / DETALHE_DA_CIDADE})`}>
      {/* Fora da cidade, o estado recua: de perto, o contorno grosso dos vizinhos não casa com o fino dela. */}
      <rect className={estilos.foraDaCidade} x={x0 - largura * 3} y={y0 - altura * 3} width={largura * 7} height={altura * 7} />
      <path className={estilos.fundoDaCidade} d={desenho.contorno} data-municipio={municipio.codigo} />
      {desenho.divisoes?.areas.map((area, i) => (
        <path key={`${area.nome}-${i}`} className={estilos.areaDaCidade} d={area.d} data-area={area.nome} />
      ))}
      <path className={estilos.contornoDaCidade} d={desenho.contorno} />
    </g>
  );
}

/** Um ponto por cliente, do tamanho do faturado dele entre os da cidade e na cor da ação mais grave. */
function ClientesDaCidade({ cidade: { clientes, clienteEscolhido }, escala }: { cidade: CidadeDePerto; escala: number }) {
  const maior = Math.max(1, ...clientes.map(({ cliente }) => cliente.faturamento12m));
  const raio = (faturamento: number) =>
    (RAIO_DO_CLIENTE.minimo + Math.sqrt(Math.max(0, faturamento) / maior) * (RAIO_DO_CLIENTE.maximo - RAIO_DO_CLIENTE.minimo)) * escala * DETALHE_DA_CIDADE;
  return (
    <g className={estilos.clientesDaCidade} transform={`scale(${1 / DETALHE_DA_CIDADE})`}>
      {clientes.map(({ cliente, ponto: [x, y], tom }) => (
        <circle
          key={cliente.codigo}
          data-cliente={cliente.codigo}
          data-tom={tom}
          data-escolhido={cliente.codigo === clienteEscolhido ? "" : undefined}
          cx={x}
          cy={y}
          r={raio(cliente.faturamento12m) * (cliente.codigo === clienteEscolhido ? 1.35 : 1)}
        />
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

/**
 * Vai da caixa à vista até a nova, suave; o arraste e a rolagem (sem `animado`) e quem pediu menos
 * movimento no aparelho veem a troca direta.
 */
function useVisaoAnimada(alvo: Caixa, animado: boolean): Caixa {
  const [atual, setAtual] = useState<Caixa>(alvo);
  const naTela = useRef<Caixa>(alvo);
  const [ax0, ay0, ax1, ay1] = alvo;
  useEffect(() => {
    const destino: Caixa = [ax0, ay0, ax1, ay1];
    const origem = naTela.current;
    if (!animado || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
    // `animado` vem junto com a caixa nova: mudar só ele não move nada.
  }, [ax0, ay0, ax1, ay1]);
  return atual;
}
