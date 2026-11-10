import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** A API do CRM do server/: a de sempre, e a do teste na rede interna (server/src/configuracao.ts), com app.db só dela. */
const API = "http://127.0.0.1:5176";
const API_DA_REDE_INTERNA = "http://127.0.0.1:5186";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    // CSP estrita: nenhum recurso embutido como data: URI no bundle.
    assetsInlineLimit: 0,
  },
  server: {
    // Só nesta máquina: o servidor de desenvolvimento nunca fica exposto na rede.
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    // Modo "real": a API do servidor (server/), também só nesta máquina.
    proxy: { "/api": API },
  },
  // O site montado que o iniciar-crm-servidor.bat serve na rede interna; a API continua só nesta máquina.
  preview: {
    proxy: { "/api": mode === "rede-interna" ? API_DA_REDE_INTERNA : API },
  },
}));
