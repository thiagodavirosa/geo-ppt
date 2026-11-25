import type { Mapa } from "./esquema";

/** Textos editáveis de um mapa, como pares [objeto, chave]. */
function textos(m: Mapa): [Record<string | number, any>, string | number][] {
  const out: [Record<string | number, any>, string | number][] = [[m, "titulo"]];
  for (const it of [...m.trechos, ...m.pontos]) { out.push([it.caixa, "prefixo"]); out.push([it.caixa, "extra"]); }
  for (const p of m.pontos) out.push([p, "nome"]);
  for (const c of m.tabela.colunas) out.push([c, "nome"]);
  for (const l of m.tabela.linhas) l.forEach((_, i) => out.push([l, i]));
  return out;
}
const re = (termo: string, maiusculas: boolean) => new RegExp(termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), maiusculas ? "g" : "gi");

/** Conta ocorrências do termo nos textos do mapa (caixas, pontos, tabela, título). */
export function contar(m: Mapa, termo: string, maiusculas = false): number {
  if (!termo) return 0;
  const r = re(termo, maiusculas);
  return textos(m).reduce((n, [o, k]) => n + (String(o[k] ?? "").match(r)?.length || 0), 0);
}

/** Substitui e devolve o número de trocas. */
export function substituir(m: Mapa, de: string, para: string, maiusculas = false): number {
  if (!de) return 0;
  const r = re(de, maiusculas);
  let n = 0;
  for (const [o, k] of textos(m)) {
    const v = String(o[k] ?? ""), c = v.match(r)?.length || 0;
    if (c) { o[k] = v.replace(r, () => para); n += c; }
  }
  return n;
}
