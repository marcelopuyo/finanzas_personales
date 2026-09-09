"use server";

import { getAllCategoriasGasto } from "@/backend/src/queries/gastos";

export async function fetchCategoriasGasto() {
  const cats = await getAllCategoriasGasto();
  return cats.map((c) => ({ value: c.nombre, label: c.nombre }));
}
