import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { CircleCheck, Copy, Fingerprint, KeyRound, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { abertoEmNavegadorDeAplicativo } from "../acesso/navegador";
import { TelaDeAcesso } from "../componentes/TelaDeAcesso";
import { carregarSituacaoDosDados } from "../dados/api";
import { useCarga } from "../dados/useCarga";
import estilos from "./Acesso.module.css";

type EstadoDoConvite = "valido" | "expirado" | "usado" | "incompleto";

/** Tempo que o protótipo finge esperar o aparelho criar a chave. */
const ESPERA_SIMULADA_MS = 1_400;
const VALIDADE_DO_CONVITE_MS = 48 * 60 * 60 * 1_000;

/**
 * O token vem depois do "#", para não aparecer em log de servidor. No protótipo, o próprio token
 * escolhe o estado: #expirado, #usado ou qualquer outro (válido).
 */
export function Convite() {
  const { hash } = useLocation();
  const estado = lerEstado(hash);
  return estado === "valido" ? <CriarChave /> : <ConviteIndisponivel estado={estado} />;
}

function CriarChave() {
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const [etapa, setEtapa] = useState<"inicio" | "criando" | "pronta">("inicio");
  const [noAplicativo] = useState(() => abertoEmNavegadorDeAplicativo(navigator.userAgent));
  const [validade] = useState(() => formatarValidade(new Date(Date.now() + VALIDADE_DO_CONVITE_MS)));

  useEffect(() => {
    if (etapa !== "criando") return;
    const espera = window.setTimeout(() => setEtapa("pronta"), ESPERA_SIMULADA_MS);
    return () => window.clearTimeout(espera);
  }, [etapa]);

  if (etapa === "pronta") return <ChaveCriada />;
  return (
    <TelaDeAcesso titulo="Crie sua chave de acesso">
      {noAplicativo ? <AvisoDeAplicativo /> : null}
      {situacao ? <p className={estilos.saudacao}>Olá, {situacao.representante.nome}</p> : null}
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
      <button type="button" className={estilos.botao} onClick={() => setEtapa("criando")} disabled={etapa === "criando"}>
        <KeyRound size={20} aria-hidden="true" />
        {etapa === "criando" ? "Confirme no seu aparelho…" : "Criar chave de acesso"}
      </button>
      <p className={estilos.validade}>Este convite vale até {validade} e só pode ser usado uma vez.</p>
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
        <button type="button" className={estilos.copiar} onClick={copiar}>
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
      <Link to="/" className={estilos.botao}>
        Ir para o CRM
      </Link>
    </TelaDeAcesso>
  );
}

const INDISPONIVEL: Record<Exclude<EstadoDoConvite, "valido">, { titulo: string; texto: string }> = {
  expirado: {
    titulo: "Convite expirado",
    texto: "Este convite passou do prazo de 48 horas. Peça um novo ao administrador do CRM.",
  },
  usado: {
    titulo: "Convite já usado",
    texto:
      "Este convite já criou uma chave de acesso e não vale mais. Se foi você, entre pela tela de entrada. Se não foi, avise o administrador do CRM agora.",
  },
  incompleto: {
    titulo: "Link incompleto",
    texto: "Abra o link do convite exatamente como você recebeu, sem cortar nenhuma parte.",
  },
};

function ConviteIndisponivel({ estado }: { estado: Exclude<EstadoDoConvite, "valido"> }) {
  const { titulo, texto } = INDISPONIVEL[estado];
  return (
    <TelaDeAcesso titulo={titulo}>
      <p className={`${estilos.aviso} ${estilos.alerta}`} role="alert">
        <TriangleAlert size={16} aria-hidden="true" />
        {texto}
      </p>
      <Link to="/entrar" className={estilos.botao}>
        Ir para a entrada
      </Link>
    </TelaDeAcesso>
  );
}

function lerEstado(fragmento: string): EstadoDoConvite {
  const token = fragmento.replace(/^#/, "");
  if (!token) return "incompleto";
  if (token === "expirado" || token === "usado") return token;
  return "valido";
}

function formatarValidade(data: Date): string {
  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(data);
  const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(data);
  return `${dia} às ${hora}`;
}
