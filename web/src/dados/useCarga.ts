import { useEffect, useState } from "react";

type Carga<T> = { dados: T | null; carregando: boolean; erro: Error | null };

type Estado<T> = { chave: string; dados: T | null; erro: Error | null };

const emCache = new Map<string, unknown>();

/**
 * Busca os dados de uma tela pela chave. Mostra o que já está em memória enquanto busca de novo
 * e nunca devolve os dados de outra chave (ex.: a ficha do cliente anterior).
 */
export function useCarga<T>(chave: string, buscar: () => Promise<T>): Carga<T> {
  const [estado, setEstado] = useState<Estado<T>>(() => ({ chave, dados: lerCache<T>(chave), erro: null }));

  useEffect(() => {
    let atual = true;
    buscar().then(
      (dados) => {
        emCache.set(chave, dados);
        if (atual) setEstado({ chave, dados, erro: null });
      },
      (erro: unknown) => {
        if (atual) setEstado({ chave, dados: lerCache<T>(chave), erro: erro instanceof Error ? erro : new Error(String(erro)) });
      },
    );
    return () => {
      atual = false;
    };
    // Só a chave identifica a consulta: `buscar` é recriada a cada render.
  }, [chave]);

  const mesmaChave = estado.chave === chave;
  const erro = mesmaChave ? estado.erro : null;
  return {
    dados: mesmaChave ? estado.dados : lerCache<T>(chave),
    carregando: !emCache.has(chave) && erro === null,
    erro,
  };
}

function lerCache<T>(chave: string): T | null {
  return emCache.has(chave) ? (emCache.get(chave) as T) : null;
}
