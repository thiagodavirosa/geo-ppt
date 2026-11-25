import { feicoesVisiveis, instanciarModelo, nomeBr, validar, type Mapa } from "@geo-ppt/core";

/** A fonte editável é o mapa do núcleo (esquema geo-ppt/1.0). */
export type Fonte = Mapa;

/** Nome da forma no slide: identifica a imagem como mapa do suplemento. */
export const NOME_PREFIXO = "geo-ppt:";
export const nsDe = (id: string) => `urn:geo-ppt:${id}`;
export const NS_PREFIXO = "urn:geo-ppt:";

export const fonteExemplo = (): Fonte => instanciarModelo("demo");

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function transformar(dados: Uint8Array, fluxo: CompressionStream | DecompressionStream) {
  const saida = new Blob([dados as BlobPart]).stream().pipeThrough(fluxo);
  return new Uint8Array(await new Response(saida).arrayBuffer());
}

/** JSON -> gzip -> base64 (cópia compacta da fonte, usada no XML e no texto alternativo). */
export async function empacotar(fonte: Fonte): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(fonte));
  return bytesParaBase64(await transformar(json, new CompressionStream("gzip")));
}
export async function desempacotar(b64: string): Promise<Fonte> {
  const json = await transformar(base64ParaBytes(b64), new DecompressionStream("gzip"));
  return validar(JSON.parse(new TextDecoder().decode(json)));
}

/** Parte XML personalizada: um documento por mapa, para que a coedição grave só o que mudou. */
export function paraXml(fonte: Fonte, empacotado: string): string {
  return `<mapa xmlns="${nsDe(fonte.id)}" versao="1" revisao="${fonte.revisao}"><fonte>${empacotado}</fonte></mapa>`;
}
export function extrairDoXml(xml: string): string | null {
  return /<(?:\w+:)?fonte>([A-Za-z0-9+/=\s]+)<\/(?:\w+:)?fonte>/.exec(xml)?.[1].replace(/\s/g, "") ?? null;
}
export const revisaoDoXml = (xml: string) => Number(/revisao="(\d+)"/.exec(xml)?.[1] ?? NaN);

/** Limite prático do texto alternativo; acima disso a redundância é omitida (mapas com camadas próprias grandes). */
export const LIMITE_ALT = 30000;

/** Texto alternativo: descrição legível + redundância da fonte. */
export function paraAlt(fonte: Fonte, empacotado: string): string {
  const rod = [...new Set(fonte.trechos.map((t) => nomeBr(t.br)))];
  const desc = `${fonte.titulo}. Mapa de ${fonte.enquadramento.valor || "área"}`
    + (rod.length ? ` com ${rod.join(", ")}` : "")
    + (fonte.pontos.length ? ` e ${fonte.pontos.length} ponto(s): ${fonte.pontos.map((p) => p.nome).join(", ")}` : "") + ".";
  return empacotado.length <= LIMITE_ALT ? `${desc} [geo-ppt:v1:${empacotado}]` : desc;
}
export function extrairDoAlt(alt: string | undefined | null): string | null {
  return /\[geo-ppt:v1:([A-Za-z0-9+/=]+)\]/.exec(alt ?? "")?.[1] ?? null;
}

/** Quantas feições de camadas do catálogo uma fonte desenharia (para mensagens). */
export const contarVisiveis = (f: Fonte, dados: Record<string, any>) => f.camadas.reduce((n, c) => n + feicoesVisiveis(c, dados).length, 0);
