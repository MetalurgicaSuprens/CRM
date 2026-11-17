import { useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import botoes from "../../componentes/Botao.module.css";
import { CampoDeBusca } from "../../componentes/CampoDeBusca";
import { digitosDoCnpj, formatarCnpj, frequencias, isCnpjValido, transportadoraDe, transportadoraDoCnpj, type Frequencia } from "../../dados/dadosDoPedido";
import type { DadosDoPedido, EscolhaDaTransportadora as Escolha, Transportadora, TransportadoraNova } from "../../dados/tipos";
import { normalizarParaBusca } from "../../formato";
import estilos from "./EscolhaDaTransportadora.module.css";
import { Opcao, Secao } from "./Janela";

/*
 * A lista da transportadora: no alto, as que o cliente já usou, com a fatia dos pedidos; depois, as
 * que o representante mais usa com os outros clientes; por fim, a busca em todas as do ERP e o cadastro
 * de uma nova (pedido do Lucas em 2026-11-17).
 */

/** Na lista de todas, só aparece o que a busca acha: no ERP são centenas de transportadoras. */
const MAXIMO_NA_BUSCA = 30;
const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");

type Props = { dados: DadosDoPedido; escolha: Escolha | null; aoEscolher: (escolha: Escolha) => void };

export function EscolhaDaTransportadora({ dados, escolha, aoEscolher }: Props) {
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
        <CampoDeBusca rotulo="Buscar transportadora" valor={busca} dica="Nome, cidade ou CNPJ" aoMudar={setBusca} />
        {achadas.map((transportadora) => (
          <Opcao
            key={transportadora.codigo}
            titulo={transportadora.nome}
            detalhe={`${transportadora.cidade}/${transportadora.uf} · ${transportadora.cnpj}`}
            escolhida={transportadora.codigo === escolhida}
            aoEscolher={() => aoEscolher({ codigo: transportadora.codigo })}
          />
        ))}
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
  if (!termo) return [];
  const digitos = digitosDoCnpj(busca);
  const pelosDigitos = (transportadora: Transportadora) => digitos.length >= 4 && digitosDoCnpj(transportadora.cnpj).includes(digitos);
  return transportadoras
    .filter((transportadora) => normalizarParaBusca(`${transportadora.nome} ${transportadora.cidade}`).includes(termo) || pelosDigitos(transportadora))
    .slice(0, MAXIMO_NA_BUSCA);
}

type PropsDoCadastro = { dados: DadosDoPedido; aoVoltar: () => void; aoEscolher: (escolha: Escolha) => void };

/**
 * A transportadora que ainda não está no ERP: o representante informa o CNPJ, o nome e a cidade, e o
 * pedido espera vendas cadastrá-la (decisão do Lucas em 2026-11-17). O CNPJ que já está no ERP leva à de lá.
 */
function CadastroDeTransportadora({ dados, aoVoltar, aoEscolher }: PropsDoCadastro) {
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
