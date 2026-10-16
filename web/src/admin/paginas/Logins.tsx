import { Link, useSearchParams } from "react-router";
import { Clock, KeyRound, MonitorSmartphone, UserPlus, Users } from "lucide-react";
import botoes from "../../componentes/Botao.module.css";
import { CabecalhoPagina } from "../../componentes/CabecalhoPagina";
import { Cartao } from "../../componentes/Cartao";
import { Indicador } from "../../componentes/Indicador";
import { Segmentos, type Segmento } from "../../componentes/Segmentos";
import { Selo } from "../../componentes/Selo";
import { Identificacao, TabelaResponsiva } from "../../componentes/TabelaResponsiva";
import { useCarga } from "../../dados/useCarga";
import { Carregando } from "../../paginas/Carregando";
import { Mensagem } from "../componentes/Mensagem";
import { carregarLogins } from "../api";
import estilos from "../admin.module.css";
import { descreverCodigos, ESTADO_DO_CONVITE, formatarQuando, SITUACAO_DO_LOGIN } from "../rotulos";
import type { LoginNaGestao, SituacaoDoLogin } from "../tipos";

/*
 * A tela de entrada da administração: quem entra no CRM, com que códigos, com quais chaves, e o
 * que está pendente. Cada linha leva ao detalhe do login, onde ficam as ações.
 */

type Filtro = "em_uso" | SituacaoDoLogin;

const FILTROS: readonly { valor: Filtro; rotulo: string; vale: (login: LoginNaGestao) => boolean }[] = [
  { valor: "em_uso", rotulo: "Em uso", vale: (login) => login.situacao !== "desativado" },
  { valor: "ativo", rotulo: "Ativos", vale: (login) => login.situacao === "ativo" },
  { valor: "aguardando", rotulo: "Convite pendente", vale: (login) => login.situacao === "aguardando" },
  { valor: "sem_acesso", rotulo: "Sem acesso", vale: (login) => login.situacao === "sem_acesso" },
  { valor: "desativado", rotulo: "Desativados", vale: (login) => login.situacao === "desativado" },
];
const FILTRO_INICIAL: Filtro = "em_uso";

export function Logins() {
  const { dados: logins, erro } = useCarga("admin:logins", carregarLogins);
  const [parametros, setParametros] = useSearchParams();
  if (erro) return <Mensagem recado={{ tom: "erro", texto: erro.message }} />;
  if (!logins) return <Carregando />;

  const filtro = FILTROS.find(({ valor }) => valor === parametros.get("situacao")) ?? FILTROS[0];
  const escolher = (valor: Filtro) => setParametros(valor === FILTRO_INICIAL ? {} : { situacao: valor }, { replace: true });
  const opcoes: Segmento<Filtro>[] = FILTROS.map(({ valor, rotulo, vale }) => ({ valor, rotulo, contagem: logins.filter(vale).length }));

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        titulo="Logins"
        descricao="Quem entra no CRM, com que códigos de representante e com quais chaves de acesso"
        acoes={
          <Link to="/logins/novo" className={botoes.primario}>
            <UserPlus size={18} aria-hidden="true" />
            Novo login
          </Link>
        }
      />
      <Indicadores logins={logins} />
      <Cartao titulo="Logins" icone={Users}>
        <div className={estilos.filtroDaLista}>
          <Segmentos rotulo="Situação dos logins" opcoes={opcoes} selecionado={filtro?.valor ?? FILTRO_INICIAL} aoEscolher={escolher} />
        </div>
        <TabelaResponsiva
          descricao="Logins do CRM"
          itens={logins.filter(filtro?.vale ?? (() => true))}
          chaveDe={(login) => login.id}
          linkDe={(login) => `/logins/${login.id}`}
          vazio="Nenhum login nesta situação."
          ordemInicial={{ coluna: "Login", sentido: "crescente" }}
          colunas={[
            {
              titulo: "Login",
              largura: 14,
              ordenarPor: (login) => login.nome,
              celula: (login) => <Identificacao titulo={login.nome} detalhe={login.papel === "admin" ? "Administrador" : descreverCodigos(login.codigos)} />,
            },
            {
              titulo: "Situação",
              largura: 10,
              ordenarPor: (login) => SITUACAO_DO_LOGIN[login.situacao].rotulo,
              celula: (login) => <Selo {...SITUACAO_DO_LOGIN[login.situacao]} />,
            },
            {
              titulo: "Chaves",
              largura: 9,
              ordenarPor: (login) => login.chavesAtivas,
              numerica: true,
              celula: (login) => (login.chavesAtivas > 0 ? `${login.chavesAtivas} · ${login.provedores.join(", ")}` : "—"),
            },
            {
              titulo: "Último acesso",
              largura: 8,
              ordenarPor: (login) => login.ultimaEntrada,
              celula: (login) => (login.ultimaEntrada ? formatarQuando(login.ultimaEntrada) : "nunca"),
            },
            { titulo: "Convite", largura: 10, celula: (login) => descreverConvite(login) },
          ]}
        />
      </Cartao>
    </div>
  );
}

function Indicadores({ logins }: { logins: readonly LoginNaGestao[] }) {
  const emUso = logins.filter((login) => login.situacao !== "desativado");
  const contar = (situacao: SituacaoDoLogin) => emUso.filter((login) => login.situacao === situacao).length;
  const somar = (valor: (login: LoginNaGestao) => number) => emUso.reduce((soma, login) => soma + valor(login), 0);
  return (
    <div className={estilos.indicadores}>
      <Indicador destaque rotulo="Logins ativos" icone={Users} valor={contar("ativo")} detalhe="com chave de acesso que vale" />
      <Indicador rotulo="Convites pendentes" icone={Clock} valor={contar("aguardando")} detalhe="esperando a chave ser criada" />
      <Indicador rotulo="Chaves ativas" icone={KeyRound} valor={somar((login) => login.chavesAtivas)} detalhe={`${contar("sem_acesso")} login(s) sem acesso`} />
      <Indicador rotulo="Sessões abertas" icone={MonitorSmartphone} valor={somar((login) => login.sessoesAbertas)} detalhe="agora, em todos os aparelhos" />
    </div>
  );
}

/** O último convite do login: até quando vale, quando foi usado ou que deixou de valer. */
function descreverConvite({ ultimoConvite }: LoginNaGestao): string {
  if (!ultimoConvite) return "—";
  if (ultimoConvite.estado === "valendo") return `vale até ${formatarQuando(ultimoConvite.validoAte)}`;
  if (ultimoConvite.estado === "usado" && ultimoConvite.usadoEm) return `usado ${formatarQuando(ultimoConvite.usadoEm)}`;
  return ESTADO_DO_CONVITE[ultimoConvite.estado].rotulo.toLowerCase();
}
