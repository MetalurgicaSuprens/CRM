import { Identificacao, TabelaResponsiva } from "../../componentes/TabelaResponsiva";
import estilos from "../admin.module.css";
import { formatarQuando, rotuloDoEvento } from "../rotulos";
import type { EventoDoRegistro } from "../tipos";

/**
 * O registro de acessos, do mais novo ao mais velho: o que aconteceu, quando, quem fez, em quem e o
 * resultado. Só a recusa (chave ou entrada recusada) fica em vermelho; o detalhe de uma ação, como
 * quantas chaves foram bloqueadas, fica no tom do texto.
 */
export function TabelaDoRegistro({ eventos, vazio }: { eventos: readonly EventoDoRegistro[]; vazio: string }) {
  return (
    <TabelaResponsiva
      descricao="Registro de acessos"
      itens={eventos}
      chaveDe={(evento) => String(evento.id)}
      vazio={vazio}
      colunas={[
        { titulo: "O quê", largura: 13, celula: (evento) => <Identificacao titulo={rotuloDoEvento(evento.evento)} detalhe={formatarQuando(evento.momento)} /> },
        { titulo: "Quem", largura: 10, celula: (evento) => evento.quem ?? "—" },
        { titulo: "Em quê", largura: 12, celula: (evento) => evento.alvo ?? "—" },
        {
          titulo: "Resultado",
          largura: 8,
          celula: (evento) =>
            evento.evento.endsWith("_recusada") ? (
              <span className={estilos.recusa}>{evento.resultado}</span>
            ) : (
              <span className={estilos.resultadoDaAcao}>{evento.resultado}</span>
            ),
        },
      ]}
    />
  );
}
