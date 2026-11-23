import { useState, type ReactNode } from "react";
import { ChevronDown, Truck, Wallet } from "lucide-react";
import { LIMITE_DA_OBSERVACAO } from "dominio/pedido";
import { Segmentos } from "../../componentes/Segmentos";
import { ROTULOS_DA_CLASSIFICACAO, nomeDaTransportadora, transportadoraDe, vezesQueOClienteEscolheu } from "../../dados/dadosDoPedido";
import type { Classificacao, DadosDoPedido, EscolhaDaTransportadora as Escolha, EscolhasDoPedido } from "../../dados/tipos";
import { formatarDataCurta } from "../../formato";
import estilos from "./CondicoesDoPedido.module.css";
import { EscolhaDaTransportadora } from "./EscolhaDaTransportadora";
import { EscolhaDoPagamento } from "./EscolhaDoPagamento";
import { Janela } from "./Janela";

/*
 * As condições do pedido, que o representante escolhe: sempre abertas e mudadas ali mesmo, com os nomes
 * do app antigo dos representantes. Cada uma já vem com o que ele costuma escolher para o cliente e diz,
 * embaixo, de onde veio (proposta aceita pelo Lucas em 2026-11-17). Sem os dados do pedido na foto (o
 * modo real, antes da F5), ficam só a entrega e as observações.
 */

/** O tamanho do PV1_OCO que a cotação aceita (server/src/rotas.ts). */
const LIMITE_DA_ORDEM_DE_COMPRA = 30;
const CLASSIFICACOES = Object.keys(ROTULOS_DA_CLASSIFICACAO) as Classificacao[];

type Props = {
  dados: DadosDoPedido | null;
  escolhas: EscolhasDoPedido | null;
  aoMudarEscolhas: (escolhas: EscolhasDoPedido) => void;
  /** null = assim que possível. */
  entrega: string | null;
  aoMudarEntrega: (entrega: string | null) => void;
  primeiraEntrega: string;
  observacao: string;
  aoMudarObservacao: (observacao: string) => void;
};

export function CondicoesDoPedido({ dados, escolhas, aoMudarEscolhas, entrega, aoMudarEntrega, primeiraEntrega, observacao, aoMudarObservacao }: Props) {
  const comEscolhas = dados && escolhas ? { dados, escolhas, mudar: (mudanca: Partial<EscolhasDoPedido>) => aoMudarEscolhas({ ...escolhas, ...mudanca }) } : null;
  return (
    <div className={estilos.condicoes}>
      <div className={estilos.campos}>
        {comEscolhas ? (
          <>
            <CampoDaTransportadora dados={comEscolhas.dados} escolha={comEscolhas.escolhas.transportadora} aoEscolher={(transportadora) => comEscolhas.mudar({ transportadora })} />
            <CampoDoPagamento dados={comEscolhas.dados} codigo={comEscolhas.escolhas.condicaoDePagamento} aoEscolher={(condicaoDePagamento) => comEscolhas.mudar({ condicaoDePagamento })} />
          </>
        ) : null}
        <CampoDaEntrega entrega={entrega} aoMudar={aoMudarEntrega} primeiraEntrega={primeiraEntrega} />
        {comEscolhas ? <OutrasEscolhas {...comEscolhas} /> : null}
        <Campo rotulo="Observações" dica={`${observacao.length} de ${LIMITE_DA_OBSERVACAO} letras`}>
          <textarea
            className={`${estilos.entrada} ${estilos.observacoes}`}
            rows={1}
            maxLength={LIMITE_DA_OBSERVACAO}
            value={observacao}
            aria-label="Observações do pedido"
            onChange={(evento) => aoMudarObservacao(evento.target.value)}
          />
        </Campo>
      </div>
    </div>
  );
}

type PropsDoCampo = { rotulo: string; dica: ReactNode; children: ReactNode };

/** Um campo: o nome em cima, a escolha no meio e, embaixo, em cinza, de onde ela veio. */
function Campo({ rotulo, dica, children }: PropsDoCampo) {
  return (
    <div className={estilos.campo}>
      <span className={estilos.rotulo}>{rotulo}</span>
      {children}
      {dica ? <span className={estilos.dica}>{dica}</span> : null}
    </div>
  );
}

/** O botão que mostra a escolha e abre a lista, com cara de campo de seleção; sem escolha, pede uma, no tom de alerta. */
function BotaoDeEscolha({ rotulo, texto, aoAbrir }: { rotulo: string; texto: string | null; aoAbrir: () => void }) {
  return (
    <button type="button" className={texto ? `${estilos.entrada} ${estilos.escolha}` : `${estilos.entrada} ${estilos.escolha} ${estilos.semEscolha}`} aria-label={rotulo} onClick={aoAbrir}>
      <span className={estilos.textoDaEscolha}>{texto ?? "Escolher"}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
}

// ---------------------------------------------------------------- transportadora e pagamento

function CampoDaTransportadora({ dados, escolha, aoEscolher }: { dados: DadosDoPedido; escolha: Escolha | null; aoEscolher: (escolha: Escolha) => void }) {
  const [aberta, setAberta] = useState(false);
  const texto = escolha ? nomeDaTransportadora(dados, escolha) : null;
  return (
    <Campo rotulo="Transportadora" dica={origemDaTransportadora(dados, escolha)}>
      <BotaoDeEscolha rotulo={`Transportadora: ${texto ?? "escolher"}`} texto={texto} aoAbrir={() => setAberta(true)} />
      <Janela titulo="Transportadora" icone={<Truck size={20} aria-hidden="true" />} aberta={aberta} aoFechar={() => setAberta(false)}>
        <EscolhaDaTransportadora
          dados={dados}
          escolha={escolha}
          aoEscolher={(nova) => {
            aoEscolher(nova);
            setAberta(false);
          }}
        />
      </Janela>
    </Campo>
  );
}

function origemDaTransportadora(dados: DadosDoPedido, escolha: Escolha | null): ReactNode {
  if (!escolha) {
    const motivo = dados.transportadorasDoCliente.length > 0 ? "O cliente divide os pedidos entre várias: escolha a deste." : "Cliente sem pedido anterior: escolha a transportadora.";
    return <span className={estilos.alerta}>{motivo}</span>;
  }
  if ("nova" in escolha) return <span className={estilos.alerta}>Nova: o pedido só entra no SGI depois que vendas cadastrá-la.</span>;
  const transportadora = transportadoraDe(dados, escolha.codigo);
  const local = transportadora ? `${transportadora.cidade}/${transportadora.uf}` : null;
  const vezes = vezesQueOClienteEscolheu(dados.transportadorasDoCliente, escolha.codigo);
  const uso = vezes ? `usada ${vezes}` : "primeira vez com este cliente";
  return [local, uso].filter(Boolean).join(" · ");
}

function CampoDoPagamento({ dados, codigo, aoEscolher }: { dados: DadosDoPedido; codigo: string; aoEscolher: (codigo: string) => void }) {
  const [aberta, setAberta] = useState(false);
  const descricao = dados.condicoes.find((condicao) => condicao.codigo === codigo)?.descricao ?? codigo;
  return (
    <Campo rotulo="Condição de pagamento" dica={<DicaDoPagamento dados={dados} codigo={codigo} />}>
      <BotaoDeEscolha rotulo={`Condição de pagamento: ${descricao}`} texto={descricao} aoAbrir={() => setAberta(true)} />
      <Janela titulo="Condição de pagamento" icone={<Wallet size={20} aria-hidden="true" />} aberta={aberta} aoFechar={() => setAberta(false)}>
        <EscolhaDoPagamento
          dados={dados}
          codigo={codigo}
          aoEscolher={(novo) => {
            aoEscolher(novo);
            setAberta(false);
          }}
        />
      </Janela>
    </Campo>
  );
}

// ---------------------------------------------------------------- entrega

/** "Assim que possível" é 5 dias úteis depois de hoje; a programada, qualquer data a partir daí (Lucas, 2026-11-17). */
function CampoDaEntrega({ entrega, aoMudar, primeiraEntrega }: { entrega: string | null; aoMudar: (entrega: string | null) => void; primeiraEntrega: string }) {
  const isProgramada = entrega !== null;
  const aPartirDe = `a partir de ${formatarDataCurta(primeiraEntrega)}`;
  return (
    <Campo rotulo="Tipo de entrega" dica={isProgramada ? `Escolha a data, ${aPartirDe}.` : `Sai ${aPartirDe}, em 5 dias úteis.`}>
      <div className={estilos.entrega}>
        <Segmentos
          rotulo="Tipo de entrega"
          opcoes={[
            { valor: "logo", rotulo: "Assim que possível" },
            { valor: "programada", rotulo: "Programada" },
          ]}
          selecionado={isProgramada ? "programada" : "logo"}
          aoEscolher={(valor) => aoMudar(valor === "logo" ? null : primeiraEntrega)}
        />
        {isProgramada ? (
          <input
            className={`${estilos.entrada} ${estilos.data}`}
            type="date"
            min={primeiraEntrega}
            value={entrega}
            aria-label="Data da entrega programada"
            onChange={(evento) => aoMudar(evento.target.value || primeiraEntrega)}
          />
        ) : null}
      </div>
    </Campo>
  );
}

// ---------------------------------------------------------------- ordem de compra, classificação e frete parcial

type PropsDasOutras = { dados: DadosDoPedido; escolhas: EscolhasDoPedido; mudar: (mudanca: Partial<EscolhasDoPedido>) => void };

function OutrasEscolhas({ dados, escolhas, mudar }: PropsDasOutras) {
  return (
    <>
      <Campo rotulo="Ordem de compra" dica="O número do pedido do cliente.">
        <input
          className={estilos.entrada}
          type="text"
          maxLength={LIMITE_DA_ORDEM_DE_COMPRA}
          value={escolhas.pedidoDoCliente}
          placeholder="Opcional"
          aria-label="Ordem de compra do cliente"
          onChange={(evento) => mudar({ pedidoDoCliente: evento.target.value })}
        />
      </Campo>
      <Campo rotulo="Classificação da venda" dica={comoNosPedidos(vezesQueOClienteEscolheu(dados.classificacoesUsadas, escolhas.classificacao))}>
        <select
          className={`${estilos.entrada} ${estilos.selecao}`}
          value={escolhas.classificacao}
          aria-label="Classificação da venda"
          onChange={(evento) => mudar({ classificacao: evento.target.value as Classificacao })}
        >
          {CLASSIFICACOES.map((classificacao) => (
            <option key={classificacao} value={classificacao}>
              {ROTULOS_DA_CLASSIFICACAO[classificacao]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Cliente exige xPed" dica={origemDoXped(dados, escolhas.clienteXped)}>
        <Segmentos
          rotulo="O cliente exige na nota o número do pedido dele e o item (xPed)"
          opcoes={[
            { valor: "nao", rotulo: "Não" },
            { valor: "sim", rotulo: "Sim" },
          ]}
          selecionado={escolhas.clienteXped ? "sim" : "nao"}
          aoEscolher={(valor) => mudar({ clienteXped: valor === "sim" })}
        />
      </Campo>
      <Campo rotulo="Frete parcial" dica={origemDoParcial(dados, escolhas.aceitaParcial)}>
        <Segmentos
          rotulo="O cliente aceita receber o pedido em partes"
          opcoes={[
            { valor: "nao", rotulo: "Não aceita" },
            { valor: "sim", rotulo: "Aceita" },
          ]}
          selecionado={escolhas.aceitaParcial ? "sim" : "nao"}
          aoEscolher={(valor) => mudar({ aceitaParcial: valor === "sim" })}
        />
      </Campo>
    </>
  );
}

function origemDoParcial(dados: DadosDoPedido, aceita: boolean): string {
  const usos = [
    { valor: "sim", pedidos: dados.parcialUsado.aceita },
    { valor: "nao", pedidos: dados.parcialUsado.naoAceita },
  ];
  return comoNosPedidos(vezesQueOClienteEscolheu(usos, aceita ? "sim" : "nao")) ?? "Se o cliente recebe o pedido em partes.";
}

/** De onde vem a marca: os pedidos do cliente com e sem o item da ordem de compra. Marcada, os itens são numerados de 1 a N. */
function origemDoXped(dados: DadosDoPedido, isXped: boolean): string {
  const usos = [
    { valor: "sim", pedidos: dados.xpedUsado.com },
    { valor: "nao", pedidos: dados.xpedUsado.sem },
  ];
  const vezes = vezesQueOClienteEscolheu(usos, isXped ? "sim" : "nao");
  const explicacao = isXped ? "Item da O.C. de 1 a N, na ordem dos itens." : "Pedido e item do cliente na nota fiscal.";
  return vezes ? `Como ${vezes}. ${explicacao}` : explicacao;
}

function comoNosPedidos(vezes: string | null): string | null {
  return vezes ? `Como ${vezes}.` : null;
}

/** Quantas vezes o cliente usou a condição e, quando não é a do cadastro, o aviso de que vai para aprovação. */
function DicaDoPagamento({ dados, codigo }: { dados: DadosDoPedido; codigo: string }) {
  const vezes = vezesQueOClienteEscolheu(dados.condicoesUsadas, codigo);
  const uso = vezes ? `Usada ${vezes}.` : null;
  if (codigo === dados.condicaoDoCadastro) return <>{[uso, "É a do cadastro do cliente."].filter(Boolean).join(" ")}</>;
  return (
    <>
      {uso ? `${uso} ` : null}
      <span className={estilos.alerta}>Diferente da do cadastro: vai para a aprovação de vendas.</span>
    </>
  );
}
