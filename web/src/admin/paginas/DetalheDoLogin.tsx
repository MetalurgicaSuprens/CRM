import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { Hash, History, KeyRound, MailPlus, MonitorSmartphone, ShieldAlert, Wrench } from "lucide-react";
import botoes from "../../componentes/Botao.module.css";
import { CabecalhoPagina } from "../../componentes/CabecalhoPagina";
import { Cartao } from "../../componentes/Cartao";
import { Selo } from "../../componentes/Selo";
import { Identificacao, TabelaResponsiva } from "../../componentes/TabelaResponsiva";
import { Voltar } from "../../componentes/Voltar";
import { useCarga } from "../../dados/useCarga";
import { Carregando } from "../../paginas/Carregando";
import { ConviteParaEnviar } from "../componentes/ConviteParaEnviar";
import { EscolhaDeCodigos } from "../componentes/EscolhaDeCodigos";
import { Mensagem, type Recado } from "../componentes/Mensagem";
import { TabelaDoRegistro } from "../componentes/TabelaDoRegistro";
import {
  bloquearChave,
  bloquearChaves,
  carregarLogin,
  carregarRegistro,
  carregarRepresentantes,
  carregarSituacao,
  desativarLogin,
  encerrarSessoes,
  gerarConvite,
  trocarCodigos,
} from "../api";
import estilos from "../admin.module.css";
import { descreverCodigos, ESTADO_DO_CONVITE, formatarQuando, SITUACAO_DO_LOGIN, situacaoDaSessao } from "../rotulos";
import type { ConviteGerado, DetalheDoLogin as Detalhe } from "../tipos";

/*
 * Tudo de um login: as ações (convite novo, encerrar sessões, bloquear chaves, desativar), os
 * códigos, as chaves pelo provedor, os convites, as sessões e o registro dele. As ações que tiram o
 * acesso pedem confirmação; o admin não age no próprio login por aqui.
 */

export function DetalheDoLogin() {
  const { id = "" } = useParams();
  const { dados: login, erro, recarregar } = useCarga(`admin:login:${id}`, () => carregarLogin(id));
  const { dados: situacao } = useCarga("admin:situacao", carregarSituacao);
  const [convite, setConvite] = useState<ConviteGerado | null>(null);
  const [recado, setRecado] = useState<Recado | null>(null);
  /** Sobe a cada ação feita, para o registro do login ser buscado de novo. */
  const [acoesFeitas, setAcoesFeitas] = useState(0);

  if (erro) return <Mensagem recado={{ tom: "erro", texto: erro.message }} />;
  if (!login) return <Carregando />;

  /** Faz a ação, mostra o resultado e busca o login de novo. */
  const agir = (acao: () => Promise<string>) => {
    setRecado(null);
    acao().then(
      (texto) => {
        setRecado({ tom: "sucesso", texto });
        setAcoesFeitas((feitas) => feitas + 1);
        recarregar();
      },
      (falha: Error) => setRecado({ tom: "erro", texto: falha.message }),
    );
  };
  const isOProprio = situacao?.admin.id === login.id;

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        antes={<Voltar para="/" rotulo="Logins" />}
        titulo={login.nome}
        selo={<Selo {...SITUACAO_DO_LOGIN[login.situacao]} tamanho="grande" />}
        descricao={login.papel === "admin" ? "Administrador" : `Representação, login criado ${formatarQuando(login.criadoEm)}`}
      />
      {recado ? <Mensagem recado={recado} /> : null}
      {convite ? <ConviteParaEnviar convite={convite} /> : null}
      <div className={estilos.grade}>
        <Acoes
          login={login}
          isOProprio={isOProprio}
          agir={agir}
          aoGerarConvite={() =>
            agir(async () => {
              setConvite(await gerarConvite(login.id));
              return "Convite gerado. O anterior, se não foi usado, deixou de valer.";
            })
          }
        />
        {login.papel === "representante" ? <Codigos login={login} agir={agir} /> : null}
        <Chaves login={login} isOProprio={isOProprio} agir={agir} />
        <Convites login={login} />
        <Sessoes login={login} />
        <RegistroDoLogin id={login.id} versao={acoesFeitas} />
      </div>
    </div>
  );
}

type PropsDasAcoes = { login: Detalhe; isOProprio: boolean; agir: (acao: () => Promise<string>) => void; aoGerarConvite: () => void };

function Acoes({ login, isOProprio, agir, aoGerarConvite }: PropsDasAcoes) {
  if (login.situacao === "desativado") {
    return (
      <Cartao titulo="Ações" icone={Wrench}>
        <p className={estilos.vazio}>Este login está desativado: as chaves, as sessões e os convites dele não valem mais. Para voltar, crie outro login.</p>
      </Cartao>
    );
  }
  const confirmarE = (pergunta: string, acao: () => Promise<string>) => () => {
    if (window.confirm(pergunta)) agir(acao);
  };
  return (
    <Cartao titulo="Ações" icone={Wrench}>
      <div className={estilos.acoes}>
        <Acao nome="Gerar um convite novo" explicacao="Para o primeiro acesso que não aconteceu ou para um aparelho novo. O convite anterior deixa de valer.">
          <button type="button" className={botoes.secundario} onClick={aoGerarConvite}>
            <MailPlus size={16} aria-hidden="true" />
            Gerar convite
          </button>
        </Acao>
        {isOProprio ? (
          <p className={estilos.explicacao}>Este é o seu login. Para bloquear as suas chaves ou desativá-lo, use a linha de comando no servidor.</p>
        ) : (
          <>
            <Acao nome="Encerrar as sessões" explicacao="Tira o login de todos os aparelhos agora. As chaves continuam valendo para entrar de novo.">
              <button
                type="button"
                className={botoes.secundario}
                onClick={confirmarE(`Encerrar as sessões de ${login.nome} em todos os aparelhos?`, async () => {
                  const { encerradas } = await encerrarSessoes(login.id);
                  return `${encerradas} sessão(ões) encerrada(s).`;
                })}
              >
                Encerrar sessões
              </button>
            </Acao>
            <Acao nome="Bloquear todas as chaves" explicacao="Para celular perdido ou suspeita de uso por outra pessoa. Depois, gere um convite novo.">
              <button
                type="button"
                className={`${botoes.secundario} ${estilos.perigosa}`}
                onClick={confirmarE(`Bloquear todas as chaves de ${login.nome}? Ele só volta a entrar com um convite novo.`, async () => {
                  const { bloqueadas } = await bloquearChaves(login.id);
                  return `${bloqueadas} chave(s) bloqueada(s), e as sessões encerradas.`;
                })}
              >
                <ShieldAlert size={16} aria-hidden="true" />
                Bloquear chaves
              </button>
            </Acao>
            <Acao nome="Desativar o login" explicacao="Para quem saiu da representação. Os códigos ficam livres para outro login. Não tem volta.">
              <button
                type="button"
                className={`${botoes.secundario} ${estilos.perigosa}`}
                onClick={confirmarE(`Desativar o login ${login.nome}? Não tem volta: as chaves, as sessões e os convites deixam de valer.`, async () => {
                  await desativarLogin(login.id);
                  return `Login ${login.nome} desativado.`;
                })}
              >
                Desativar
              </button>
            </Acao>
          </>
        )}
      </div>
    </Cartao>
  );
}

function Acao({ nome, explicacao, children }: { nome: string; explicacao: string; children: ReactNode }) {
  return (
    <div className={estilos.acao}>
      <div>
        <p className={estilos.nomeDaAcao}>{nome}</p>
        <p className={estilos.explicacao}>{explicacao}</p>
      </div>
      {children}
    </div>
  );
}

function Codigos({ login, agir }: { login: Detalhe; agir: (acao: () => Promise<string>) => void }) {
  const [editando, setEditando] = useState(false);
  const { dados: lista } = useCarga("admin:representantes", carregarRepresentantes);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(() => new Set(login.codigos.map(({ codigo }) => codigo)));
  const podeEditar = login.situacao !== "desativado";
  const salvar = () =>
    agir(async () => {
      const { codigos } = await trocarCodigos(login.id, [...escolhidos]);
      setEditando(false);
      return `Códigos trocados: ${codigos.join(", ")}. A sessão aberta do representante já vê os novos.`;
    });
  return (
    <Cartao
      titulo="Códigos de representante"
      icone={Hash}
      subtitulo="O login vê a carteira e os pedidos de todos, somados"
      acoes={
        podeEditar && !editando ? (
          <button type="button" className={botoes.secundario} onClick={() => setEditando(true)}>
            Trocar códigos
          </button>
        ) : null
      }
    >
      {editando && lista ? (
        <div className={estilos.escolha}>
          <EscolhaDeCodigos lista={lista} escolhidos={escolhidos} aoMudar={setEscolhidos} doLogin={login.id} />
          <div className={estilos.botoes}>
            <button type="button" className={botoes.primario} disabled={escolhidos.size === 0} onClick={salvar}>
              Salvar os códigos
            </button>
            <button type="button" className={botoes.secundario} onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <p>{descreverCodigos(login.codigos)}</p>
      )}
    </Cartao>
  );
}

function Chaves({ login, isOProprio, agir }: { login: Detalhe; isOProprio: boolean; agir: (acao: () => Promise<string>) => void }) {
  const bloquear = (id: string, provedor: string) => {
    if (!window.confirm(`Bloquear a chave ${provedor} de ${login.nome}? O aparelho dela para de entrar na hora.`)) return;
    agir(async () => {
      await bloquearChave(id);
      return `Chave ${provedor} bloqueada.`;
    });
  };
  return (
    <Cartao titulo="Chaves de acesso" icone={KeyRound} subtitulo="Uma chave sincronizada vale em todos os aparelhos da mesma conta Google ou Apple">
      <TabelaResponsiva
        descricao={`Chaves de ${login.nome}`}
        itens={login.chaves}
        chaveDe={(chave) => chave.id}
        vazio="Nenhuma chave ainda: ela é criada quando o convite é aberto."
        colunas={[
          { titulo: "Provedor", largura: 10, celula: (chave) => <Identificacao titulo={chave.provedor} detalhe={chave.sincronizada ? "sincronizada" : "só neste aparelho"} /> },
          { titulo: "Criada", largura: 8, celula: (chave) => formatarQuando(chave.criadaEm) },
          { titulo: "Último uso", largura: 8, celula: (chave) => (chave.ultimoUso ? formatarQuando(chave.ultimoUso) : "—") },
          {
            titulo: "Situação",
            largura: 9,
            celula: (chave) =>
              chave.bloqueadaEm ? (
                `bloqueada ${formatarQuando(chave.bloqueadaEm)}`
              ) : isOProprio || login.situacao === "desativado" ? (
                "ativa"
              ) : (
                <button type="button" className={`${botoes.secundario} ${estilos.perigosa}`} onClick={() => bloquear(chave.id, chave.provedor)}>
                  Bloquear
                </button>
              ),
          },
        ]}
      />
    </Cartao>
  );
}

function Convites({ login }: { login: Detalhe }) {
  return (
    <Cartao titulo="Convites" icone={MailPlus} subtitulo="Cada convite vale 48 horas e uma vez só">
      <TabelaResponsiva
        descricao={`Convites de ${login.nome}`}
        itens={login.convites.map((convite, ordem) => ({ ...convite, ordem }))}
        chaveDe={(convite) => String(convite.ordem)}
        vazio="Nenhum convite."
        colunas={[
          { titulo: "Gerado", largura: 8, celula: (convite) => formatarQuando(convite.criadoEm) },
          { titulo: "Situação", largura: 9, celula: (convite) => <Selo {...ESTADO_DO_CONVITE[convite.estado]} /> },
          {
            titulo: "Quando",
            largura: 10,
            celula: (convite) =>
              convite.usadoEm ? `usado ${formatarQuando(convite.usadoEm)}` : convite.estado === "valendo" ? `vale até ${formatarQuando(convite.validoAte)}` : "—",
          },
        ]}
      />
    </Cartao>
  );
}

function Sessoes({ login }: { login: Detalhe }) {
  return (
    <Cartao titulo="Sessões" icone={MonitorSmartphone} subtitulo="As últimas 20: cada entrada com a chave abre uma, que dura até 12 horas">
      <TabelaResponsiva
        descricao={`Sessões de ${login.nome}`}
        itens={login.sessoes.map((sessao, ordem) => ({ ...sessao, ordem }))}
        chaveDe={(sessao) => String(sessao.ordem)}
        vazio="Nenhuma sessão ainda."
        colunas={[
          { titulo: "Aberta", largura: 8, celula: (sessao) => <Identificacao titulo={formatarQuando(sessao.criadaEm)} detalhe={sessao.provedor} /> },
          { titulo: "Último uso", largura: 8, celula: (sessao) => formatarQuando(sessao.ultimoUso) },
          { titulo: "Situação", largura: 10, celula: (sessao) => situacaoDaSessao(sessao) },
        ]}
      />
    </Cartao>
  );
}

function RegistroDoLogin({ id, versao }: { id: string; versao: number }) {
  const { dados: pagina } = useCarga(`admin:registro:${id}:${versao}`, () => carregarRegistro({ login: id }));
  return (
    <Cartao titulo="Registro" icone={History} subtitulo="O que o login fez e o que foi feito nele" className={estilos.inteiro}>
      {pagina ? <TabelaDoRegistro eventos={pagina.eventos} vazio="Nada registrado ainda." /> : <Carregando />}
      <p className={estilos.rodapeDoCartao}>
        <Link to="/registro">Ver o registro de todos os logins</Link>
      </p>
    </Cartao>
  );
}
