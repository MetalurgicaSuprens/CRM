import { useState } from "react";
import { Link, useLocation } from "react-router";
import { CircleCheck, Copy, Fingerprint, KeyRound, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { login, type ConsultaDoConvite } from "../acesso/login";
import { abertoEmNavegadorDeAplicativo } from "../acesso/navegador";
import botoes from "../componentes/Botao.module.css";
import { TelaDeAcesso } from "../componentes/TelaDeAcesso";
import { useCarga } from "../dados/useCarga";
import estilos from "./Acesso.module.css";

type ConviteIndisponivel = Exclude<ConsultaDoConvite["estado"], "valido">;

/**
 * O convite do admin. O token vem depois do "#", para não aparecer em log de servidor, e só é usado
 * quando a chave é criada: a prévia do link no WhatsApp abre esta página sem gastar o convite.
 */
export function Convite() {
  const token = useLocation().hash.replace(/^#/, "");
  const { dados: consulta, erro } = useCarga(`convite:${token}`, () => login.consultarConvite(token));
  if (erro) return <AvisoDoConvite titulo="Convite" texto={erro.message} />;
  if (!consulta) {
    return (
      <TelaDeAcesso titulo="Convite">
        <p className={estilos.texto}>Conferindo o convite…</p>
      </TelaDeAcesso>
    );
  }
  if (consulta.estado !== "valido") return <AvisoDoConvite {...INDISPONIVEL[consulta.estado]} />;
  return <CriarChave token={token} nome={consulta.nome} validoAte={consulta.validoAte} />;
}

function CriarChave({ token, nome, validoAte }: { token: string; nome: string; validoAte: string }) {
  const [etapa, setEtapa] = useState<"inicio" | "criando" | "pronta">("inicio");
  const [erro, setErro] = useState<string | null>(null);
  const [noAplicativo] = useState(() => abertoEmNavegadorDeAplicativo(navigator.userAgent));

  const criar = () => {
    setEtapa("criando");
    setErro(null);
    login.criarChaveDoConvite(token).then(
      () => setEtapa("pronta"),
      (falha: Error) => {
        setErro(falha.message);
        setEtapa("inicio");
      },
    );
  };

  if (etapa === "pronta") return <ChaveCriada />;
  return (
    <TelaDeAcesso titulo="Crie sua chave de acesso">
      {noAplicativo ? <AvisoDeAplicativo /> : null}
      {erro ? (
        <p className={`${estilos.aviso} ${estilos.alerta}`} role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          {erro}
        </p>
      ) : null}
      <p className={estilos.saudacao}>Olá, {nome}</p>
      <p className={estilos.texto}>
        Você foi convidado para o CRM dos representantes da Suprens. Para entrar, não vai precisar de senha: basta criar uma chave
        de acesso neste aparelho.
      </p>
      <ul className={estilos.passos}>
        <li className={estilos.passo}>
          <Fingerprint size={18} aria-hidden="true" />
          Ela é liberada com a digital, o rosto ou o PIN que você já usa para desbloquear o celular ou o computador.
        </li>
        <li className={estilos.passo}>
          <Smartphone size={18} aria-hidden="true" />
          Fica guardada no aparelho, ou no Google, na Apple ou no Windows, se você usa a sincronização deles.
        </li>
        <li className={estilos.passo}>
          <ShieldCheck size={18} aria-hidden="true" />
          Ninguém usa a sua chave sem o seu aparelho desbloqueado.
        </li>
      </ul>
      <button type="button" className={`${botoes.primario} ${botoes.aguardando} ${estilos.largo}`} onClick={criar} disabled={etapa === "criando"}>
        <KeyRound size={20} aria-hidden="true" />
        {etapa === "criando" ? "Confirme no seu aparelho…" : "Criar chave de acesso"}
      </button>
      <p className={estilos.validade}>Este convite vale até {formatarValidade(validoAte)} e só pode ser usado uma vez.</p>
    </TelaDeAcesso>
  );
}

function AvisoDeAplicativo() {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    navigator.clipboard.writeText(window.location.href).then(
      () => setCopiado(true),
      () => setCopiado(false),
    );
  };
  return (
    <div className={`${estilos.aviso} ${estilos.alerta}`} role="alert">
      <TriangleAlert size={16} aria-hidden="true" />
      <div className={estilos.passos}>
        <p>Este link abriu dentro de um aplicativo, como o WhatsApp. A chave de acesso pode não funcionar aqui.</p>
        <p>
          Toque nos três pontinhos e escolha <strong>Abrir no Chrome</strong> ou <strong>Abrir no Safari</strong>, ou copie o
          link e cole no navegador.
        </p>
        <button type="button" className={`${botoes.secundario} ${estilos.copiar}`} onClick={copiar}>
          <Copy size={14} aria-hidden="true" />
          {copiado ? "Link copiado" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}

function ChaveCriada() {
  return (
    <TelaDeAcesso titulo="Chave criada">
      <p className={`${estilos.aviso} ${estilos.sucesso}`} role="status">
        <CircleCheck size={16} aria-hidden="true" />
        Pronto! Sua chave de acesso foi guardada neste aparelho, e o convite não vale mais.
      </p>
      <p className={estilos.texto}>
        Da próxima vez, é só abrir o CRM e tocar em <strong>Entrar com chave de acesso</strong>.
      </p>
      <p className={estilos.texto}>
        Vai usar o CRM também no computador? Na tela de entrada dele, escolha "usar outro aparelho" e leia o QR code com este
        celular.
      </p>
      <Link to="/" className={`${botoes.primario} ${estilos.largo}`}>
        Ir para o CRM
      </Link>
    </TelaDeAcesso>
  );
}

const INDISPONIVEL: Record<ConviteIndisponivel, { titulo: string; texto: string }> = {
  expirado: {
    titulo: "Convite expirado",
    texto: "Este convite passou do prazo. Peça um novo ao administrador do CRM.",
  },
  usado: {
    titulo: "Convite já usado",
    texto:
      "Este convite já criou uma chave de acesso e não vale mais. Se foi você, entre pela tela de entrada. Se não foi, avise o administrador do CRM agora.",
  },
  trocado: {
    titulo: "Convite trocado",
    texto: "O administrador mandou um convite mais novo, e só o último link vale. Use o último que você recebeu.",
  },
  invalido: {
    titulo: "Link incompleto",
    texto: "Abra o link do convite exatamente como você recebeu, sem cortar nenhuma parte. Se não der certo, peça um novo ao administrador do CRM.",
  },
};

function AvisoDoConvite({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <TelaDeAcesso titulo={titulo}>
      <p className={`${estilos.aviso} ${estilos.alerta}`} role="alert">
        <TriangleAlert size={16} aria-hidden="true" />
        {texto}
      </p>
      <Link to="/entrar" className={`${botoes.primario} ${estilos.largo}`}>
        Ir para a entrada
      </Link>
    </TelaDeAcesso>
  );
}

function formatarValidade(momentoIso: string): string {
  const data = new Date(momentoIso);
  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(data);
  const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(data);
  return `${dia} às ${hora}`;
}
