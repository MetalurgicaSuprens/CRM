import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { Clock, Eye, EyeOff, LogOut } from "lucide-react";
import { login } from "../acesso/login";
import { useValores } from "../contexto/valores";
import { carregarSituacaoDosDados, isDadosReais } from "../dados/api";
import { useCarga } from "../dados/useCarga";
import { formatarCodigosDoRepresentante, formatarMomento } from "../formato";
import { NAVEGACAO, ProvedorDaOrigem, useMemoriaDaNavegacao } from "./navegacao";
import estilos from "./Layout.module.css";

export function Layout() {
  const { pathname } = useLocation();
  const { dados: situacao, recarregar } = useCarga("situacao", carregarSituacaoDosDados);

  const origem = useMemoriaDaNavegacao();

  // O Layout fica montado entre as telas: sem isto, o relógio e a hora da foto na barra param.
  useEffect(() => {
    recarregar();
  }, [pathname, recarregar]);

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
            <span className={estilos.avatar} aria-hidden="true">
              {iniciais(situacao.representante.nome)}
            </span>
            <p className={estilos.nomeUsuario}>{situacao.representante.nome}</p>
            <p className={estilos.codigoUsuario}>{formatarCodigosDoRepresentante(situacao.representante.codigos)}</p>
            <button type="button" className={estilos.sair} onClick={sair}>
              <LogOut size={15} aria-hidden="true" />
              Sair
            </button>
          </div>
        ) : null}
      </aside>

      <div className={estilos.area}>
        <header className={estilos.barraSuperior}>
          <div className={estilos.marcaCelular}>
            <Marca />
          </div>
          <span className={estilos.prototipo}>{isDadosReais ? "Dados reais do ERP · só neste computador" : "Protótipo · dados fictícios"}</span>
          {situacao ? <Atualizacao atualizadoEm={situacao.atualizadoEm} relogio={situacao.relogio} /> : null}
          <BotaoValores />
        </header>
        <main className={estilos.conteudo}>
          <ProvedorDaOrigem value={origem}>
            <Outlet />
          </ProvedorDaOrigem>
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

/**
 * Encerra a sessão e carrega a entrada do zero: nada do login que saiu fica na memória da página,
 * nem para quem entrar em seguida no mesmo aparelho.
 */
function sair(): void {
  void login.sair().finally(() => window.location.replace("/entrar?motivo=saiu"));
}

/** "Carlos Andrade" vira "CA": a primeira letra do primeiro e do último nome. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeiro = partes[0] ?? "";
  const ultimo = partes.length > 1 ? (partes[partes.length - 1] ?? "") : "";
  return `${primeiro.charAt(0)}${ultimo.charAt(0)}`.toUpperCase();
}

/** Comparado com o relógio, não com a data da própria foto: a foto atrasada aparece como de ontem. */
function Atualizacao({ atualizadoEm, relogio }: { atualizadoEm: string; relogio: string }) {
  return (
    <span className={estilos.atualizacao} title="Hora em que os dados foram copiados do ERP">
      <Clock size={14} aria-hidden="true" />
      Dados de {formatarMomento(atualizadoEm, relogio)}
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
