import estilos from "./Segmentos.module.css";

export type Segmento<T extends string> = { valor: T; rotulo: string; contagem?: number };

type Props<T extends string> = {
  /** Nome do grupo para leitores de tela. */
  rotulo: string;
  opcoes: readonly Segmento<T>[];
  selecionado: T;
  aoEscolher: (valor: T) => void;
  className?: string;
};

/** Botões lado a lado para escolher uma opção; no celular, rolam para o lado. */
export function Segmentos<T extends string>({ rotulo, opcoes, selecionado, aoEscolher, className }: Props<T>) {
  return (
    <div className={className ? `${estilos.segmentos} ${className}` : estilos.segmentos} role="group" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          className={estilos.segmento}
          aria-pressed={opcao.valor === selecionado}
          onClick={() => aoEscolher(opcao.valor)}
        >
          {opcao.rotulo}
          {opcao.contagem === undefined ? null : <span className={estilos.contagem}>{opcao.contagem}</span>}
        </button>
      ))}
    </div>
  );
}
