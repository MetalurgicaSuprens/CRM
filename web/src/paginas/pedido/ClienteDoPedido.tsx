import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import cartao from "../../componentes/Cartao.module.css";
import { SeloDoStatus } from "../../componentes/StatusDoCliente";
import { ROTULOS_DE_STATUS } from "../../dados/rotulos";
import type { CadastroDoCliente, ClienteResumo, EnderecoDoCadastro, LocalDoCadastro } from "../../dados/tipos";
import { formatarCep, formatarCodigoDoCliente, formatarEndereco } from "../../formato";
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
    <>
      <dl className={estilos.fatos}>
        <Fato rotulo={cliente.codigoErp === null ? "CPF" : "CNPJ"}>{cadastro.documento}</Fato>
        {cadastro.inscricaoEstadual ? <Fato rotulo="Inscrição estadual">{cadastro.inscricaoEstadual}</Fato> : null}
        {cadastro.suframa ? <Fato rotulo="Suframa">{cadastro.suframa}</Fato> : null}
        <FatosDaVenda cliente={cliente} tabela={tabela} />
        {cadastro.telefone ? <Fato rotulo="Fone comercial">{cadastro.telefone}</Fato> : null}
        {cadastro.emailDoXml ? <Fato rotulo="E-mail do XML">{cadastro.emailDoXml}</Fato> : null}
      </dl>
      <dl className={estilos.enderecos}>
        <Fato rotulo="Endereço">{formatarEnderecoDoCadastro(cadastro.faturamento)}</Fato>
        <Fato rotulo="Entrega">
          <OutroLocal local={cadastro.entrega} />
        </Fato>
        <Fato rotulo="Cobrança">
          <OutroLocal local={cadastro.cobranca} />
        </Fato>
      </dl>
    </>
  );
}

function FatosDaCarteira({ cliente, tabela }: Omit<Props, "cadastro">) {
  const local = `${cliente.cidade}/${cliente.uf}`;
  return (
    <dl className={estilos.fatos}>
      <Fato rotulo="Código no ERP">{formatarCodigoDoCliente(cliente.codigoErp)}</Fato>
      <FatosDaVenda cliente={cliente} tabela={tabela} />
      <Fato rotulo="Endereço">{cliente.endereco ? `${formatarEndereco(cliente.endereco)} · ${local}` : local}</Fato>
    </dl>
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

/** A entrega ou a cobrança: em outro endereço, ele aparece inteiro, com de quem é; senão, só o aviso de que é o mesmo. */
function OutroLocal({ local }: { local: LocalDoCadastro | null }) {
  if (!local) return <span className={estilos.mesmo}>No endereço acima</span>;
  return (
    <span className={estilos.outroLocal}>
      {formatarEnderecoDoCadastro(local)}
      <span className={estilos.donoDoLocal}>
        {local.razaoSocial} · {local.documento}
      </span>
    </span>
  );
}

/** "RUA XV DE NOVEMBRO, 1200 · CENTRO · Curitiba/PR · 80020-310" */
function formatarEnderecoDoCadastro({ texto, bairro, cidade, uf, cep }: EnderecoDoCadastro): string {
  return [texto, bairro, `${cidade}/${uf}`, cep === null ? null : formatarCep(cep)].filter(Boolean).join(" · ");
}

function Fato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className={estilos.fato}>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}
