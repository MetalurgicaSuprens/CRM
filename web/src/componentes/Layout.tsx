import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { ChartColumn, ClipboardList, Clock, Eye, EyeOff, House, LogOut, MapIcon, Users } from "lucide-react";
import { useValores } from "../contexto/valores";
import { carregarSituacaoDosDados } from "../dados/api";
import { useCarga } from "../dados/useCarga";
import estilos from "./Layout.module.css";

const NAVEGACAO = [
  { para: "/", rotulo: "Início", Icone: House },
  { para: "/clientes", rotulo: "Clientes", Icone: Users },
  { para: "/analises", rotulo: "Análises", Icone: ChartColumn },
  { para: "/pedidos", rotulo: "Pedidos", Icone: ClipboardList },
  { para: "/mapa", rotulo: "Mapa", Icone: MapIcon },
] as const;

export function Layout() {
  const { pathname } = useLocation();
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={estilos.casca}>
      <aside className={estilos.menu}>
        <Marca />
        <nav aria-label="Principal">
          <ul className={estilos.itensMenu}>
            {NAVEGACAO.map(({ para, rotulo, Icone }) => (
              <li key={para}>
                <NavLink to={para} end={para === "/"} className={({ isActive }) => (isActive ? `${estilos.itemMenu} ${estilos.ativo}` : estilos.itemMenu)}>
                  <Icone size={18} strokeWidth={1.75} aria-hidden="true" />
                  {rotulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {situacao ? (
          <div className={estilos.usuario}>
            <p className={estilos.nomeUsuario}>{situacao.representante.nome}</p>
            <p className={estilos.codigoUsuario}>Representante {situacao.representante.codigo}</p>
            <Link to="/entrar?motivo=saiu" className={estilos.sair}>
              <LogOut size={15} aria-hidden="true" />
              Sair
            </Link>
          </div>
        ) : null}
      </aside>

      <div className={estilos.area}>
        <header className={estilos.barraSuperior}>
          <div className={estilos.marcaCelular}>
            <Marca />
          </div>
          <span className={estilos.prototipo}>Protótipo · dados fictícios</span>
          {situacao ? <Atualizacao atualizadoEm={situacao.atualizadoEm} hoje={situacao.hoje} /> : null}
          <BotaoValores />
        </header>
        <main className={estilos.conteudo}>
          <Outlet />
        </main>
      </div>

      <nav className={estilos.abas} aria-label="Principal">
        {NAVEGACAO.map(({ para, rotulo, Icone }) => (
          <NavLink key={para} to={para} end={para === "/"} className={({ isActive }) => (isActive ? `${estilos.aba} ${estilos.abaAtiva}` : estilos.aba)}>
            <Icone size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{rotulo}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Marca() {
  return (
    <div className={estilos.marca}>
      <img src="/marca/suprens-96.png" alt="Suprens" width={40} height={38} />
      <span className={estilos.nomeProduto}>CRM</span>
    </div>
  );
}

function Atualizacao({ atualizadoEm, hoje }: { atualizadoEm: string; hoje: string }) {
  const [data, hora] = atualizadoEm.split("T");
  const quando = data === hoje ? `hoje, ${hora}` : `${data?.split("-").reverse().join("/")} ${hora}`;
  return (
    <span className={estilos.atualizacao} title="Hora em que os dados foram copiados do ERP">
      <Clock size={14} aria-hidden="true" />
      Dados de {quando}
    </span>
  );
}

function BotaoValores() {
  const { visiveis, alternar } = useValores();
  return (
    <button type="button" className={estilos.botaoValores} onClick={alternar}>
      {visiveis ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      <span className={estilos.textoBotaoValores}>{visiveis ? "Ocultar valores" : "Mostrar valores"}</span>
    </button>
  );
}
