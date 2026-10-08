import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import estilos from "./TelaDeAcesso.module.css";

/** Moldura das telas de entrada e de convite, fora do menu do CRM. */
export function TelaDeAcesso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={estilos.tela}>
      <main className={estilos.coluna}>
        <div className={estilos.marca}>
          <img src="/marca/suprens-96.png" alt="Suprens" width={44} height={42} />
          <span className={estilos.produto}>CRM</span>
        </div>
        <section className={estilos.cartao} aria-labelledby="titulo-acesso">
          <h1 id="titulo-acesso" className={estilos.titulo}>
            {titulo}
          </h1>
          {children}
        </section>
        <p className={estilos.rodape}>
          <ShieldCheck size={14} aria-hidden="true" />
          Os acessos ao CRM são registrados.
        </p>
        <p className={estilos.prototipo}>Protótipo: os botões só simulam a chave de acesso. A de verdade chega com o login (F3).</p>
      </main>
    </div>
  );
}
