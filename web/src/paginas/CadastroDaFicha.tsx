import { FileText } from "lucide-react";
import { Cartao } from "../componentes/Cartao";
import { EnderecosDoCadastro } from "../componentes/EnderecosDoCadastro";
import { Fato } from "../componentes/Fato";
import type { CadastroDoCliente } from "../dados/tipos";
import estilos from "./CadastroDaFicha.module.css";

/*
 * O cadastro fiscal do cliente na ficha, como a tela de cliente do app antigo dos representantes
 * (regra 3 do CLAUDE.md, mudada em 2026-11-17), em três partes: os dados fiscais, o contato e os
 * endereços. Só se confere: quem muda o cadastro é Vendas, no ERP.
 */

export function CadastroDaFicha({ cadastro, isPessoaFisica }: { cadastro: CadastroDoCliente; isPessoaFisica: boolean }) {
  return (
    <Cartao titulo="Cadastro" icone={FileText} subtitulo="Os dados fiscais e os endereços, como estão no ERP">
      <div className={estilos.cadastro}>
        <section className={estilos.parte} aria-label="Dados fiscais">
          <h3 className={estilos.titulo}>Dados fiscais</h3>
          <dl className={estilos.fatos}>
            <Fato rotulo="Razão social" largo>
              {cadastro.razaoSocial}
            </Fato>
            <Fato rotulo={isPessoaFisica ? "CPF" : "CNPJ"}>{cadastro.documento}</Fato>
            <Fato rotulo="Inscrição estadual">{cadastro.inscricaoEstadual ?? "—"}</Fato>
            <Fato rotulo="Suframa">{cadastro.suframa ?? "—"}</Fato>
          </dl>
        </section>
        <section className={estilos.parte} aria-label="Contato">
          <h3 className={estilos.titulo}>Contato</h3>
          <dl className={estilos.fatos}>
            <Fato rotulo="Fone comercial">{cadastro.telefone ?? "—"}</Fato>
            <Fato rotulo="E-mail do XML da nota" largo>
              {cadastro.emailDoXml ?? "—"}
            </Fato>
          </dl>
        </section>
        <section className={`${estilos.parte} ${estilos.enderecos}`} aria-label="Endereços">
          <h3 className={estilos.titulo}>Endereços</h3>
          <dl className={estilos.listaDeEnderecos}>
            <EnderecosDoCadastro cadastro={cadastro} />
          </dl>
        </section>
      </div>
    </Cartao>
  );
}
