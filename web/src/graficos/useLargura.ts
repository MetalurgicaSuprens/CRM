import { useLayoutEffect, useRef, useState } from "react";

/**
 * Largura do conteúdo do elemento, em px, acompanhando cada mudança de tamanho. A primeira medida
 * sai antes da pintura: o gráfico já nasce no tamanho certo, e a tabela, já como tabela ou cartões.
 */
export function useLargura<T extends HTMLElement>() {
  const referencia = useRef<T>(null);
  const [largura, setLargura] = useState(0);

  useLayoutEffect(() => {
    const elemento = referencia.current;
    if (!elemento) return;
    setLargura(larguraDoConteudo(elemento));
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setLargura(Math.floor(entrada.contentRect.width));
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return { referencia, largura };
}

/** A mesma medida do ResizeObserver (contentRect): sem bordas, sem barra de rolagem e sem recuos. */
function larguraDoConteudo(elemento: HTMLElement): number {
  const estilo = getComputedStyle(elemento);
  return Math.floor(elemento.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight));
}
