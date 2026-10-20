import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { formatarCompacto, formatarReais, formatarReaisComCentavos, formatarReaisCompacto } from "../formato";

type Valores = {
  visiveis: boolean;
  alternar: () => void;
};

const ContextoValores = createContext<Valores | null>(null);

export const VALOR_OCULTO = "R$ ••••";

/**
 * Os valores em R$ começam sempre ocultos e a escolha não é lembrada entre sessões,
 * para o representante poder abrir o CRM ao lado do cliente (regra aprovada no protótipo).
 */
export function ProvedorValores({ children }: { children: ReactNode }) {
  const [visiveis, setVisiveis] = useState(false);
  const alternar = useCallback(() => setVisiveis((anterior) => !anterior), []);
  const valores = useMemo(() => ({ visiveis, alternar }), [visiveis, alternar]);
  return <ContextoValores value={valores}>{children}</ContextoValores>;
}

export function useValores(): Valores {
  const valores = useContext(ContextoValores);
  if (!valores) throw new Error("useValores fora do ProvedorValores");
  return valores;
}

/** Formatadores que respeitam o "ocultar valores", para gráficos e textos montados. */
export function useFormatoDeReais() {
  const { visiveis } = useValores();
  return useMemo(
    () => ({
      reais: (valor: number) => (visiveis ? formatarReais(valor) : VALOR_OCULTO),
      reaisComCentavos: (valor: number) => (visiveis ? formatarReaisComCentavos(valor) : VALOR_OCULTO),
      reaisCompacto: (valor: number) => (visiveis ? formatarReaisCompacto(valor) : VALOR_OCULTO),
      eixo: (valor: number) => (visiveis ? formatarCompacto(valor) : ""),
    }),
    [visiveis],
  );
}
