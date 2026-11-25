import type { Dados, Mapa } from "./esquema";
import { calcularLayout } from "./render";
import { feicoesDe, camada } from "./mapa";
import { nomeBr } from "./util";

export interface Alerta { nivel: "erro" | "aviso"; texto: string }

/** Luminância relativa (WCAG) de #rrggbb. */
function lum(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
export const contraste = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/** Verificações do mapa (aba Verificar). Com `dados`, verifica também geometria e posições. */
export function verificar(m: Mapa, dados?: Dados): Alerta[] {
  const a: Alerta[] = [];
  if (!m.titulo.trim() || m.titulo === "Mapa") a.push({ nivel: "aviso", texto: "Mapa sem título próprio (aparece na lista e no texto alternativo)." });
  if (!m.enquadramento.valor) a.push({ nivel: "erro", texto: "Nenhuma UF/feição de enquadramento escolhida." });
  for (const it of [...m.trechos, ...m.pontos]) {
    const c = it.caixa, nome = "br" in it ? nomeBr(it.br) : it.nome;
    if (contraste(c.fundo, c.texto) < 4.5) a.push({ nivel: "aviso", texto: `Caixa de ${nome}: contraste texto/fundo baixo (${contraste(c.fundo, c.texto).toFixed(1)}:1).` });
  }
  if (m.tabela.visivel && !m.tabela.linhas.some((l) => l.some((x) => x.trim()))) a.push({ nivel: "aviso", texto: "Tabela visível mas vazia." });
  for (const c of m.camadas) if (c.feicoes && c.feicoes.length > 20000) a.push({ nivel: "aviso", texto: `Camada "${c.nome}" tem ${c.feicoes.length} feições gravadas: a apresentação fica pesada.` });
  if (dados) {
    const rod = camada(m, m.rodovias.camadaId);
    if (m.trechos.length && !feicoesDe(rod, dados).length) a.push({ nivel: "erro", texto: "Há trechos, mas a camada de rodovias está vazia ou indisponível." });
    const L = calcularLayout(m, dados);
    for (const t of m.trechos) {
      const g = L.geoTrechos.get(t.id);
      if (!g?.pedacos.length) a.push({ nivel: "erro", texto: `${nomeBr(t.br)}${t.uf ? "/" + t.uf : ""}: nenhuma geometria entre km ${t.kmIni} e ${t.kmFim}.` });
      else if (g.faixa && (Math.min(t.kmIni, t.kmFim) < g.faixa[0] - 0.05 || Math.max(t.kmIni, t.kmFim) > g.faixa[1] + 0.05))
        a.push({ nivel: "aviso", texto: `${nomeBr(t.br)}: faixa pedida (km ${t.kmIni}–${t.kmFim}) passa da disponível (km ${g.faixa[0]}–${g.faixa[1]}).` });
      if (g?.pedacos.length && !L.caixas.some((c) => c.id === t.id)) a.push({ nivel: "aviso", texto: `${nomeBr(t.br)}: a âncora da caixa está fora do elemento (caixa não exibida).` });
    }
    for (const p of m.pontos) if (!L.caixas.some((c) => c.id === p.id)) a.push({ nivel: "aviso", texto: `${p.nome}: fora do elemento (caixa não exibida).` });
    const W = m.tela.largura, H = m.tela.altura;
    for (const c of L.caixas) if (c.x < 0 || c.y < 0 || c.x + c.w > W || c.y + c.h > H) a.push({ nivel: "aviso", texto: `Caixa "${c.linhas[0].t}" ultrapassa a borda do elemento.` });
  }
  return a;
}
