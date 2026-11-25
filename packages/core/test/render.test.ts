import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { calcularLayout, definirAjuste, deslocar, instanciarModelo, medirTexto, quebrarTexto, renderSvg, type Dados } from "../src";

const sem: Dados = {};
const xmlOk = (s: string) => { const erros: string[] = []; new DOMParser({ onError: (_n: string, m: string) => erros.push(m) } as any).parseFromString(s, "image/svg+xml"); return erros; };

describe("renderSvg", () => {
  it("gera SVG bem formado com camadas, trechos, caixas e tabela", () => {
    const svg = renderSvg(instanciarModelo("demo"), sem);
    expect(xmlOk(svg)).toEqual([]);
    expect(svg).toMatch(/^<svg [^>]*width="1280" height="620"/);
    expect(svg).toContain('data-trecho="tr-174"');
    expect(svg).toContain("Rodovia: BR-174/AM");
    expect(svg).toContain("Pavimentação do “trecho"); // coluna Tipo (170 px) quebra a linha
    expect(svg).toContain('clip-path="url(#g-recorte)"');
  });
  it("sem sombras quando desligadas; fundo opcional", () => {
    const m = instanciarModelo("demo");
    m.enquadramento.sombra.ativa = false; m.tabela.estilo.sombra = false; m.trechos.forEach((t) => (t.caixa.sombra = false));
    m.tela.transparente = false; m.tela.fundo = "#fafafa";
    const svg = renderSvg(m, sem);
    expect(svg).not.toContain("url(#g-sombra)");
    expect(svg).not.toContain("url(#g-scx)");
    expect(svg).not.toContain("url(#g-stb)");
    expect(svg).toContain('fill="#fafafa"');
  });
  it("caixas automáticas não sobrepõem a tabela e ficam no elemento", () => {
    const m = instanciarModelo("demo"), L = calcularLayout(m, sem), T = L.tabela!;
    expect(L.caixas).toHaveLength(2);
    for (const c of L.caixas) {
      expect(c.x >= 0 && c.y >= 0 && c.x + c.w <= 1280 && c.y + c.h <= 620).toBe(true);
      const sobre = c.x < T.x + T.w && c.x + c.w > T.x && c.y < T.y + T.h && c.y + c.h > T.y;
      expect(sobre).toBe(false);
      expect(m.trechos.find((t) => t.id === c.id)!.caixa.dx).not.toBe(null);
    }
  });
  it("ajuste fixo mantém a escala ao redimensionar; auto reajusta", () => {
    const m = instanciarModelo("demo");
    const k0 = calcularLayout(m, sem).P.k;
    definirAjuste(m, sem, "fixo");
    m.tela.largura = 1800;
    expect(calcularLayout(m, sem).P.k).toBeCloseTo(k0, 6);
    definirAjuste(m, sem, "auto"); m.tela.largura = 640;
    expect(calcularLayout(m, sem).P.k).toBeLessThan(k0);
    const x0 = calcularLayout(m, sem).P.ox; deslocar(m, 30, 0);
    expect(calcularLayout(m, sem).P.ox).toBeCloseTo(x0 + 30, 6);
  });
  it("medição e quebra de texto", () => {
    expect(medirTexto("BR-319", 10)).toBeCloseTo(33.9, 1); // B667 R722 -333 3 556 1 556 9 556
    expect(medirTexto("Ação", 10)).toBeCloseTo(medirTexto("Acao", 10), 6);
    expect(quebrarTexto("Restauração e Adequação de Capacidade", 13, 120).length).toBeGreaterThan(1);
    expect(quebrarTexto("a\nb", 13, 0)).toEqual(["a", "b"]);
  });
});
