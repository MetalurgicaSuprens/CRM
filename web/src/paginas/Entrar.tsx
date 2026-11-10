import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Info, KeyRound, LogIn, TriangleAlert } from "lucide-react";
import { useArea } from "../acesso/area";
import { entrarComSenha, login } from "../acesso/login";
import { isRedeInterna } from "../dados/api";
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

  const entrarCom = (entrada: () => Promise<void>) => {
    setAguardando(true);
    setErro(null);
    entrada().then(
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
      {isRedeInterna ? (
        <EntradaPorSenha aguardando={aguardando} aoEntrar={(senha) => entrarCom(() => entrarComSenha(senha))} />
      ) : (
        <EntradaPorChave aguardando={aguardando} aoEntrar={() => entrarCom(login.entrar)} />
      )}
    </TelaDeAcesso>
  );
}

type PropsDaEntrada = { aguardando: boolean; aoEntrar: () => void };

function EntradaPorChave({ aguardando, aoEntrar }: PropsDaEntrada) {
  const area = useArea();
  return (
    <>
      <p className={estilos.texto}>
        Use a chave de acesso guardada neste aparelho. Ela é liberada com a digital, o rosto ou o PIN que você já usa para
        desbloquear o celular ou o computador.
      </p>
      <button type="button" className={`${botoes.primario} ${botoes.aguardando} ${estilos.largo}`} onClick={aoEntrar} disabled={aguardando}>
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
    </>
  );
}

/**
 * O teste na rede interna é por http, onde o navegador não libera a chave de acesso: entra-se com a
 * senha provisória (server/src/login/loginProvisorio.ts).
 */
function EntradaPorSenha({ aguardando, aoEntrar }: { aguardando: boolean; aoEntrar: (senha: string) => void }) {
  const [senha, setSenha] = useState("");
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (senha) aoEntrar(senha);
  };
  return (
    <form className={estilos.passos} onSubmit={enviar}>
      <p className={estilos.texto}>Teste na rede interna, com os dados reais do ERP. Entre com a senha provisória.</p>
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Senha</span>
        <input
          className={estilos.entrada}
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={64}
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
        />
      </label>
      <button type="submit" className={`${botoes.primario} ${botoes.aguardando} ${estilos.largo}`} disabled={aguardando || !senha}>
        <LogIn size={20} aria-hidden="true" />
        {aguardando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
