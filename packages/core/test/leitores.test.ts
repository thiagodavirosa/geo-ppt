import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { DOMParser } from "@xmldom/xmldom";
import { lerArquivos, lerKml, lerZip, reprojetar, srcDoTexto } from "../src";

const fx = async (n: string) => {
  const b = await readFile(new URL(`./fixtures/${n}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

describe("leitores", () => {
  it("shapefile em ZIP (SIRGAS UTM 20S) vira graus, com acentos do DBF", async () => {
    const [r] = await lerArquivos([{ nome: "snv_utm20s.zip", buf: await fx("snv_utm20s.zip") }]);
    expect(r.feicoes).toHaveLength(3);
    const src = srcDoTexto(r.srcTexto)!;
    expect(src.rotulo).toMatch(/UTM 20S/);
    reprojetar(r.feicoes, src.fn!);
    const [lon, lat] = r.feicoes[0].geom.partes[0][0];
    expect(lon).toBeCloseTo(-60.02, 5);
    expect(lat).toBeCloseTo(-3.13, 5);
    expect(r.feicoes[0].props.nome).toBe("Trecho São João");
    expect(r.feicoes[2].props.nome).toBe("Ação");
    expect(r.feicoes[1].props.vl_km_fina).toBe(250);
    expect(r.feicoes[0].geom.tipo).toBe("linha");
  });

  it("GeoJSON em graus", async () => {
    const [r] = await lerArquivos([{ nome: "pontes.geojson", buf: await fx("pontes.geojson") }]);
    expect(r.feicoes[0].geom).toEqual({ tipo: "ponto", partes: [[[-61, -4]]] });
  });

  it("KMZ: extrai doc.kml e lê o polígono", async () => {
    const arqs = await lerZip(await fx("area.kmz"));
    const r = lerKml(new TextDecoder().decode(arqs["doc.kml"]), "area.kmz", DOMParser);
    expect(r.feicoes[0].geom.tipo).toBe("poligono");
    expect(r.feicoes[0].props.name).toBe("Área teste");
  });

  it("UTM 23S (EPSG:31983): ponto conferido com pyproj", () => {
    const [lon, lat] = srcDoTexto("EPSG:31983")!.fn!([191000, 8250000]);
    expect(lon).toBeCloseTo(-47.884317, 5);
    expect(lat).toBeCloseTo(-15.809647, 5);
  });

  it("projeção cônica é recusada; EPSG:4674 é graus", () => {
    expect(srcDoTexto('PROJCS["SIRGAS_2000_Albers",PROJECTION["Albers"]]')!.fn).toBe(undefined);
    expect(srcDoTexto("EPSG:4674")!.fn).toBe(null);
  });
});
