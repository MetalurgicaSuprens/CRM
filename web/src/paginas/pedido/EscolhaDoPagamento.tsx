import { useState } from "react";
import { CampoDeBusca } from "../../componentes/CampoDeBusca";
import { frequencias } from "../../dados/dadosDoPedido";
import type { DadosDoPedido } from "../../dados/tipos";
import { normalizarParaBusca } from "../../formato";
import { Opcao, Secao } from "./Janela";

/** Na lista de todas, só as primeiras: no ERP são centenas de condições, e a busca acha o resto. */
const MAXIMO_NA_LISTA = 30;

type Props = { dados: DadosDoPedido; codigo: string; aoEscolher: (codigo: string) => void };

/** A lista da condição de pagamento: no alto, as que o cliente já usou, com a fatia dos pedidos; depois, todas. */
export function EscolhaDoPagamento({ dados, codigo, aoEscolher }: Props) {
  const [busca, setBusca] = useState("");
  const descricaoDe = (valor: string) => dados.condicoes.find((condicao) => condicao.codigo === valor)?.descricao ?? valor;
  const doCadastro = (valor: string) => (valor === dados.condicaoDoCadastro ? "do cadastro do cliente" : null);
  const termo = normalizarParaBusca(busca.trim());
  const achadas = dados.condicoes.filter((condicao) => normalizarParaBusca(`${condicao.descricao} ${condicao.codigo}`).includes(termo)).slice(0, MAXIMO_NA_LISTA);
  const usadas = frequencias(dados.condicoesUsadas);
  return (
    <>
      {usadas.length > 0 ? (
        <Secao titulo="Usadas com este cliente">
          {usadas.map((frequencia) => (
            <Opcao
              key={frequencia.valor}
              titulo={descricaoDe(frequencia.valor)}
              detalhe={doCadastro(frequencia.valor)}
              frequencia={frequencia}
              escolhida={frequencia.valor === codigo}
              aoEscolher={() => aoEscolher(frequencia.valor)}
            />
          ))}
        </Secao>
      ) : null}
      <Secao titulo="Todas as condições">
        <CampoDeBusca rotulo="Buscar condição" valor={busca} dica="Prazo, como 30/60" aoMudar={setBusca} />
        {achadas.map((condicao) => (
          <Opcao key={condicao.codigo} titulo={condicao.descricao} detalhe={doCadastro(condicao.codigo)} escolhida={condicao.codigo === codigo} aoEscolher={() => aoEscolher(condicao.codigo)} />
        ))}
      </Secao>
    </>
  );
}
