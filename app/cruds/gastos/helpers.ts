"use server";

import { getAllCategoriasGasto, getAllPeriodosGasto } from "@/backend/src/queries/gastos";

export async function fetchCategoriasGasto() {
  const cats = await getAllCategoriasGasto();
  return cats.map((c) => ({ value: c.nombre, label: c.nombre }));
}

export async function fetchPeriodosGasto() {
  const pers = await getAllPeriodosGasto();
  return pers.map((p) => ({ value: p.nombre, label: p.nombre }));
}
