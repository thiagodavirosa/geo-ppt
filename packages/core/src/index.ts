/**
 * @geo-ppt/core — lógica pura do suplemento (sem Office.js e sem DOM; o leitor KML recebe um DOMParser).
 * Usada pelo painel, pelo editor e pelos testes.
 */
export * from "./esquema";
export * from "./util";
export { lerZip } from "./zip";
export { utm, mercator, srcDoTexto, srcManual, type Src, type Conversor } from "./crs";
export * from "./geo";
export * from "./leitores";
export * from "./catalogo";
export * from "./mapa";
export * from "./render";
export * from "./temas";
export * from "./lote";
export * from "./verificar";
export * from "./modelos";
