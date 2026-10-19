import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { Caixa } from "dominio/mapa";
import type { Vista } from "./nomesNoMapa";
import { aproximar, arrastar, vistaDaCaixa, type Limites, type Quadro } from "./zoomDoMapa";

/*
 * O zoom e o arraste do mapa pelo representante, por cima da parte que a tela escolhe (`visao`):
 *   - no computador, arrastar move, e Ctrl (ou ⌘) com a rolagem aproxima, como os mapas do Google
 *     dentro de uma página: a rolagem sozinha continua rolando a página, com o aviso do Ctrl;
 *   - no celular, dois dedos movem e aproximam; um dedo rola a página;
 *   - os botões + e − aproximam do meio, e "Voltar" desfaz tudo.
 * Quando a tela escolhe outra parte (outra cidade, outra região), o ajuste do representante some.
 */

/** A vista mais fechada: 300 m de largura, na unidade do mapa (décimos de km). */
const LARGURA_MINIMA = 3;
/** O quanto dá para afastar além da parte que a tela escolheu. */
const AFASTAMENTO_MAXIMO = 4;
const FATOR_DO_BOTAO = 0.5;
/** Quantos px o mouse anda antes de virar arraste: menos que isso ainda é clique. */
const PX_DO_ARRASTE = 4;
const DURACAO_DO_AVISO_MS = 1_500;

type Ajuste = { base: Caixa; caixa: Caixa; animar: boolean };
type Posicao = readonly [number, number];

export function useGestosDoMapa({ visao, quadro, elemento }: { visao: Caixa; quadro: Quadro; elemento: RefObject<HTMLElement | null> }) {
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  const [isAvisoDoCtrl, setIsAvisoDoCtrl] = useState(false);
  const isAjustada = ajuste !== null && isMesmaCaixa(ajuste.base, visao);
  const alvo = isAjustada ? ajuste.caixa : visao;
  const vista = ajustarAoQuadro(alvo, quadro.largura, quadro.altura);
  const limites: Limites = { larguraMinima: LARGURA_MINIMA, larguraMaxima: ajustarAoQuadro(visao, quadro.largura, quadro.altura).largura * AFASTAMENTO_MAXIMO };
  const mudar = (caixa: Caixa, animar: boolean) => setAjuste({ base: visao, caixa, animar });

  const dedos = useRef(new Map<number, Posicao>());
  const arraste = useRef<{ inicio: Posicao; vista: Vista; isMovendo: boolean } | null>(null);
  const pinca = useRef<{ distancia: number; meio: Posicao; vista: Vista } | null>(null);
  const isCliqueDoArraste = useRef(false);

  // A rolagem precisa de um ouvinte que não seja passivo, para o Ctrl + rolagem não rolar a página.
  const atual = useRef({ vista, quadro, limites, mudar });
  atual.current = { vista, quadro, limites, mudar };
  useEffect(() => {
    const alvoDaRolagem = elemento.current;
    if (!alvoDaRolagem) return;
    let aviso: ReturnType<typeof setTimeout> | undefined;
    const aoRolar = (evento: WheelEvent) => {
      if (!evento.ctrlKey && !evento.metaKey) {
        setIsAvisoDoCtrl(true);
        clearTimeout(aviso);
        aviso = setTimeout(() => setIsAvisoDoCtrl(false), DURACAO_DO_AVISO_MS);
        return;
      }
      evento.preventDefault();
      const { vista: agora, quadro: tamanho, limites: ate, mudar: aplicar } = atual.current;
      const caixa = alvoDaRolagem.getBoundingClientRect();
      // O trackpad manda passos pequenos e o mouse, grandes: o fator acompanha o tamanho do passo.
      const fator = Math.exp(Math.max(-1, Math.min(1, evento.deltaY * 0.004)));
      aplicar(aproximar(agora, fator, [evento.clientX - caixa.left, evento.clientY - caixa.top], tamanho, ate), false);
    };
    alvoDaRolagem.addEventListener("wheel", aoRolar, { passive: false });
    return () => {
      alvoDaRolagem.removeEventListener("wheel", aoRolar);
      clearTimeout(aviso);
    };
  }, [elemento]);

  const posicaoNoQuadro = (evento: PointerEvent<Element>): Posicao => {
    const caixa = evento.currentTarget.getBoundingClientRect();
    return [evento.clientX - caixa.left, evento.clientY - caixa.top];
  };

  return {
    alvo,
    isAnimado: isAjustada ? ajuste.animar : true,
    isAjustada,
    isAvisoDoCtrl,
    aproximarDoMeio: (fator: "mais" | "menos") =>
      mudar(aproximar(vista, fator === "mais" ? FATOR_DO_BOTAO : 1 / FATOR_DO_BOTAO, [quadro.largura / 2, quadro.altura / 2], quadro, limites), true),
    voltar: () => setAjuste(null),
    aoPressionar: (evento: PointerEvent<SVGSVGElement>) => {
      if (evento.pointerType === "mouse" && evento.button !== 0) return;
      const posicao = posicaoNoQuadro(evento);
      dedos.current.set(evento.pointerId, posicao);
      if (evento.pointerType === "mouse") arraste.current = { inicio: posicao, vista, isMovendo: false };
      if (dedos.current.size === 2) {
        const [a, b] = [...dedos.current.values()] as [Posicao, Posicao];
        pinca.current = { distancia: distancia(a, b), meio: meio(a, b), vista };
      }
    },
    /** true quando o movimento é do zoom ou do arraste: a dica do mouse não aparece. */
    aoMover: (evento: PointerEvent<SVGSVGElement>): boolean => {
      if (!dedos.current.has(evento.pointerId)) return false;
      // O botão solto fora do mapa, antes de o arraste começar, não chega como pointerup.
      if (evento.pointerType === "mouse" && evento.buttons === 0) {
        dedos.current.delete(evento.pointerId);
        arraste.current = null;
        return false;
      }
      const posicao = posicaoNoQuadro(evento);
      dedos.current.set(evento.pointerId, posicao);
      if (pinca.current && dedos.current.size >= 2) {
        const [a, b] = [...dedos.current.values()] as [Posicao, Posicao];
        const { distancia: antes, meio: meioAntes, vista: vistaAntes } = pinca.current;
        const aproximada = vistaDaCaixa(aproximar(vistaAntes, antes / Math.max(1, distancia(a, b)), meioAntes, quadro, limites));
        const meioAgora = meio(a, b);
        mudar(arrastar(aproximada, [meioAgora[0] - meioAntes[0], meioAgora[1] - meioAntes[1]], quadro), false);
        isCliqueDoArraste.current = true;
        return true;
      }
      const emCurso = arraste.current;
      if (!emCurso) return false;
      const deslocamento: Posicao = [posicao[0] - emCurso.inicio[0], posicao[1] - emCurso.inicio[1]];
      if (!emCurso.isMovendo && Math.hypot(...deslocamento) < PX_DO_ARRASTE) return false;
      if (!emCurso.isMovendo) {
        // Só agora o mapa segura o ponteiro: o clique simples continua achando o município ou o cliente.
        evento.currentTarget.setPointerCapture(evento.pointerId);
        emCurso.isMovendo = true;
        isCliqueDoArraste.current = true;
      }
      mudar(arrastar(emCurso.vista, deslocamento, quadro), false);
      return true;
    },
    aoSoltar: (evento: PointerEvent<SVGSVGElement>) => {
      dedos.current.delete(evento.pointerId);
      if (dedos.current.size < 2) pinca.current = null;
      if (dedos.current.size === 0) arraste.current = null;
    },
    /** O clique que termina um arraste não escolhe nada. */
    isCliqueDoArraste: () => {
      const era = isCliqueDoArraste.current;
      isCliqueDoArraste.current = false;
      return era;
    },
  };
}

/** A caixa crescida para a proporção do quadro, com o centro no mesmo lugar: o mapa enche o quadro todo. */
export function ajustarAoQuadro([x0, y0, x1, y1]: Caixa, largura: number, altura: number): Vista {
  const larguraDaCaixa = Math.max(1, x1 - x0);
  const alturaDaCaixa = Math.max(1, y1 - y0);
  const proporcao = largura > 0 && altura > 0 ? largura / altura : larguraDaCaixa / alturaDaCaixa;
  const larguraFinal = Math.max(larguraDaCaixa, alturaDaCaixa * proporcao);
  const alturaFinal = larguraFinal / proporcao;
  return { x: (x0 + x1) / 2 - larguraFinal / 2, y: (y0 + y1) / 2 - alturaFinal / 2, largura: larguraFinal, altura: alturaFinal };
}

function isMesmaCaixa(a: Caixa, b: Caixa): boolean {
  return a.every((valor, i) => valor === b[i]);
}

function distancia([ax, ay]: Posicao, [bx, by]: Posicao): number {
  return Math.hypot(bx - ax, by - ay);
}

function meio([ax, ay]: Posicao, [bx, by]: Posicao): Posicao {
  return [(ax + bx) / 2, (ay + by) / 2];
}
