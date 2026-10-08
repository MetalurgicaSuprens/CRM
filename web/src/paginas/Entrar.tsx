import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Info, KeyRound } from "lucide-react";
import { TelaDeAcesso } from "../componentes/TelaDeAcesso";
import estilos from "./Acesso.module.css";

/** Por que o representante voltou para a entrada (?motivo=...). */
const MOTIVOS: Record<string, string> = {
  saiu: "Você saiu do CRM.",
  inatividade: "Sua sessão terminou depois de 60 minutos sem uso. Entre de novo.",
  limite: "Sua sessão chegou ao limite de 12 horas. Entre de novo.",
};

/** Tempo que o protótipo finge esperar o aparelho liberar a chave. */
const ESPERA_SIMULADA_MS = 1_200;

export function Entrar() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const [aguardando, setAguardando] = useState(false);
  const motivo = MOTIVOS[parametros.get("motivo") ?? ""];

  useEffect(() => {
    if (!aguardando) return;
    const espera = window.setTimeout(() => navegar("/", { replace: true }), ESPERA_SIMULADA_MS);
    return () => window.clearTimeout(espera);
  }, [aguardando, navegar]);

  return (
    <TelaDeAcesso titulo="Entrar no CRM">
      {motivo ? (
        <p className={estilos.aviso} role="status">
          <Info size={16} aria-hidden="true" />
          {motivo}
        </p>
      ) : null}
      <p className={estilos.texto}>
        Use a chave de acesso guardada neste aparelho. Ela é liberada com a digital, o rosto ou o PIN que você já usa para
        desbloquear o celular ou o computador.
      </p>
      <button type="button" className={estilos.botao} onClick={() => setAguardando(true)} disabled={aguardando}>
        <KeyRound size={20} aria-hidden="true" />
        {aguardando ? "Confirme no seu aparelho…" : "Entrar com chave de acesso"}
      </button>
      <details className={estilos.ajuda}>
        <summary>Precisa de ajuda?</summary>
        <ul>
          <li>
            <strong>Primeiro acesso:</strong> abra o link do convite que você recebeu do administrador.
          </li>
          <li>
            <strong>Notebook sem leitor de digital:</strong> use o PIN do Windows ou escolha "usar outro aparelho" e leia o QR
            code com o celular.
          </li>
          <li>
            <strong>Trocou de celular ou perdeu o acesso:</strong> peça um novo convite ao administrador do CRM.
          </li>
        </ul>
      </details>
    </TelaDeAcesso>
  );
}
