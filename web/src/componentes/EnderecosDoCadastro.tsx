import type { CadastroDoCliente, LocalDoCadastro } from "../dados/tipos";
import { formatarEnderecoDoCadastro } from "../formato";
import { DetalheDoFato, Fato } from "./Fato";
import estilos from "./EnderecosDoCadastro.module.css";

/*
 * Os três endereços do cadastro, como o app antigo dos representantes mostra: o do faturamento, o da
 * entrega e o da cobrança. Na tela de pedido e na ficha do cliente; quem usa põe o <dl> e as colunas.
 */

export function EnderecosDoCadastro({ cadastro }: { cadastro: CadastroDoCliente }) {
  return (
    <>
      <Fato rotulo="Faturamento">{formatarEnderecoDoCadastro(cadastro.faturamento)}</Fato>
      <Fato rotulo="Entrega">
        <OutroLocal local={cadastro.entrega} />
      </Fato>
      <Fato rotulo="Cobrança">
        <OutroLocal local={cadastro.cobranca} />
      </Fato>
    </>
  );
}

/** A entrega ou a cobrança: em outro endereço, ele aparece inteiro, com de quem é; senão, só o aviso de que é o mesmo. */
function OutroLocal({ local }: { local: LocalDoCadastro | null }) {
  if (!local) return <span className={estilos.mesmo}>No endereço do faturamento</span>;
  return (
    <>
      {formatarEnderecoDoCadastro(local)}
      <DetalheDoFato>
        {local.razaoSocial} · {local.documento}
      </DetalheDoFato>
    </>
  );
}
