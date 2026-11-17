import { Building2 } from "lucide-react";
import cartao from "../../componentes/Cartao.module.css";
import { EnderecosDoCadastro } from "../../componentes/EnderecosDoCadastro";
import { Fato } from "../../componentes/Fato";
import { SeloDoStatus } from "../../componentes/StatusDoCliente";
import { ROTULOS_DE_STATUS } from "../../dados/rotulos";
import type { CadastroDoCliente, ClienteResumo } from "../../dados/tipos";
import { formatarCodigoDoCliente, formatarEndereco } from "../../formato";
import estilos from "./ClienteDoPedido.module.css";

/*
 * O cliente do pedido, no alto do documento: o que o representante confere antes de enviar, para o
 * pedido não ir no CNPJ ou no endereço errado. É tudo o que o app antigo dos representantes mostra
 * (regra 3 do CLAUDE.md, mudada em 2026-11-17), em texto discreto: aqui nada se muda. Sem o cadastro na
 * foto (o modo real, antes da F5), fica o que a carteira já traz.
 */

type Props = { cliente: ClienteResumo; tabela: string; cadastro: CadastroDoCliente | null };

export function ClienteDoPedido({ cliente, tabela, cadastro }: Props) {
  return (
    <section className={estilos.cliente} aria-label="Cliente do pedido">
      {/* O nome do cliente é o título do bloco, com o círculo do ícone dos cartões. */}
      <header className={cartao.identificacao}>
        <span className={cartao.icone} aria-hidden="true">
          <Building2 size={18} strokeWidth={1.75} />
        </span>
        <div className={cartao.titulos}>
          <h2 className={`${cartao.titulo} ${estilos.nome}`}>
            {cliente.nome}
            <SeloDoStatus status={cliente.status} />
          </h2>
          {cadastro ? <p className={cartao.subtitulo}>{cadastro.razaoSocial}</p> : null}
        </div>
      </header>
      {cadastro ? <FatosDoCadastro cliente={cliente} tabela={tabela} cadastro={cadastro} /> : <FatosDaCarteira cliente={cliente} tabela={tabela} />}
    </section>
  );
}

function FatosDoCadastro({ cliente, tabela, cadastro }: Props & { cadastro: CadastroDoCliente }) {
  return (
    <div className={estilos.cadastro}>
      <dl className={estilos.fatos}>
        <Fato rotulo={cliente.cpf === null ? "CNPJ" : "CPF"}>{cadastro.documento}</Fato>
        {cadastro.inscricaoEstadual ? <Fato rotulo="Inscrição estadual">{cadastro.inscricaoEstadual}</Fato> : null}
        {cadastro.suframa ? <Fato rotulo="Suframa">{cadastro.suframa}</Fato> : null}
        <FatosDaVenda cliente={cliente} tabela={tabela} />
        {cadastro.telefone ? <Fato rotulo="Fone comercial">{cadastro.telefone}</Fato> : null}
        {cadastro.emailDoXml ? <Fato rotulo="E-mail do XML" largo>{cadastro.emailDoXml}</Fato> : null}
      </dl>
      <dl className={estilos.enderecos}>
        <EnderecosDoCadastro cadastro={cadastro} />
      </dl>
    </div>
  );
}

function FatosDaCarteira({ cliente, tabela }: Omit<Props, "cadastro">) {
  const local = `${cliente.cidade}/${cliente.uf}`;
  return (
    <div className={estilos.cadastro}>
      <dl className={estilos.fatos}>
        <Fato rotulo={cliente.cpf === null ? "Código no ERP" : "CPF"}>{cliente.cpf ?? formatarCodigoDoCliente(cliente)}</Fato>
      <FatosDaVenda cliente={cliente} tabela={tabela} />
      </dl>
      <dl className={estilos.enderecos}>
        <Fato rotulo="Endereço">{cliente.endereco ? `${formatarEndereco(cliente.endereco)} · ${local}` : local}</Fato>
      </dl>
    </div>
  );
}

function FatosDaVenda({ cliente, tabela }: Omit<Props, "cadastro">) {
  return (
    <>
      <Fato rotulo="Status">{ROTULOS_DE_STATUS[cliente.status]}</Fato>
      <Fato rotulo="Tabela de preço">{tabela || "Sem tabela"}</Fato>
    </>
  );
}
