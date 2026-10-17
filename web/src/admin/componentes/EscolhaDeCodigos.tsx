import { useState } from "react";
import { CampoDeBusca } from "../../componentes/CampoDeBusca";
import { formatarPeriodo, formatarReais, normalizarParaBusca } from "../../formato";
import estilos from "../admin.module.css";
import type { ListaDeAutorizados } from "../tipos";

type Props = {
  /** A lista de autorizados da foto: só esses códigos podem ser ligados a um login (CLAUDE.md, regra 4). */
  lista: ListaDeAutorizados;
  escolhidos: ReadonlySet<string>;
  aoMudar: (escolhidos: Set<string>) => void;
  /** O login que está sendo editado: os códigos dele não contam como "em outro login". */
  doLogin: string | null;
};

/** Com mais códigos que isto, a lista ganha a busca. */
const LIMITE_SEM_BUSCA = 8;

/**
 * Os códigos de representante para marcar, com o faturado de cada um em 12 meses. O que já está em
 * outro login ativo aparece, mas não pode ser marcado.
 */
export function EscolhaDeCodigos({ lista, escolhidos, aoMudar, doLogin }: Props) {
  const [busca, setBusca] = useState("");
  const { representantes, periodo } = lista;
  const termo = normalizarParaBusca(busca);
  const visiveis = representantes.filter(({ codigo, nome }) => !termo || codigo.startsWith(termo) || normalizarParaBusca(nome).includes(termo));
  const alternar = (codigo: string) => {
    const novos = new Set(escolhidos);
    if (novos.has(codigo)) novos.delete(codigo);
    else novos.add(codigo);
    aoMudar(novos);
  };

  if (representantes.length === 0) return <p className={estilos.vazio}>Ainda não há foto do ERP: a lista de códigos autorizados vem dela.</p>;
  return (
    <div className={estilos.escolha}>
      {representantes.length > LIMITE_SEM_BUSCA ? (
        <CampoDeBusca rotulo="Buscar código" dica="Código ou nome do representante" valor={busca} aoMudar={setBusca} className={estilos.buscaDosCodigos} />
      ) : null}
      <div className={estilos.codigos}>
        <p className={estilos.cabecalhoDosCodigos}>
          <span />
          <span>Código</span>
          <span className={estilos.tituloDoNome}>Representante</span>
          <span className={estilos.tituloDoFaturado}>Faturado 12&nbsp;meses</span>
        </p>
        <ul>
          {visiveis.map(({ codigo, nome, login, faturado12m }) => {
            const emOutroLogin = login !== null && login.id !== doLogin;
            return (
              <li key={codigo}>
                <label className={estilos.codigo} data-indisponivel={emOutroLogin || undefined}>
                  <input type="checkbox" checked={escolhidos.has(codigo)} disabled={emOutroLogin} onChange={() => alternar(codigo)} />
                  <span className={estilos.numeroDoCodigo}>{codigo}</span>
                  <span className={estilos.nomeDoCodigo}>
                    <span className={estilos.textoDoNome}>{nome}</span>
                    {emOutroLogin ? <span className={estilos.notaDoCodigo}>no login {login.nome}</span> : null}
                  </span>
                  <span className={estilos.faturadoDoCodigo}>{faturado12m === null ? "—" : formatarReais(faturado12m)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      {periodo ? (
        <p className={estilos.ajuda}>
          Faturado de {formatarPeriodo(periodo.inicio, periodo.fim)}, pelas vendas atribuídas a cada código, como no Início do CRM.
        </p>
      ) : null}
    </div>
  );
}
