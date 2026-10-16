import { useEffect, useState } from "react";
import { History } from "lucide-react";
import botoes from "../../componentes/Botao.module.css";
import { CabecalhoPagina } from "../../componentes/CabecalhoPagina";
import { Cartao } from "../../componentes/Cartao";
import { Carregando } from "../../paginas/Carregando";
import { Mensagem } from "../componentes/Mensagem";
import { TabelaDoRegistro } from "../componentes/TabelaDoRegistro";
import { carregarRegistro } from "../api";
import estilos from "../admin.module.css";
import type { EventoDoRegistro } from "../tipos";

/*
 * O registro de acessos de todos os logins (docs/plano.md, "Auditoria"), do mais novo ao mais
 * velho, de 100 em 100. O alvo vem pelo nome: o login, a chave pelo provedor e o dono, o cliente.
 */

type Registro = { eventos: EventoDoRegistro[]; temMais: boolean };

export function Registro() {
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let atual = true;
    carregarRegistro().then(
      (pagina) => atual && setRegistro(pagina),
      (falha: Error) => atual && setErro(falha.message),
    );
    return () => {
      atual = false;
    };
  }, []);

  const carregarMais = () => {
    const maisVelho = registro?.eventos.at(-1)?.id;
    if (maisVelho === undefined) return;
    setCarregandoMais(true);
    carregarRegistro({ antes: maisVelho }).then(
      (pagina) => {
        setRegistro((atual) => ({ eventos: [...(atual?.eventos ?? []), ...pagina.eventos], temMais: pagina.temMais }));
        setCarregandoMais(false);
      },
      (falha: Error) => {
        setErro(falha.message);
        setCarregandoMais(false);
      },
    );
  };

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina titulo="Registro de acessos" descricao="Entradas, chaves, convites e as ações da administração, do mais novo ao mais velho" />
      {erro ? <Mensagem recado={{ tom: "erro", texto: erro }} /> : null}
      <Cartao titulo="Registro" icone={History} subtitulo="Guardado no app.db; sai do servidor na cópia para a rede interna">
        {registro ? <TabelaDoRegistro eventos={registro.eventos} vazio="Nada registrado ainda." /> : <Carregando />}
        {registro?.temMais ? (
          <button type="button" className={`${botoes.secundario} ${estilos.maisAntigos}`} onClick={carregarMais} disabled={carregandoMais}>
            {carregandoMais ? "Carregando…" : "Carregar os mais antigos"}
          </button>
        ) : null}
      </Cartao>
    </div>
  );
}
