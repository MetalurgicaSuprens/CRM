import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
 * A administração: um site à parte, com a entrada em web/admin, que nunca vai junto com o do CRM
 * (vite.config.ts) e nunca fica na internet. Roda sempre no modo "real" (--mode real), porque não tem
 * dados fictícios: neste computador, http://localhost:5179, com a API dela em 127.0.0.1:5178
 * (server/src/admin).
 */
export default defineConfig({
  root: fileURLToPath(new URL("./admin", import.meta.url)),
  // A marca e o ícone são os do CRM.
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./dist-admin", import.meta.url)),
    emptyOutDir: true,
    // CSP estrita: nenhum recurso embutido como data: URI no bundle.
    assetsInlineLimit: 0,
  },
  server: {
    // Só nesta máquina, como o do CRM.
    host: "127.0.0.1",
    port: 5179,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:5178" },
  },
});
