import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Users } from "lucide-react";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { CampoDeBusca } from "../componentes/CampoDeBusca";
import { Cartao } from "../componentes/Cartao";
import { DataRelativa, descreverData } from "../componentes/Quando";
import { SITUACOES, SituacaoCliente } from "../componentes/SituacaoCliente";
import { AvisoDePedidoBloqueado, StatusDoCliente } from "../componentes/StatusDoCliente";
import { Identificacao, TabelaResponsiva } from "../componentes/TabelaResponsiva";
import { Voltar } from "../componentes/Voltar";
import { carregarCatalogo, carregarClientes, carregarCotacao, carregarSituacaoDosDados, isDadosReais } from "../dados/api";
import { correspondeAoClienteOuCidade } from "../dados/busca";
import { PedidoBloqueado } from "../dados/fonteDeDados";
import { novoIdDeCotacao } from "../dados/pedido";
import { ROTULOS_DE_STATUS } from "../dados/rotulos";
import type { Cotacao } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarLocalECodigo } from "../formato";
import { Carregando } from "./Carregando";
import estilos from "./MontarPedido.module.css";
import { DocumentoDoPedido } from "./pedido/DocumentoDoPedido";
import { mensagemDo } from "./pedido/mensagemDo";

/**
 * /pedidos/novo?cliente=... começa um pedido e põe no endereço o id da cotação (&cotacao=...): recarregar
 * a página, ou o navegador reabrir a aba depois de o computador desligar, continua o mesmo pedido.
 * /pedidos/novo?grupo=... escolhe antes o CNPJ do grupo; /pedidos/cotacoes/:id continua uma cotação.
 */
export function MontarPedido() {
  const { id } = useParams();
  const [parametros, setParametros] = useSearchParams();
  const codigoCliente = parametros.get("cliente");
  const idDoNovo = parametros.get("cotacao");
  useEffect(() => {
    if (id || !codigoCliente || idDoNovo) return;
    const proximos = new URLSearchParams(parametros);
    proximos.set("cotacao", novoIdDeCotacao());
    setParametros(proximos, { replace: true });
  }, [id, codigoCliente, idDoNovo, parametros, setParametros]);
  if (id) return <ContinuarCotacao id={id} codigoDoNovo={null} />;
  if (!codigoCliente) return <EscolherCliente codigoDoGrupo={parametros.get("grupo")} />;
  return idDoNovo ? <ContinuarCotacao id={idDoNovo} codigoDoNovo={codigoCliente} /> : <Carregando />;
}

type BuscaDoCotacao = { id: string; cotacao: Cotacao | null; erro: string | null };

/**
 * A cotação como está no servidor agora: sem o cache das telas, que podia trazer uma versão de antes.
 * No pedido novo, a cotação ainda não existe e começa vazia, com o id do endereço.
 */
function ContinuarCotacao({ id, codigoDoNovo }: { id: string; codigoDoNovo: string | null }) {
  const [busca, setBusca] = useState<BuscaDoCotacao | null>(null);
  useEffect(() => {
    let atual = true;
    carregarCotacao(id).then(
      (cotacao) => {
        if (atual) setBusca({ id, cotacao, erro: null });
      },
      (erro: unknown) => {
        if (atual) setBusca({ id, cotacao: null, erro: mensagemDo(erro) });
      },
    );
    return () => {
      atual = false;
    };
  }, [id]);
  if (busca?.id !== id) return <Carregando />;
  if (busca.erro) return <Indisponivel texto={busca.erro} />;
  const codigoCliente = busca.cotacao?.cliente.codigo ?? codigoDoNovo;
  if (!codigoCliente) return <Indisponivel texto={COTACAO_NAO_ENCONTRADO} />;
  return <Montagem codigoCliente={codigoCliente} idDoCotacao={id} inicial={busca.cotacao} />;
}

const COTACAO_NAO_ENCONTRADO = isDadosReais
  ? "Cotação não encontrada: ela foi enviada ou descartada."
  : "Cotação não encontrada. No protótipo, as cotações somem quando a página é recarregada.";

type PropsDaMontagem = { codigoCliente: string; idDoCotacao: string; inicial: Cotacao | null };

function Montagem({ codigoCliente, idDoCotacao, inicial }: PropsDaMontagem) {
  const { dados: catalogo, carregando, erro } = useCarga(`catalogo:${codigoCliente}`, () => carregarCatalogo(codigoCliente));
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  if (carregando || !situacao) return <Carregando />;
  if (erro instanceof PedidoBloqueado) return <ClienteSemPedido aviso={erro.message} />;
  if (!catalogo) return <Indisponivel texto={erro?.message ?? "Cliente não encontrado na sua carteira."} />;
  return <DocumentoDoPedido catalogo={catalogo} idDoCotacao={idDoCotacao} inicial={inicial} relogio={situacao.relogio} />;
}

// ---------------------------------------------------------------- escolha do cliente

/** O pedido é sempre de um CNPJ: o grupo entra pelos CNPJs dele, e com ?grupo= só eles aparecem. */
function EscolherCliente({ codigoDoGrupo }: { codigoDoGrupo: string | null }) {
  const { dados: clientes } = useCarga("clientes", carregarClientes);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const [busca, setBusca] = useState("");
  if (!clientes || !situacao) return <Carregando />;
  const grupo = clientes.find((cliente) => cliente.codigo === codigoDoGrupo && cliente.cnpjs);
  const cnpjs = grupo?.cnpjs ?? clientes.flatMap((cliente) => cliente.cnpjs ?? [cliente]);
  const visiveis = cnpjs.filter((cliente) => correspondeAoClienteOuCidade(cliente, busca));
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        antes={grupo ? <Voltar para={`/clientes/${grupo.codigo}`} rotulo={grupo.nome} /> : <Voltar para="/pedidos" rotulo="Pedidos" />}
        titulo="Incluir pedido"
        descricao={grupo ? `Para qual CNPJ de ${grupo.nome} é o pedido?` : "Para qual cliente é o pedido?"}
      />
      <CampoDeBusca
        rotulo="Buscar cliente"
        valor={busca}
        dica="Nome, código ou cidade"
        aoMudar={setBusca}
        focarAoAbrir
        className={estilos.buscaDeCliente}
      />
      <Cartao titulo={grupo ? `CNPJs de ${grupo.nome}` : "Clientes da carteira"} icone={Users}>
        <TabelaResponsiva
          descricao={grupo ? `CNPJs de ${grupo.nome}` : "Clientes da carteira"}
          itens={visiveis}
          chaveDe={(cliente) => cliente.codigo}
          linkDe={(cliente) => `/pedidos/novo?cliente=${cliente.codigo}`}
          vazio="Nenhum cliente com essa busca."
          noCelular={(cliente) => ({
            titulo: cliente.nome,
            detalhe: (
              <>
                <SituacaoCliente situacao={cliente.situacao} />
                <span>{formatarLocalECodigo(cliente)}</span>
              </>
            ),
            valor: cliente.status === "ativo" ? null : <StatusDoCliente status={cliente.status} />,
            abaixoDoValor: cliente.ultimaCompra ? descreverData(cliente.ultimaCompra, situacao.hoje) : "sem compras",
          })}
          colunas={[
            {
              titulo: "Cliente",
              ordenarPor: (cliente) => cliente.nome,
              celula: (cliente) => (
                <Identificacao titulo={cliente.nome} detalhe={formatarLocalECodigo(cliente)} />
              ),
            },
            {
              titulo: "Status",
              largura: 7,
              ordenarPor: (cliente) => ROTULOS_DE_STATUS[cliente.status],
              celula: (cliente) => <StatusDoCliente status={cliente.status} />,
            },
            { titulo: "Situação", ordenarPor: (cliente) => SITUACOES[cliente.situacao].rotulo, celula: (cliente) => <SituacaoCliente situacao={cliente.situacao} /> },
            { titulo: "Última compra", ordenarPor: (cliente) => cliente.ultimaCompra, celula: (cliente) => <DataRelativa data={cliente.ultimaCompra} hoje={situacao.hoje} /> },
          ]}
        />
      </Cartao>
    </div>
  );
}

function ClienteSemPedido({ aviso }: { aviso: string }) {
  return (
    <div className={estilos.pagina}>
      <Voltar para="/pedidos" rotulo="Pedidos" />
      <AvisoDePedidoBloqueado texto={aviso} />
    </div>
  );
}

function Indisponivel({ texto }: { texto: string }) {
  return (
    <div className={estilos.pagina}>
      <Voltar para="/pedidos" rotulo="Pedidos" />
      <p className={estilos.vazio}>{texto}</p>
    </div>
  );
}
