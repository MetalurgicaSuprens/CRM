import { useCallback, useEffect, useRef, useState } from "react";
import { salvarCotacao } from "../../dados/api";
import type { EscolhasDoPedido, ItemDoPedido, Cotacao, CotacaoParaSalvar } from "../../dados/tipos";
import { mensagemDo } from "./mensagemDo";

/** Tempo sem mexer no pedido até a cotação ser salva. */
const ESPERA_PARA_SALVAR_MS = 700;

export type ConteudoDoPedido = Omit<CotacaoParaSalvar, "id">;

/** O que vai para o servidor: a mesma ordem de chaves sempre, para comparar com o que já foi salvo. */
export function conteudoDoPedido(
  codigoCliente: string,
  itens: readonly ItemDoPedido[],
  entrega: string | null,
  observacao: string,
  escolhas: EscolhasDoPedido | null,
): ConteudoDoPedido {
  return { codigoCliente, itens: itens.map(({ codigo, quantidade, precoCento, ordemDeCompra, itemDaOrdemDeCompra }) => ({ codigo, quantidade, precoCento, ordemDeCompra, itemDaOrdemDeCompra })), entrega, observacao, escolhas };
}

/**
 * Salva a cotação sozinha, um pouco depois da última mudança e, na hora, quando a página fecha, sai da
 * tela ou o representante vai para outra tela: o pedido sobrevive ao computador desligar (pedido do
 * Lucas em 2026-11-05). Só começa quando há o que guardar: abrir um pedido novo e sair sem escolher nada
 * não deixa cotação vazia. O id vem do endereço, então salvar de novo nunca duplica.
 */
export function useCotacaoAutomatica(id: string, inicial: Cotacao | null, conteudo: ConteudoDoPedido) {
  const [existe, setExiste] = useState(inicial !== null);
  const [salvoEm, setSalvoEm] = useState(inicial?.atualizadoEm ?? null);
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null);
  const conteudoAtual = JSON.stringify(conteudo);
  const ultimoSalvo = useRef(inicial ? JSON.stringify(conteudoDoPedido(inicial.cliente.codigo, inicial.itens, inicial.entrega, inicial.observacao, inicial.escolhas)) : conteudoAtual);
  const parado = useRef(false);
  const temOQueGuardar = existe || conteudo.itens.length > 0;

  const salvarAgora = useCallback(async () => {
    const cotacao = await salvarCotacao({ id, ...conteudo });
    ultimoSalvo.current = conteudoAtual;
    setExiste(true);
    setSalvoEm(cotacao.atualizadoEm);
    setErroAoSalvar(null);
    return cotacao;
  }, [id, conteudo, conteudoAtual]);

  useEffect(() => {
    if (parado.current || conteudoAtual === ultimoSalvo.current || !temOQueGuardar) return;
    const espera = window.setTimeout(() => salvarAgora().catch((erro: unknown) => setErroAoSalvar(mensagemDo(erro))), ESPERA_PARA_SALVAR_MS);
    return () => window.clearTimeout(espera);
  }, [conteudoAtual, temOQueGuardar, salvarAgora]);

  // O que ainda não foi salvo, para mandar de uma vez quando a página sai; null quando não há nada.
  const pendente = useRef<(() => void) | null>(null);
  useEffect(() => {
    pendente.current =
      conteudoAtual === ultimoSalvo.current || !temOQueGuardar
        ? null
        : () => {
            ultimoSalvo.current = conteudoAtual;
            // A página já está saindo: o erro não teria onde aparecer, e o salvamento normal mostra os dele.
            salvarCotacao({ id, ...conteudo }, { aoSairDaPagina: true }).catch(() => undefined);
          };
  });
  useEffect(() => {
    const salvarJa = () => {
      if (!parado.current) pendente.current?.();
    };
    const aoMudarDeVisibilidade = () => {
      if (document.visibilityState === "hidden") salvarJa();
    };
    window.addEventListener("pagehide", salvarJa);
    document.addEventListener("visibilitychange", aoMudarDeVisibilidade);
    return () => {
      salvarJa();
      window.removeEventListener("pagehide", salvarJa);
      document.removeEventListener("visibilitychange", aoMudarDeVisibilidade);
    };
  }, []);

  /** Depois de enviar ou descartar, a cotação não é salva de novo. */
  const pararDeSalvar = useCallback(() => {
    parado.current = true;
  }, []);

  return { existe, salvoEm, erroAoSalvar, salvarAgora, pararDeSalvar };
}
