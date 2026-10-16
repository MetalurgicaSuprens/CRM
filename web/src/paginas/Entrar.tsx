import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Info, KeyRound, TriangleAlert } from "lucide-react";
import { useArea } from "../acesso/area";
import { login } from "../acesso/login";
import botoes from "../componentes/Botao.module.css";
import { TelaDeAcesso } from "../componentes/TelaDeAcesso";
import estilos from "./Acesso.module.css";

/** Por que o representante voltou para a entrada (?motivo=..., o motivo que o servidor deu ao fim da sessão). */
const MOTIVOS: Record<string, string> = {
  saiu: "Você saiu do CRM.",
  inatividade: "Sua sessão terminou depois de 60 minutos sem uso. Entre de novo.",
  limite: "Sua sessão chegou ao limite de 12 horas. Entre de novo.",
  revogada: "Seu acesso foi encerrado pelo administrador do CRM. Se precisar, peça um novo convite.",
  encerrada: "O administrador do CRM encerrou a sua sessão. Entre de novo com a sua chave.",
};

export function Entrar() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const [aguardando, setAguardando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const area = useArea();
  const motivo = MOTIVOS[parametros.get("motivo") ?? ""];

  const entrar = () => {
    setAguardando(true);
    setErro(null);
    login.entrar().then(
      () => navegar("/", { replace: true }),
      (falha: Error) => {
        setErro(falha.message);
        setAguardando(false);
      },
    );
  };

  return (
    <TelaDeAcesso titulo={`Entrar ${area.noSite}`}>
      {motivo && !erro ? (
        <p className={estilos.aviso} role="status">
          <Info size={16} aria-hidden="true" />
          {motivo}
        </p>
      ) : null}
      {erro ? (
        <p className={`${estilos.aviso} ${estilos.alerta}`} role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          {erro}
        </p>
      ) : null}
      <p className={estilos.texto}>
        Use a chave de acesso guardada neste aparelho. Ela é liberada com a digital, o rosto ou o PIN que você já usa para
        desbloquear o celular ou o computador.
      </p>
      <button type="button" className={`${botoes.primario} ${botoes.aguardando} ${estilos.largo}`} onClick={entrar} disabled={aguardando}>
        <KeyRound size={20} aria-hidden="true" />
        {aguardando ? "Confirme no seu aparelho…" : "Entrar com chave de acesso"}
      </button>
      <details className={estilos.ajuda}>
        <summary>Precisa de ajuda?</summary>
        <ul>
          <li>
            <strong>Primeiro acesso:</strong> {area.ajudaDoPrimeiroAcesso}
          </li>
          <li>
            <strong>Notebook sem leitor de digital:</strong> use o PIN do Windows ou escolha "usar outro aparelho" e leia o QR
            code com o celular.
          </li>
          <li>
            <strong>Trocou de aparelho ou perdeu o acesso:</strong> {area.ajudaDoAcessoPerdido}
          </li>
        </ul>
      </details>
    </TelaDeAcesso>
  );
}
