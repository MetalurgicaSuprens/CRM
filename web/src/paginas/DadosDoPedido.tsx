import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, Plus, Truck, Wallet } from "lucide-react";
import botoes from "../componentes/Botao.module.css";
import { CampoDeBusca } from "../componentes/CampoDeBusca";
import { Segmentos } from "../componentes/Segmentos";
import {
  ROTULOS_DA_CLASSIFICACAO,
  digitosDoCnpj,
  formatarCnpj,
  formatarParte,
  frequencias,
  isCnpjValido,
  nomeDaTransportadora,
  transportadoraDe,
  transportadoraDoCnpj,
  transportadoraSugerida,
  vezesQueOClienteEscolheu,
  type Frequencia,
} from "../dados/dadosDoPedido";
import type { Classificacao, DadosDoPedido, EscolhaDaTransportadora, EscolhasDoPedido, Transportadora, TransportadoraNova } from "../dados/tipos";
import { formatarDataCurta, normalizarParaBusca } from "../formato";
import estilos from "./DadosDoPedido.module.css";

/*
 * Os dados do pedido, já preenchidos com o que o representante costuma escolher para o cliente, cada
 * um dizendo de onde veio (proposta aceita pelo Lucas em 2026-11-17, baseada no app antigo dos
 * representantes). A transportadora e o pagamento abrem uma lista com o que o cliente mais usa no alto.
 */

/** Na lista de todas, só aparece o que a busca acha: no ERP são centenas de transportadoras e condições. */
const MAXIMO_NA_BUSCA = 30;

type Props = {
  dados: DadosDoPedido;
  escolhas: EscolhasDoPedido;
  aoMudar: (escolhas: EscolhasDoPedido) => void;
  /** null = assim que possível. */
  entrega: string | null;
  aoMudarEntrega: (entrega: string | null) => void;
  primeiraEntrega: string;
};

/**
 * Como tudo já vem preenchido, o bloco começa fechado, num resumo de poucas linhas, para o total e o
 * envio ficarem à vista. Ele começa aberto quando falta escolher a transportadora.
 */
export function DadosDoPedido(props: Props) {
  const [aberto, setAberto] = useState(props.escolhas.transportadora === null);
  const podeFechar = props.escolhas.transportadora !== null;
  if (!aberto) return <ResumoDosDados {...props} aoAlterar={() => setAberto(true)} />;
  return (
    <div className={estilos.bloco}>
      <EscolhasDoPedidoAbertas {...props} />
      {podeFechar ? (
        <button type="button" className={`${botoes.secundario} ${estilos.pronto}`} onClick={() => setAberto(false)}>
          <Check size={16} aria-hidden="true" />
          Pronto
        </button>
      ) : null}
    </div>
  );
}

function ResumoDosDados({ dados, escolhas, entrega, primeiraEntrega, aoAlterar }: Props & { aoAlterar: () => void }) {
  const pagamento = dados.condicoes.find((condicao) => condicao.codigo === escolhas.condicaoDePagamento)?.descricao ?? escolhas.condicaoDePagamento;
  const transportadora = escolhas.transportadora ? nomeDaTransportadora(dados, escolhas.transportadora) : "a escolher";
  const isNova = escolhas.transportadora !== null && "nova" in escolhas.transportadora;
  const condicaoDiferente = escolhas.condicaoDePagamento !== dados.condicaoDoCadastro;
  return (
    <div className={estilos.resumo}>
      <dl className={estilos.itensDoResumo}>
        <ItemDoResumo rotulo="Transportadora" alerta={isNova ? "nova, espera o cadastro de vendas" : null}>
          {transportadora}
        </ItemDoResumo>
        <ItemDoResumo rotulo="Pagamento" alerta={condicaoDiferente ? "fora do cadastro, vai para aprovação" : null}>
          {pagamento}
        </ItemDoResumo>
        <ItemDoResumo rotulo="Entrega" alerta={null}>
          {entrega ? `programada, ${formatarDataCurta(entrega)}` : `assim que possível, ${formatarDataCurta(primeiraEntrega)}`}
        </ItemDoResumo>
        <ItemDoResumo rotulo="Venda" alerta={null}>
          {ROTULOS_DA_CLASSIFICACAO[escolhas.classificacao]} · {escolhas.aceitaParcial ? "recebe em partes" : "não recebe em partes"}
          {escolhas.pedidoDoCliente.trim() ? ` · pedido do cliente ${escolhas.pedidoDoCliente.trim()}` : ""}
        </ItemDoResumo>
      </dl>
      <button type="button" className={`${botoes.secundario} ${estilos.alterar}`} onClick={aoAlterar}>
        Alterar
      </button>
    </div>
  );
}

function ItemDoResumo({ rotulo, alerta, children }: { rotulo: string; alerta: string | null; children: ReactNode }) {
  return (
    <div className={estilos.itemDoResumo}>
      <dt>{rotulo}</dt>
      <dd>
        {children}
        {alerta ? <span className={estilos.alerta}> ({alerta})</span> : null}
      </dd>
    </div>
  );
}

function EscolhasDoPedidoAbertas({ dados, escolhas, aoMudar, entrega, aoMudarEntrega, primeiraEntrega }: Props) {
  const mudar = (mudanca: Partial<EscolhasDoPedido>) => aoMudar({ ...escolhas, ...mudanca });
  return (
    <ul className={estilos.linhas} aria-label="Dados do pedido">
      <LinhaDaTransportadora dados={dados} escolha={escolhas.transportadora} aoEscolher={(transportadora) => mudar({ transportadora })} />
      <LinhaDoPagamento dados={dados} codigo={escolhas.condicaoDePagamento} aoEscolher={(condicaoDePagamento) => mudar({ condicaoDePagamento })} />
      <LinhaDaEntrega entrega={entrega} aoMudar={aoMudarEntrega} primeiraEntrega={primeiraEntrega} />
      <Linha rotulo="Classificação" origem={origemDaClassificacao(dados, escolhas.classificacao)}>
        <Segmentos
          rotulo="Classificação da venda"
          className={estilos.quebra}
          opcoes={(Object.keys(ROTULOS_DA_CLASSIFICACAO) as Classificacao[]).map((valor) => ({ valor, rotulo: ROTULOS_DA_CLASSIFICACAO[valor] }))}
          selecionado={escolhas.classificacao}
          aoEscolher={(classificacao) => mudar({ classificacao })}
        />
      </Linha>
      <Linha rotulo="Recebe em partes?" origem={origemDoParcial(dados, escolhas.aceitaParcial)}>
        <Segmentos
          rotulo="O cliente aceita receber em partes"
          opcoes={[
            { valor: "sim", rotulo: "Sim" },
            { valor: "nao", rotulo: "Não" },
          ]}
          selecionado={escolhas.aceitaParcial ? "sim" : "nao"}
          aoEscolher={(valor) => mudar({ aceitaParcial: valor === "sim" })}
        />
      </Linha>
      <Linha rotulo="Pedido do cliente" origem="O número do pedido de compra do cliente, se ele mandou um.">
        <input
          className={estilos.campo}
          type="text"
          maxLength={30}
          value={escolhas.pedidoDoCliente}
          placeholder="Opcional"
          aria-label="Número do pedido de compra do cliente"
          onChange={(evento) => mudar({ pedidoDoCliente: evento.target.value })}
        />
      </Linha>
    </ul>
  );
}

function Linha({ rotulo, origem, children }: { rotulo: string; origem: ReactNode; children: ReactNode }) {
  return (
    <li className={estilos.linha}>
      <span className={estilos.rotulo}>{rotulo}</span>
      <div className={estilos.controle}>{children}</div>
      {origem ? <span className={estilos.origem}>{origem}</span> : null}
    </li>
  );
}

/** O botão que mostra a escolha e abre a lista, com cara de campo de seleção. */
function BotaoDeEscolha({ texto, vazio, aoAbrir }: { texto: string | null; vazio: string; aoAbrir: () => void }) {
  return (
    <button type="button" className={`${estilos.escolha} ${texto ? "" : estilos.escolhaVazia}`} onClick={aoAbrir}>
      <span className={estilos.textoDaEscolha}>{texto ?? vazio}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
}

// ---------------------------------------------------------------- transportadora

function LinhaDaTransportadora({ dados, escolha, aoEscolher }: { dados: DadosDoPedido; escolha: EscolhaDaTransportadora | null; aoEscolher: (escolha: EscolhaDaTransportadora) => void }) {
  const [aberta, setAberta] = useState(false);
  return (
    <Linha rotulo="Transportadora" origem={origemDaTransportadora(dados, escolha)}>
      <BotaoDeEscolha texto={escolha ? nomeDaTransportadora(dados, escolha) : null} vazio="Escolher" aoAbrir={() => setAberta(true)} />
      <Janela titulo="Transportadora" icone={<Truck size={20} aria-hidden="true" />} aberta={aberta} aoFechar={() => setAberta(false)}>
        {aberta ? (
          <EscolhaDaTransportadora
            dados={dados}
            escolha={escolha}
            aoEscolher={(nova) => {
              aoEscolher(nova);
              setAberta(false);
            }}
          />
        ) : null}
      </Janela>
    </Linha>
  );
}

function origemDaTransportadora(dados: DadosDoPedido, escolha: EscolhaDaTransportadora | null): ReactNode {
  if (!escolha) {
    return dados.transportadorasDoCliente.length > 0 ? "O cliente divide os pedidos entre várias: escolha a deste." : "Cliente sem pedido anterior: escolha a transportadora.";
  }
  if ("nova" in escolha) return <span className={estilos.alerta}>Nova: o pedido só entra no SGI depois que vendas cadastrá-la.</span>;
  const transportadora = transportadoraDe(dados, escolha.codigo);
  const local = transportadora ? `${transportadora.cidade}/${transportadora.uf}` : "";
  const vezes = vezesQueOClienteEscolheu(dados.transportadorasDoCliente, escolha.codigo);
  const sugerida = transportadoraSugerida(dados) === escolha.codigo;
  return [local, vezes ? `${sugerida ? "sugerida: usada " : "usada "}${vezes}` : "primeira vez com este cliente"].filter(Boolean).join(" · ");
}

function EscolhaDaTransportadora({ dados, escolha, aoEscolher }: { dados: DadosDoPedido; escolha: EscolhaDaTransportadora | null; aoEscolher: (escolha: EscolhaDaTransportadora) => void }) {
  const [busca, setBusca] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const doCliente = frequencias(dados.transportadorasDoCliente);
  const jaListadas = new Set(doCliente.map(({ valor }) => valor));
  const doRepresentante = frequencias(dados.transportadorasDoRepresentante).filter(({ valor }) => !jaListadas.has(valor));
  const escolhida = escolha && "codigo" in escolha ? escolha.codigo : null;
  const achadas = useMemo(() => buscarTransportadoras(dados.transportadoras, busca), [dados.transportadoras, busca]);
  if (cadastrando) return <CadastroDeTransportadora dados={dados} aoVoltar={() => setCadastrando(false)} aoEscolher={aoEscolher} />;
  const opcao = (frequencia: Frequencia) => {
    const transportadora = transportadoraDe(dados, frequencia.valor);
    return transportadora ? (
      <Opcao
        key={frequencia.valor}
        titulo={transportadora.nome}
        detalhe={`${transportadora.cidade}/${transportadora.uf}`}
        frequencia={frequencia}
        escolhida={frequencia.valor === escolhida}
        aoEscolher={() => aoEscolher({ codigo: frequencia.valor })}
      />
    ) : null;
  };
  return (
    <>
      {doCliente.length > 0 ? <Secao titulo="Usadas com este cliente">{doCliente.map(opcao)}</Secao> : null}
      {doRepresentante.length > 0 ? <Secao titulo="As que você mais usa com outros clientes">{doRepresentante.map(opcao)}</Secao> : null}
      <Secao titulo="Todas as transportadoras do ERP">
        <CampoDeBusca rotulo="Buscar transportadora" valor={busca} dica="Nome, cidade ou CNPJ" aoMudar={setBusca} className={estilos.busca} />
        {busca.trim()
          ? achadas.map((transportadora) => (
              <Opcao
                key={transportadora.codigo}
                titulo={transportadora.nome}
                detalhe={`${transportadora.cidade}/${transportadora.uf} · ${transportadora.cnpj}`}
                escolhida={transportadora.codigo === escolhida}
                aoEscolher={() => aoEscolher({ codigo: transportadora.codigo })}
              />
            ))
          : null}
        {busca.trim() && achadas.length === 0 ? <p className={estilos.nota}>Nenhuma transportadora com essa busca.</p> : null}
      </Secao>
      <button type="button" className={`${botoes.secundario} ${estilos.cadastrar}`} onClick={() => setCadastrando(true)}>
        <Plus size={16} aria-hidden="true" />
        Cadastrar transportadora nova
      </button>
    </>
  );
}

function buscarTransportadoras(transportadoras: readonly Transportadora[], busca: string): Transportadora[] {
  const termo = normalizarParaBusca(busca.trim());
  const digitos = digitosDoCnpj(busca);
  if (!termo) return [];
  return transportadoras
    .filter((transportadora) => normalizarParaBusca(`${transportadora.nome} ${transportadora.cidade}`).includes(termo) || (digitos.length >= 4 && digitosDoCnpj(transportadora.cnpj).includes(digitos)))
    .slice(0, MAXIMO_NA_BUSCA);
}

const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");

/**
 * A transportadora que ainda não está no ERP: o representante informa o CNPJ, o nome e a cidade, e o
 * pedido espera vendas cadastrá-la (decisão do Lucas em 2026-11-17). O CNPJ que já está no ERP leva à de lá.
 */
function CadastroDeTransportadora({ dados, aoVoltar, aoEscolher }: { dados: DadosDoPedido; aoVoltar: () => void; aoEscolher: (escolha: EscolhaDaTransportadora) => void }) {
  const [nova, setNova] = useState<TransportadoraNova>({ cnpj: "", nome: "", cidade: "", uf: "" });
  const [tentou, setTentou] = useState(false);
  const cnpjValido = isCnpjValido(nova.cnpj);
  const existente = cnpjValido ? transportadoraDoCnpj(dados, nova.cnpj) : null;
  const pronta = cnpjValido && !existente && nova.nome.trim().length >= 2 && nova.cidade.trim().length >= 2 && UFS.includes(nova.uf);
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    setTentou(true);
    if (pronta) aoEscolher({ nova: { cnpj: digitosDoCnpj(nova.cnpj), nome: nova.nome.trim(), cidade: nova.cidade.trim(), uf: nova.uf } });
  };
  const campo = (chave: keyof TransportadoraNova) => ({ value: nova[chave], onChange: (evento: { target: { value: string } }) => setNova({ ...nova, [chave]: evento.target.value }) });
  return (
    <form className={estilos.cadastro} onSubmit={enviar} noValidate>
      <p className={estilos.nota}>O pedido vai, mas só entra no SGI depois que vendas cadastrar a transportadora no ERP. Ele segue sozinho quando ela aparecer.</p>
      <label className={estilos.campoRotulado}>
        CNPJ
        <input className={estilos.campo} inputMode="numeric" autoComplete="off" maxLength={18} {...campo("cnpj")} onBlur={() => setNova({ ...nova, cnpj: formatarCnpj(nova.cnpj) })} />
      </label>
      {tentou && !cnpjValido ? <p className={estilos.erro}>Confira o CNPJ: os números não fecham.</p> : null}
      {existente ? (
        <p className={estilos.nota}>
          Essa já está no ERP: <strong>{existente.nome}</strong>, {existente.cidade}/{existente.uf}.{" "}
          <button type="button" className={estilos.link} onClick={() => aoEscolher({ codigo: existente.codigo })}>
            Usar esta
          </button>
        </p>
      ) : null}
      <label className={estilos.campoRotulado}>
        Nome
        <input className={estilos.campo} maxLength={60} autoComplete="off" {...campo("nome")} />
      </label>
      <div className={estilos.cidadeEUf}>
        <label className={estilos.campoRotulado}>
          Cidade
          <input className={estilos.campo} maxLength={40} autoComplete="off" {...campo("cidade")} />
        </label>
        <label className={estilos.campoRotulado}>
          UF
          <select className={estilos.campo} {...campo("uf")}>
            <option value="" />
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </label>
      </div>
      {tentou && !pronta && !existente ? <p className={estilos.erro}>Preencha o CNPJ, o nome, a cidade e a UF.</p> : null}
      <div className={estilos.acoes}>
        <button type="button" className={botoes.secundario} onClick={aoVoltar}>
          Voltar à lista
        </button>
        <button type="submit" className={botoes.primario}>
          Usar esta transportadora
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- pagamento

function LinhaDoPagamento({ dados, codigo, aoEscolher }: { dados: DadosDoPedido; codigo: string; aoEscolher: (codigo: string) => void }) {
  const [aberta, setAberta] = useState(false);
  const descricao = dados.condicoes.find((condicao) => condicao.codigo === codigo)?.descricao ?? codigo;
  return (
    <Linha rotulo="Pagamento" origem={origemDoPagamento(dados, codigo)}>
      <BotaoDeEscolha texto={descricao} vazio="Escolher" aoAbrir={() => setAberta(true)} />
      <Janela titulo="Condição de pagamento" icone={<Wallet size={20} aria-hidden="true" />} aberta={aberta} aoFechar={() => setAberta(false)}>
        {aberta ? (
          <EscolhaDoPagamento
            dados={dados}
            codigo={codigo}
            aoEscolher={(novo) => {
              aoEscolher(novo);
              setAberta(false);
            }}
          />
        ) : null}
      </Janela>
    </Linha>
  );
}

function origemDoPagamento(dados: DadosDoPedido, codigo: string): ReactNode {
  if (codigo === dados.condicaoDoCadastro) return "A do cadastro do cliente.";
  return <span className={estilos.alerta}>Diferente da do cadastro: vai para a aprovação de vendas.</span>;
}

function EscolhaDoPagamento({ dados, codigo, aoEscolher }: { dados: DadosDoPedido; codigo: string; aoEscolher: (codigo: string) => void }) {
  const [busca, setBusca] = useState("");
  const descricaoDe = (valor: string) => dados.condicoes.find((condicao) => condicao.codigo === valor)?.descricao ?? valor;
  const usadas = frequencias(dados.condicoesUsadas);
  const termo = normalizarParaBusca(busca.trim());
  const achadas = termo ? dados.condicoes.filter((condicao) => normalizarParaBusca(`${condicao.descricao} ${condicao.codigo}`).includes(termo)).slice(0, MAXIMO_NA_BUSCA) : dados.condicoes.slice(0, MAXIMO_NA_BUSCA);
  const doCadastro = (valor: string) => (valor === dados.condicaoDoCadastro ? "do cadastro" : null);
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
        <CampoDeBusca rotulo="Buscar condição" valor={busca} dica="Prazo, como 30/60" aoMudar={setBusca} className={estilos.busca} />
        {achadas.map((condicao) => (
          <Opcao key={condicao.codigo} titulo={condicao.descricao} detalhe={doCadastro(condicao.codigo)} escolhida={condicao.codigo === codigo} aoEscolher={() => aoEscolher(condicao.codigo)} />
        ))}
      </Secao>
    </>
  );
}

// ---------------------------------------------------------------- entrega, classificação e parcial

/** "Assim que possível" é 5 dias úteis depois de hoje; a programada, qualquer data a partir daí (Lucas, 2026-11-17). */
function LinhaDaEntrega({ entrega, aoMudar, primeiraEntrega }: { entrega: string | null; aoMudar: (entrega: string | null) => void; primeiraEntrega: string }) {
  const programada = entrega !== null;
  return (
    <Linha
      rotulo="Entrega"
      origem={programada ? `Programada: a partir de ${formatarDataCurta(primeiraEntrega)}.` : `A partir de ${formatarDataCurta(primeiraEntrega)}, 5 dias úteis depois de hoje.`}
    >
      <div className={estilos.entrega}>
        <Segmentos
          rotulo="Tipo de entrega"
          opcoes={[
            { valor: "logo", rotulo: "Assim que possível" },
            { valor: "programada", rotulo: "Programada" },
          ]}
          selecionado={programada ? "programada" : "logo"}
          aoEscolher={(valor) => aoMudar(valor === "logo" ? null : primeiraEntrega)}
        />
        {programada ? (
          <input
            className={estilos.campo}
            type="date"
            min={primeiraEntrega}
            value={entrega}
            aria-label="Data da entrega programada"
            onChange={(evento) => aoMudar(evento.target.value || primeiraEntrega)}
          />
        ) : null}
      </div>
    </Linha>
  );
}

function origemDaClassificacao(dados: DadosDoPedido, classificacao: Classificacao): string | null {
  const vezes = vezesQueOClienteEscolheu(dados.classificacoesUsadas, classificacao);
  return vezes ? `Como ${vezes}.` : null;
}

function origemDoParcial(dados: DadosDoPedido, aceita: boolean): string | null {
  const usos = [
    { valor: "sim", pedidos: dados.parcialUsado.aceita },
    { valor: "nao", pedidos: dados.parcialUsado.naoAceita },
  ];
  const vezes = vezesQueOClienteEscolheu(usos, aceita ? "sim" : "nao");
  return vezes ? `Como ${vezes}.` : null;
}

// ---------------------------------------------------------------- lista que abre

function Janela({ titulo, icone, aberta, aoFechar, children }: { titulo: string; icone: ReactNode; aberta: boolean; aoFechar: () => void; children: ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberta && !elemento.open) elemento.showModal();
    if (!aberta && elemento.open) elemento.close();
  }, [aberta]);
  return (
    <dialog ref={dialogo} className={estilos.janela} onClose={aoFechar} aria-label={titulo}>
      <div className={estilos.cabecalhoDaJanela}>
        <h2 className={estilos.tituloDaJanela}>
          {icone}
          {titulo}
        </h2>
        <button type="button" className={botoes.secundario} onClick={aoFechar}>
          Fechar
        </button>
      </div>
      <div className={estilos.conteudoDaJanela}>{children}</div>
    </dialog>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className={estilos.secao}>
      <h3 className={estilos.tituloDaSecao}>{titulo}</h3>
      {children}
    </section>
  );
}

type PropsDaOpcao = { titulo: string; detalhe: string | null; frequencia?: Frequencia; escolhida: boolean; aoEscolher: () => void };

/** Uma opção da lista; com a frequência, a barra mostra a fatia dos pedidos do cliente: "98% · 49 pedidos". */
function Opcao({ titulo, detalhe, frequencia, escolhida, aoEscolher }: PropsDaOpcao) {
  return (
    <button type="button" className={estilos.opcao} aria-pressed={escolhida} onClick={aoEscolher}>
      <span className={estilos.textoDaOpcao}>
        <span className={estilos.tituloDaOpcao}>{titulo}</span>
        {detalhe ? <span className={estilos.detalheDaOpcao}>{detalhe}</span> : null}
      </span>
      {frequencia ? (
        <span className={estilos.frequencia}>
          <span className={estilos.parte}>{formatarParte(frequencia.parte)}</span>
          <span className={estilos.pedidos}>{frequencia.pedidos === 1 ? "1 pedido" : `${frequencia.pedidos} pedidos`}</span>
          <span className={estilos.barra} aria-hidden="true">
            <span className={estilos.preenchimento} style={{ inlineSize: `${Math.max(frequencia.parte * 100, 2)}%` }} />
          </span>
        </span>
      ) : null}
      {escolhida ? <Check size={18} className={estilos.marca} aria-label="escolhida" /> : null}
    </button>
  );
}
