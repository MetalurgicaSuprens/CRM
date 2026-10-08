import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Layout } from "./componentes/Layout";
import { Analises } from "./paginas/Analises";
import { Clientes } from "./paginas/Clientes";
import { Convite } from "./paginas/Convite";
import { DetalheDoPedido } from "./paginas/DetalheDoPedido";
import { EmPreparacao } from "./paginas/EmPreparacao";
import { Entrar } from "./paginas/Entrar";
import { MontarPedido } from "./paginas/MontarPedido";
import { Pedidos } from "./paginas/Pedidos";
import { FichaCliente } from "./paginas/FichaCliente";
import { Inicio } from "./paginas/Inicio";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="entrar" element={<Entrar />} />
        <Route path="convite" element={<Convite />} />
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="clientes/:codigo" element={<FichaCliente />} />
          <Route path="analises" element={<Analises />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="pedidos/novo" element={<MontarPedido />} />
          <Route path="pedidos/rascunhos/:id" element={<MontarPedido />} />
          <Route path="pedidos/:numero" element={<DetalheDoPedido />} />
          <Route path="mapa" element={<EmPreparacao titulo="Mapa" etapa="quando o mapa for portado do protótipo antigo (F6)" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
