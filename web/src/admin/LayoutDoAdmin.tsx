import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { Clock, LogOut, ScrollText, TriangleAlert, Users } from "lucide-react";
import { momentoEmBrasilia } from "dominio/datas";
import { login } from "../acesso/login";
import base from "../componentes/Layout.module.css";
import { useCarga } from "../dados/useCarga";
import { formatarMomento } from "../formato";
import estilosDoAdmin from "./admin.module.css";
import { carregarSituacao } from "./api";
import estilos from "./LayoutDoAdmin.module.css";
import type { SituacaoDaAdministracao } from "./tipos";

/*
 * A moldura da administração: o mesmo menu do CRM (componentes/Layout.module.css), com as telas de
 * gestão, a marca com "Administração", no alto a hora da foto do ERP e, em todas as telas, o aviso
 * da carga recusada.
 */

const NAVEGACAO = [
  { para: "/", rotulo: "Logins", Icone: Users },
  { para: "/registro", rotulo: "Registro", Icone: ScrollText },
] as const;

export function LayoutDoAdmin() {
  const { pathname } = useLocation();
  const { dados: situacao } = useCarga("admin:situacao", carregarSituacao);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={base.casca}>
      <aside className={base.menu}>
        <Marca />
        <nav aria-label="Principal">
          <ul className={base.itensMenu}>
            {NAVEGACAO.map(({ para, rotulo, Icone }) => (
              <li key={para}>
                <NavLink to={para} end={para === "/"} className={({ isActive }) => (isActive || (para === "/" && pathname.startsWith("/logins")) ? `${base.itemMenu} ${base.ativo}` : base.itemMenu)}>
                  <Icone size={18} strokeWidth={1.75} aria-hidden="true" />
                  {rotulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {situacao ? (
          <div className={base.usuario}>
            <span className={base.avatar} aria-hidden="true">
              {situacao.admin.nome.trim().charAt(0).toUpperCase()}
            </span>
            <p className={base.nomeUsuario}>{situacao.admin.nome}</p>
            <p className={base.codigoUsuario}>Administrador</p>
            <button type="button" className={base.sair} onClick={sair}>
              <LogOut size={15} aria-hidden="true" />
              Sair
            </button>
          </div>
        ) : null}
      </aside>

      <div className={base.area}>
        <header className={base.barraSuperior}>
          <div className={base.marcaCelular}>
            <Marca />
          </div>
          <span className={base.prototipo}>Só na rede interna da Suprens</span>
          {situacao ? (
            <span className={base.atualizacao} title="Hora em que a foto do ERP foi gerada">
              <Clock size={14} aria-hidden="true" />
              {situacao.foto ? `Foto do ERP de ${formatarMomento(situacao.foto.geradaEm, momentoEmBrasilia())}` : "Ainda sem foto do ERP"}
            </span>
          ) : null}
        </header>
        <main className={base.conteudo}>
          {situacao?.cargaRecusada ? <AvisoDeCargaRecusada {...situacao} recusa={situacao.cargaRecusada} /> : null}
          <Outlet />
        </main>
      </div>

      <nav className={`${base.abas} ${estilos.abas}`} aria-label="Principal">
        {NAVEGACAO.map(({ para, rotulo, Icone }) => (
          <NavLink key={para} to={para} end={para === "/"} className={({ isActive }) => (isActive ? `${base.aba} ${base.abaAtiva}` : base.aba)}>
            <Icone size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{rotulo}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** O servidor recusou uma carga na conferência: o CRM segue com a anterior, e quem cuida dele precisa saber. */
function AvisoDeCargaRecusada({ recusa, foto, relogio }: Pick<SituacaoDaAdministracao, "foto" | "relogio"> & { recusa: NonNullable<SituacaoDaAdministracao["cargaRecusada"]> }) {
  return (
    <div className={`${estilosDoAdmin.mensagem} ${estilosDoAdmin.erro} ${estilos.aviso}`} role="alert">
      <TriangleAlert size={16} aria-hidden="true" />
      <p>
        Uma carga nova do ERP foi recusada na conferência ({formatarMomento(recusa.momento, relogio)}).{" "}
        {foto ? `O CRM continua com os dados de ${formatarMomento(foto.geradaEm, relogio)}.` : "O CRM ainda não tem dados do ERP."} Se a próxima carga
        também for recusada, avise o TI.
        <span className={estilos.motivo}>Motivo: {recusa.motivo}</span>
      </p>
    </div>
  );
}

function Marca() {
  return (
    <div className={base.marca}>
      <img src="/marca/suprens-96.png" alt="Suprens" width={40} height={38} />
      <span className={base.nomeProduto}>CRM</span>
      <span className={estilos.area}>Admin</span>
    </div>
  );
}

/** Encerra a sessão e carrega a entrada do zero, sem nada da administração na memória da página. */
function sair(): void {
  void login.sair().finally(() => window.location.replace("/entrar?motivo=saiu"));
}
