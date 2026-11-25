import type { Camada, Estilo, IdCatalogo } from "./esquema";

/** Tabelas de referência do IBGE. */
export const UFS: Record<string, [number, string]> = {
  RO: [11, "Rondônia"], AC: [12, "Acre"], AM: [13, "Amazonas"], RR: [14, "Roraima"], PA: [15, "Pará"], AP: [16, "Amapá"], TO: [17, "Tocantins"],
  MA: [21, "Maranhão"], PI: [22, "Piauí"], CE: [23, "Ceará"], RN: [24, "Rio Grande do Norte"], PB: [25, "Paraíba"], PE: [26, "Pernambuco"], AL: [27, "Alagoas"],
  SE: [28, "Sergipe"], BA: [29, "Bahia"], MG: [31, "Minas Gerais"], ES: [32, "Espírito Santo"], RJ: [33, "Rio de Janeiro"], SP: [35, "São Paulo"],
  PR: [41, "Paraná"], SC: [42, "Santa Catarina"], RS: [43, "Rio Grande do Sul"], MS: [50, "Mato Grosso do Sul"], MT: [51, "Mato Grosso"], GO: [52, "Goiás"], DF: [53, "Distrito Federal"],
};
export const CAPITAIS = new Set(["1100205", "1200401", "1302603", "1400100", "1501402", "1600303", "1721000", "2111300", "2211001", "2304400", "2408102", "2507507", "2611606",
  "2704302", "2800308", "2927408", "3106200", "3205309", "3304557", "3550308", "4106902", "4205407", "4314902", "5002704", "5103403", "5208707", "5300108"]);
/** Retângulos envolventes aproximados das UFs (reserva se a malha de estados não carregar). */
export const ENVELOPE_UF: Record<string, [number, number, number, number]> = {
  RO: [-66.9, -13.7, -59.7, -7.9], AC: [-74.0, -11.2, -66.5, -7.1], AM: [-73.8, -9.9, -56.0, 2.3], RR: [-64.9, -1.6, -58.8, 5.3],
  PA: [-58.9, -9.9, -46.0, 2.6], AP: [-54.9, -1.3, -49.8, 4.5], TO: [-50.8, -13.5, -45.7, -5.1], MA: [-48.8, -10.3, -41.8, -1.0],
  PI: [-46.0, -11.0, -40.4, -2.7], CE: [-41.5, -7.9, -37.2, -2.7], RN: [-38.6, -7.0, -34.9, -4.8], PB: [-38.8, -8.3, -34.8, -6.0],
  PE: [-41.4, -9.5, -34.8, -7.2], AL: [-38.3, -10.5, -35.1, -8.8], SE: [-38.3, -11.6, -36.4, -9.5], BA: [-46.7, -18.4, -37.3, -8.5],
  MG: [-51.1, -23.0, -39.8, -14.2], ES: [-41.9, -21.3, -39.6, -17.9], RJ: [-44.9, -23.4, -40.9, -20.7], SP: [-53.2, -25.4, -44.1, -19.7],
  PR: [-54.7, -26.8, -48.0, -22.5], SC: [-53.9, -29.4, -48.3, -25.9], RS: [-57.7, -33.8, -49.6, -27.0], MS: [-58.2, -24.1, -50.9, -17.1],
  MT: [-61.7, -18.1, -50.2, -7.3], GO: [-53.3, -19.5, -45.9, -12.3], DF: [-48.3, -16.1, -47.3, -15.5],
};
export const siglaPorCodigo = (c: string | number) => Object.keys(UFS).find((s) => String(UFS[s][0]) === String(c)) || "";
export const listaUfs = () => Object.keys(UFS).sort((a, b) => UFS[a][1].localeCompare(UFS[b][1], "pt-BR")).map((k) => ({ valor: k, texto: `${UFS[k][1]} (${k})` }));

const IBGE = "https://servicodados.ibge.gov.br/api";
export const urlsIbge = {
  estados: () => `${IBGE}/v3/malhas/paises/BR?intrarregiao=UF&formato=application/vnd.geo%2Bjson&qualidade=intermediaria`,
  municipiosMalha: (cod: number) => `${IBGE}/v3/malhas/estados/${cod}?intrarregiao=municipio&formato=application/vnd.geo%2Bjson&qualidade=intermediaria`,
  municipiosNomes: (cod: number) => `${IBGE}/v1/localidades/estados/${cod}/municipios`,
  /** População do Censo 2022 (agregado 4709, variável 93) por município da UF. */
  populacao: (cod: number) => `${IBGE}/v3/agregados/4709/periodos/2022/variaveis/93?localidades=N6[N3[${cod}]]`,
};

/** GeoServer do DNIT (o mesmo do VGeo). */
export const DNIT_WFS = "https://servicos.dnit.gov.br/dnitgeo/geoserver/ows";
export const urlsWfs = {
  capacidades: (url = DNIT_WFS) => `${url}?service=WFS&version=1.0.0&request=GetCapabilities`,
  feicoes: (tipo: string, bbox: number[], max: number, url = DNIT_WFS) =>
    `${url}?service=WFS&version=1.0.0&request=GetFeature&typeName=${encodeURIComponent(tipo)}&outputFormat=application/json`
    + `&srsName=EPSG:4674&bbox=${bbox.map((v) => v.toFixed(4)).join(",")}&maxFeatures=${max}`,
};

/** Escolhe a camada WFS por palavra-chave; com nomes datados, prefere a mais recente. */
export function escolherWfs(lista: { nome: string; titulo: string }[], inclui: RegExp, exclui?: RegExp): string {
  const m = lista.filter((x) => inclui.test(`${x.nome} ${x.titulo}`) && !(exclui && exclui.test(`${x.nome} ${x.titulo}`)));
  return m.sort((a, b) => b.nome.localeCompare(a.nome))[0]?.nome || "";
}

export const estiloPadrao = (p: Partial<Estilo> = {}): Estilo => ({
  preenchimento: "#ffffff", contorno: "#333333", opacidade: 1, espessura: 1.4, tamanho: 5,
  rotuloCampo: "", rotuloCor: "#333333", rotuloTamanho: 15, ...p,
});

export interface DefCatalogo {
  id: IdCatalogo; nome: string; tipo: Camada["tipo"]; escopo: "br" | "uf";
  estilo: Partial<Estilo>; wfs?: { inclui: RegExp; exclui?: RegExp; max: number };
}

/** Camadas pré-carregadas, na ordem de desenho (de baixo para cima). */
export const CATALOGO: DefCatalogo[] = [
  { id: "ibge-uf", nome: "IBGE · Estados", tipo: "poligono", escopo: "br", estilo: { preenchimento: "#d9d6ad", contorno: "#7b817c", espessura: 1.4 } },
  { id: "hidro", nome: "Hidrografia", tipo: "linha", escopo: "uf", estilo: { contorno: "#a9d3d4", espessura: 1.8 },
    wfs: { inclui: /drenagem|hidrograf|curso.?d.?agua/i, exclui: /massa|hidrovia|bacia/i, max: 4000 } },
  { id: "est", nome: "Malhas rodoviárias estaduais", tipo: "linha", escopo: "uf", estilo: { contorno: "#e2b48f", espessura: 1.1 },
    wfs: { inclui: /estadua/i, exclui: /unidade|limite|sede/i, max: 6000 } },
  { id: "snv", nome: "DNIT · SNV (rodovias federais)", tipo: "linha", escopo: "uf", estilo: { contorno: "#d9a181", espessura: 1.7 },
    wfs: { inclui: /snv/i, exclui: /hidrovia|porto|aqua|ferro|eclusa/i, max: 6000 } },
  { id: "ibge-mun", nome: "IBGE · Municípios", tipo: "ponto", escopo: "uf",
    estilo: { preenchimento: "#ffffff", contorno: "#3d3d3d", espessura: 1.6, tamanho: 4.5, rotuloCampo: "nome", rotuloCor: "#333333", rotuloTamanho: 15 } },
];
export const defCatalogo = (id: string) => CATALOGO.find((d) => d.id === id);

/** Cria a camada (vazia) do catálogo; as feições vêm do serviço em tempo de execução. */
export function camadaDoCatalogo(id: IdCatalogo): Camada {
  const d = defCatalogo(id)!;
  const c: Camada = {
    id: d.id, nome: d.nome, tipo: d.tipo, visivel: true, src: "SIRGAS 2000 (graus)",
    origem: { tipo: "catalogo", id: d.id, wfs: "", manual: false, arquivo: "" },
    estilo: estiloPadrao(d.estilo), filtro: { campo: "", valores: "" },
  };
  if (id === "ibge-mun") {
    c.municipios = { modo: "ponto", soPrincipais: true, principais: 8, rotularSoPrincipais: true,
      estiloPoligono: estiloPadrao({ preenchimento: "#ffffff", opacidade: 0, contorno: "#b5b09a", espessura: 0.7, rotuloCampo: "", rotuloTamanho: 13 }) };
  }
  return c;
}
