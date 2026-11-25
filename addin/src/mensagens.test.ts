import { describe, expect, it } from "vitest";
import { dividir, montador } from "./mensagens";
import { extrairDoAlt, extrairDoXml, paraAlt, paraXml, revisaoDoXml } from "./fonte";
import { instanciarModelo } from "@geo-ppt/core";

describe("mensagens e marcações da fonte", () => {
  it("mensagem curta vai inteira; longa em partes, remontada em qualquer ordem", () => {
    expect(dividir({ tipo: "pronto" })).toEqual(['{"tipo":"pronto"}']);
    const grande = { tipo: "abrir", fonte: { x: "a".repeat(100000) } };
    const partes = dividir(grande);
    expect(partes.length).toBe(4);
    let recebido: any = null;
    const m = montador((x) => (recebido = x));
    [partes[2], partes[0], partes[3], partes[1]].forEach(m);
    expect(recebido).toEqual(grande);
  });
  it("XML e texto alternativo guardam e devolvem a fonte compactada", () => {
    const f = instanciarModelo("demo"); f.revisao = 7;
    const xml = paraXml(f, "QUJD+/=");
    expect(extrairDoXml(xml)).toBe("QUJD+/=");
    expect(revisaoDoXml(xml)).toBe(7);
    const alt = paraAlt(f, "QUJD");
    expect(alt).toMatch(/^Demonstração .*BR-174, BR-319\. \[geo-ppt:v1:QUJD\]$/);
    expect(extrairDoAlt(alt)).toBe("QUJD");
    expect(extrairDoAlt(paraAlt(f, "x".repeat(40000)))).toBe(null);
  });
});
