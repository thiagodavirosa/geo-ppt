import { describe, expect, it } from "vitest";
import {
  adicionarPonto, adicionarTrecho, aplicarTema, comprimento, contar, feicoesVisiveis, geometriaTrecho, instanciarModelo, instantaneo,
  MODELOS, idsModelos, nomeBr, chaveBr, preencherTabela, restaurar, substituir, TEMAS, validar, verificar, camadaDoCatalogo, type Dados,
} from "../src";

const demo = () => instanciarModelo("demo");
const sem: Dados = {};

describe("esquema geo-ppt/1.0", () => {
  it("todos os modelos são fontes válidas e instanciam com id novo", () => {
    for (const id of idsModelos()) {
      const m = instanciarModelo(id, "RR");
      expect(m.schema).toBe("geo-ppt/1.0");
      expect(m.id).not.toBe(`modelo-${id}`);
      expect(m.revisao).toBe(1);
      if (id !== "demo" && id !== "branco") expect(m.enquadramento.valor).toBe("RR");
      expect(validar(JSON.parse(JSON.stringify(m))).id).toBe(m.id);
    }
    expect(MODELOS.length).toBe(5);
  });
  it("recusa versão mais nova e fonte estranha; aponta o campo inválido", () => {
    const m = demo();
    expect(() => validar({ ...m, schema: "geo-ppt/2.0" })).toThrow(/mais nova/);
    expect(() => validar({ foo: 1 })).toThrow(/Não é uma fonte/);
    expect(() => validar({ ...m, tela: { ...m.tela, largura: 10 } })).toThrow(/tela\.largura/);
  });
});

describe("trechos por km", () => {
  it("extensão exibida = km final − km inicial, com recorte proporcional", () => {
    const m = demo(), t = adicionarTrecho(m, sem, "319", "AM")!;
    t.kmIni = 100; t.kmFim = 250;
    const g = geometriaTrecho(m, sem, t);
    expect(g.porCampos).toBe(true);
    expect(g.extensao).toBeCloseTo(150, 2);
    expect(Math.abs(comprimento(g.pedacos) - 150)).toBeLessThan(3);
    expect(g.ancora).toBeTruthy();
  });
  it("km invertido é normalizado; adicionarTrecho usa a faixa completa", () => {
    const m = demo(), t = adicionarTrecho(m, sem, "174", "AM")!;
    expect(t.kmIni).toBe(0);
    expect(t.kmFim).toBeGreaterThan(200);
    t.kmIni = 80; t.kmFim = 20;
    expect(geometriaTrecho(m, sem, t).extensao).toBeCloseTo(60, 2);
  });
  it("tabela preenchida a partir dos trechos", () => {
    const m = demo(); m.tabela.linhas = [];
    preencherTabela(m, sem);
    expect(m.tabela.linhas[0][0]).toBe("BR-174");
    expect(m.tabela.linhas[1][3]).toMatch(/km$/);
  });
});

describe("pontos, municípios e tema", () => {
  it("ponto novo é círculo com as cores dos trechos", () => {
    const p = adicionarPonto(demo(), -61, -4);
    expect(p.simbolo).toBe("circulo");
    expect(p.cor).toBe("#9813ad");
    expect(p.caixa.fundo).toBe("#173f73");
  });
  it("municípios: só principais (capital + N maiores) e modo ponto/polígono", () => {
    const c = camadaDoCatalogo("ibge-mun");
    const sq = (x: number) => ({ tipo: "poligono" as const, partes: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 0]] as [number, number][]] });
    const fs = [1, 2, 3, 4].map((i) => ({ geom: sq(i), pt: { tipo: "ponto" as const, partes: [[[i + 0.5, 0.3] as [number, number]]] },
      props: { nome: `M${i}`, capital: i === 4 ? "sim" : "não", rank: i } }));
    const dados = { "ibge-mun": fs };
    c.municipios!.principais = 2;
    expect(feicoesVisiveis(c, dados).map((f) => f.props.nome)).toEqual(["M1", "M2", "M4"]);
    expect(feicoesVisiveis(c, dados)[0].geom.tipo).toBe("ponto");
    c.municipios!.modo = "poligono"; c.municipios!.soPrincipais = false;
    expect(feicoesVisiveis(c, dados)).toHaveLength(4);
    expect(feicoesVisiveis(c, dados)[0].geom.tipo).toBe("poligono");
  });
  it("tema altera trechos, pontos, caixas e tabela", () => {
    const m = demo(); adicionarPonto(m, -60, -3);
    expect(aplicarTema(m, "cinza")).toBe(true);
    expect(m.trechos[0].cor).toBe(TEMAS.cinza.trecho);
    expect(m.pontos[0].caixa.fundo).toBe(TEMAS.cinza.caixa.fundo);
    expect(m.tabela.estilo.cabecalhoFundo).toBe(TEMAS.cinza.tabela.cabecalhoFundo);
    expect(aplicarTema(m, "nao-existe")).toBe(false);
  });
});

describe("lote, desfazer e verificar", () => {
  it("localizar/substituir conta antes e troca em caixas, pontos e tabela", () => {
    const m = demo(); m.trechos[0].caixa.extra = "Contrato 00 00738/2023";
    adicionarPonto(m, -60, -3, "Ponte do Contrato");
    m.tabela.linhas = [["BR-174", "Contrato X", "", "", ""]];
    // caixa, ponto, célula e o título da coluna "Contrato"
    expect(contar(m, "contrato")).toBe(4);
    expect(contar(m, "contrato", true)).toBe(0);
    expect(substituir(m, "Contrato", "TC")).toBe(4);
    expect(m.trechos[0].caixa.extra).toBe("TC 00 00738/2023");
  });
  it("instantâneo/restaurar compartilha feições por referência", () => {
    const m = demo(), fs = m.camadas[0].feicoes;
    const s = instantaneo(m);
    m.tela.largura = 999; m.trechos = [];
    const r = restaurar(s);
    expect(r.tela.largura).toBe(1280);
    expect(r.trechos).toHaveLength(2);
    expect(r.camadas[0].feicoes).toBe(fs);
  });
  it("verificar aponta trecho sem geometria e caixa ilegível", () => {
    const m = demo(); m.trechos[0].kmIni = 9000; m.trechos[0].kmFim = 9100; m.trechos[1].caixa.texto = "#173f73";
    const a = verificar(m, sem).map((x) => x.texto).join("\n");
    expect(a).toMatch(/nenhuma geometria/);
    expect(a).toMatch(/contraste/);
    expect(verificar(instanciarModelo("demo"), sem).filter((x) => x.nivel === "erro")).toHaveLength(0);
  });
  it("utilitários de BR", () => {
    expect(nomeBr("319")).toBe("BR-319");
    expect(nomeBr("br 20")).toBe("BR-020");
    expect(chaveBr("BR-010")).toBe("10");
  });
});
