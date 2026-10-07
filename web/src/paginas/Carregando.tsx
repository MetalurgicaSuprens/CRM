import estilos from "./Carregando.module.css";

export function Carregando() {
  return (
    <p className={estilos.carregando} role="status">
      Carregando…
    </p>
  );
}
