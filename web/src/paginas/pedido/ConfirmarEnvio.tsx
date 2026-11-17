import { useEffect, useRef, useState, type ReactNode } from "react";
import { KeyRound, TriangleAlert } from "lucide-react";
import botoes from "../../componentes/Botao.module.css";
import estilos from "./ConfirmarEnvio.module.css";

/** Tempo que o protótipo finge esperar o aparelho liberar a chave. */
const ESPERA_SIMULADA_MS = 1_200;

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: () => Promise<void>;
  resumo: ReactNode;
  /** O pedido já enviado hoje para o mesmo cliente: o SGI recusa outro em menos de 4 minutos. */
  aviso: string | null;
};

/** Confirmação do envio: na F5, pede a digital ou o PIN de novo, ligado ao conteúdo do pedido. */
export function ConfirmarEnvio({ aberto, aoFechar, aoConfirmar, resumo, aviso }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [aguardando, setAguardando] = useState(false);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto && !elemento.open) elemento.showModal();
    if (!aberto && elemento.open) elemento.close();
    if (!aberto) setAguardando(false);
  }, [aberto]);

  useEffect(() => {
    if (!aguardando) return;
    const espera = window.setTimeout(() => void aoConfirmar(), ESPERA_SIMULADA_MS);
    return () => window.clearTimeout(espera);
  }, [aguardando, aoConfirmar]);

  return (
    <dialog ref={dialogo} className={estilos.dialogo} onClose={aoFechar} aria-labelledby="titulo-do-envio">
      <h2 id="titulo-do-envio" className={estilos.titulo}>
        Enviar o pedido?
      </h2>
      {aviso ? (
        <p className={estilos.aviso} role="status">
          <TriangleAlert size={16} aria-hidden="true" />
          {aviso}
        </p>
      ) : null}
      {resumo}
      <p className={estilos.texto}>O pedido entra bloqueado no SGI e passa pelas aprovações de sempre. Depois de enviado, não dá para alterar pelo CRM.</p>
      <div className={estilos.acoes}>
        <button type="button" className={botoes.secundario} onClick={aoFechar} disabled={aguardando}>
          Voltar
        </button>
        <button type="button" className={`${botoes.primario} ${botoes.positivo} ${botoes.aguardando}`} onClick={() => setAguardando(true)} disabled={aguardando}>
          <KeyRound size={18} aria-hidden="true" />
          {aguardando ? "Confirme no seu aparelho…" : "Confirmar com chave de acesso"}
        </button>
      </div>
      <p className={estilos.suave}>Protótipo: a confirmação é simulada.</p>
    </dialog>
  );
}
