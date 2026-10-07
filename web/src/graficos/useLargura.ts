import { useEffect, useRef, useState } from "react";

/** Largura atual do elemento, para desenhar o SVG em pixels reais e não esticar o texto. */
export function useLargura<T extends HTMLElement>() {
  const referencia = useRef<T>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const elemento = referencia.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setLargura(Math.floor(entrada.contentRect.width));
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return { referencia, largura };
}
