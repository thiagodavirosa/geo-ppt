/** Utilidades puras (sem DOM). */
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Converte texto/número (aceita vírgula) em número; devolve `padrao` se inválido. */
export function num(v: unknown, padrao = 0): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

export const fmt = (n: number, casas = 1) =>
  Number(n).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** "319", "BR-319", 319 -> "319"; outros textos -> maiúsculas. */
export function chaveBr(v: unknown): string {
  const s = String(v ?? "").trim();
  const d = s.replace(/\D/g, "");
  return d ? String(Number(d)) : s.toUpperCase();
}

/** "319" -> "BR-319"; "20" -> "BR-020". */
export function nomeBr(v: unknown): string {
  const k = chaveBr(v);
  return /^\d+$/.test(k) ? "BR-" + k.padStart(3, "0") : String(v ?? "");
}

export function novoId(prefixo = "map"): string {
  return `${prefixo}-${Math.random().toString(16).slice(2, 8)}`;
}

export function escXml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const nomeBase = (n: string) => n.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, "");
export const extensao = (n: string) => (n.split(".").pop() || "").toLowerCase();
