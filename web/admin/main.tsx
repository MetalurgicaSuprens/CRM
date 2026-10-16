import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/estilos/global";
import { AppDoAdmin } from "../src/admin/AppDoAdmin";

/*
 * A entrada da administração (web/vite.admin.config.ts): um site à parte, que nunca vai junto com o
 * do CRM. As telas ficam em src/admin.
 */

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Elemento #raiz não encontrado no index.html");

createRoot(raiz).render(
  <StrictMode>
    <AppDoAdmin />
  </StrictMode>,
);
