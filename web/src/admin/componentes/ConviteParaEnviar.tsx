import { useState } from "react";
import { Copy, Send } from "lucide-react";
import botoes from "../../componentes/Botao.module.css";
import { Cartao } from "../../componentes/Cartao";
import estilos from "../admin.module.css";
import { formatarQuando } from "../rotulos";
import type { ConviteGerado } from "../tipos";

/**
 * O link do convite que acabou de sair, para copiar e mandar. Ele aparece uma vez só: o servidor
 * guarda só o hash do token.
 */
export function ConviteParaEnviar({ convite }: { convite: ConviteGerado }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    navigator.clipboard.writeText(convite.link).then(
      () => setCopiado(true),
      () => setCopiado(false),
    );
  };
  return (
    <Cartao titulo={`Convite para ${convite.nome}`} icone={Send} subtitulo={`Vale uma vez só, até ${formatarQuando(convite.validoAte)}.`}>
      <div className={estilos.link}>
        <code className={estilos.textoDoLink}>{convite.link}</code>
        <button type="button" className={botoes.primario} onClick={copiar}>
          <Copy size={16} aria-hidden="true" />
          {copiado ? "Link copiado" : "Copiar o link"}
        </button>
      </div>
      <ul className={estilos.instrucoes}>
        <li>Mande só para quem vai usar este login, por WhatsApp ou e-mail: quem abrir primeiro cria a chave de acesso.</li>
        <li>Este link não aparece de novo. Se ele se perder, gere outro convite, e este deixa de valer.</li>
      </ul>
    </Cartao>
  );
}
