import { formatarData, formatarMomento, formatarPrazo, formatarTempoDesde } from "../formato";
import estilos from "./Quando.module.css";

/** Data em linguagem de conversa ("há 5 meses", "em 12 dias") e, embaixo, a data exata. */
export function DataRelativa({ data, hoje }: { data: string | null; hoje: string }) {
  if (!data) return <>—</>;
  return (
    <>
      <span>{data > hoje ? formatarPrazo(data, hoje) : formatarTempoDesde(data, hoje)}</span>
      <span className={estilos.exata}>{formatarData(data)}</span>
    </>
  );
}

/** Data e hora em relação a hoje: "hoje, 16:42", "07/10 às 15:10". */
export function MomentoRelativo({ momento, hoje }: { momento: string; hoje: string }) {
  return <span>{formatarMomento(momento, hoje)}</span>;
}
