import type { ReactNode } from "react";
import moldura from "./moldura.module.css";

/*
 * A linha acima do desenho, que mostra o mês apontado no lugar de um cartão por cima do gráfico (a
 * escolha do Lucas em 2026-11-18): o cartão escondia a linha e as barras justamente onde se olhava.
 * Sem mês apontado, ela mostra o resumo de quem usa o gráfico ou, sem resumo, como ver cada mês, para
 * a linha nunca sumir e o desenho não pular quando o mouse entra.
 */

export function LeituraDoGrafico({ leitura, resumo }: { leitura: ReactNode | null; resumo: ReactNode | undefined }) {
  return (
    <p className={moldura.leitura} aria-live="polite">
      {leitura ?? resumo ?? <span className={moldura.convite}>Passe o mouse ou toque no gráfico para ver cada mês.</span>}
    </p>
  );
}

/** O nome do mês, em negrito, no começo da leitura: "Junho de 2026:". */
export function TituloDaLeitura({ children }: { children: ReactNode }) {
  return <span className={moldura.tituloDaLeitura}>{children}:</span>;
}

/** Um valor de comparação, mais apagado: "2025: R$ 96.000". */
export function ParteSecundaria({ children }: { children: ReactNode }) {
  return <span className={moldura.parteSecundaria}>{children}</span>;
}
