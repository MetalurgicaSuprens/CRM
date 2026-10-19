import type { Caixa } from "dominio/mapa";
import type { Vista } from "./nomesNoMapa";

/*
 * As contas do zoom e do arraste do mapa, na unidade do mapa (décimos de km). A vista é a parte do
 * mapa no quadro; o ponto e o deslocamento vêm em px do quadro, que é onde o mouse e o dedo estão.
 */

export type Quadro = { largura: number; altura: number };

/** Até onde o zoom vai: a largura da vista, na unidade do mapa. */
export type Limites = { larguraMinima: number; larguraMaxima: number };

/**
 * A caixa depois de aproximar (fator < 1) ou afastar (fator > 1) em volta do ponto do quadro: o que
 * está sob o ponto continua sob ele, como no Google Maps.
 */
export function aproximar(vista: Vista, fator: number, [px, py]: readonly [number, number], quadro: Quadro, limites: Limites): Caixa {
  const larguraNova = Math.min(limites.larguraMaxima, Math.max(limites.larguraMinima, vista.largura * fator));
  const k = larguraNova / vista.largura;
  const sobX = vista.x + (px / quadro.largura) * vista.largura;
  const sobY = vista.y + (py / quadro.altura) * vista.altura;
  const x = sobX - (sobX - vista.x) * k;
  const y = sobY - (sobY - vista.y) * k;
  return [x, y, x + vista.largura * k, y + vista.altura * k];
}

/** A caixa depois de arrastar o mapa `dx` e `dy` px: o mapa vai junto com o dedo. */
export function arrastar(vista: Vista, [dx, dy]: readonly [number, number], quadro: Quadro): Caixa {
  const unidadesPorPx = vista.largura / quadro.largura;
  const x = vista.x - dx * unidadesPorPx;
  const y = vista.y - dy * unidadesPorPx;
  return [x, y, x + vista.largura, y + vista.altura];
}

export function vistaDaCaixa([x0, y0, x1, y1]: Caixa): Vista {
  return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 };
}
