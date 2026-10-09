import { Search } from "lucide-react";
import estilos from "./CampoDeBusca.module.css";

type Props = {
  /** Nome do campo para leitores de tela. */
  rotulo: string;
  valor: string;
  /** Texto de exemplo dentro do campo vazio. */
  dica: string;
  aoMudar: (valor: string) => void;
  focarAoAbrir?: boolean;
  /** Para a página ajustar a largura. */
  className?: string;
};

/** Caixa de busca com a lupa. O contorno de foco é da caixa toda, e não do campo de dentro. */
export function CampoDeBusca({ rotulo, valor, dica, aoMudar, focarAoAbrir = false, className }: Props) {
  return (
    <label className={className ? `${estilos.busca} ${className}` : estilos.busca}>
      <Search size={16} aria-hidden="true" />
      <span className="visualmente-oculto">{rotulo}</span>
      <input type="search" value={valor} placeholder={dica} autoFocus={focarAoAbrir} onChange={(evento) => aoMudar(evento.target.value)} />
    </label>
  );
}
