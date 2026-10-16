import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { UserPlus } from "lucide-react";
import botoes from "../../componentes/Botao.module.css";
import { CabecalhoPagina } from "../../componentes/CabecalhoPagina";
import { Cartao } from "../../componentes/Cartao";
import { Voltar } from "../../componentes/Voltar";
import { useCarga } from "../../dados/useCarga";
import { Carregando } from "../../paginas/Carregando";
import { ConviteParaEnviar } from "../componentes/ConviteParaEnviar";
import { EscolhaDeCodigos } from "../componentes/EscolhaDeCodigos";
import { Mensagem } from "../componentes/Mensagem";
import { carregarRepresentantes, criarLogin } from "../api";
import estilos from "../admin.module.css";
import type { ConviteGerado } from "../tipos";

/*
 * O login de uma representação: o nome e os códigos dela no ERP, da lista de autorizados da foto. O
 * convite sai na hora, para copiar e mandar ao representante.
 */

const TAMANHO_DO_NOME = 80;

export function NovoLogin() {
  const [convite, setConvite] = useState<ConviteGerado | null>(null);
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        antes={<Voltar para="/" rotulo="Logins" />}
        titulo="Novo login"
        descricao="Um login por representação, com os códigos dela no ERP. O convite sai na hora."
      />
      {convite ? <LoginCriado convite={convite} aoCriarOutro={() => setConvite(null)} /> : <Formulario aoCriar={setConvite} />}
    </div>
  );
}

function Formulario({ aoCriar }: { aoCriar: (convite: ConviteGerado) => void }) {
  const { dados: representantes, erro: erroDaLista } = useCarga("admin:representantes", carregarRepresentantes);
  const [nome, setNome] = useState("");
  const [codigos, setCodigos] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (erroDaLista) return <Mensagem recado={{ tom: "erro", texto: erroDaLista.message }} />;
  if (!representantes) return <Carregando />;

  const pronto = nome.trim() !== "" && codigos.size > 0;
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!pronto || enviando) return;
    setEnviando(true);
    setErro(null);
    criarLogin({ nome: nome.trim(), codigos: [...codigos] }).then(aoCriar, (falha: Error) => {
      setErro(falha.message);
      setEnviando(false);
    });
  };

  return (
    <Cartao titulo="Dados do login" icone={UserPlus}>
      <form className={estilos.formulario} onSubmit={enviar}>
        <label className={estilos.campo}>
          <span className={estilos.rotulo}>Nome</span>
          <input className={estilos.entrada} value={nome} onChange={(evento) => setNome(evento.target.value)} maxLength={TAMANHO_DO_NOME} placeholder="Ex.: Star Vendas" autoComplete="off" />
          <span className={estilos.ajuda}>O nome da representação, como ela aparece no CRM e no aparelho, ao lado da chave.</span>
        </label>
        <fieldset className={estilos.campo}>
          <legend className={estilos.rotulo}>Códigos de representante</legend>
          <span className={estilos.ajuda}>O login vê a carteira e os pedidos de todos os códigos marcados, somados. Cada código fica em um login só.</span>
          <EscolhaDeCodigos representantes={representantes} escolhidos={codigos} aoMudar={setCodigos} doLogin={null} />
        </fieldset>
        {erro ? <Mensagem recado={{ tom: "erro", texto: erro }} /> : null}
        <div className={estilos.botoes}>
          <button type="submit" className={`${botoes.primario} ${botoes.aguardando}`} disabled={!pronto || enviando}>
            {enviando ? "Criando…" : "Criar o login e gerar o convite"}
          </button>
        </div>
      </form>
    </Cartao>
  );
}

function LoginCriado({ convite, aoCriarOutro }: { convite: ConviteGerado; aoCriarOutro: () => void }) {
  return (
    <>
      <Mensagem recado={{ tom: "sucesso", texto: `Login ${convite.nome} criado. Agora mande o convite.` }} />
      <ConviteParaEnviar convite={convite} />
      <div className={estilos.botoes}>
        <Link to={`/logins/${convite.idDoLogin}`} className={botoes.secundario}>
          Ver o login
        </Link>
        <button type="button" className={botoes.secundario} onClick={aoCriarOutro}>
          Criar outro login
        </button>
      </div>
    </>
  );
}
