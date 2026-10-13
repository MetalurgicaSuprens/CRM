import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
    proxy: { "/api": "http://127.0.0.1:5176" },
  },
});
