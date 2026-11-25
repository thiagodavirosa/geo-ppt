/** Leitor de ZIP nativo (DecompressionStream; navegador e Node 18+). Suficiente para SHP zipado e KMZ. */
export async function lerZip(buf: ArrayBuffer): Promise<Record<string, ArrayBuffer>> {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let fim = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("Arquivo ZIP inválido.");
  const total = dv.getUint16(fim + 10, true);
  let off = dv.getUint32(fim + 16, true);
  const arquivos: Record<string, ArrayBuffer> = {};
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(off + 10, true);
    const tam = dv.getUint32(off + 20, true);
    const nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true);
    const local = dv.getUint32(off + 42, true);
    const nome = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nl));
    const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const bruto = u8.slice(ini, ini + tam);
    if (!nome.endsWith("/")) {
      if (metodo === 0) arquivos[nome] = bruto.buffer;
      else if (metodo === 8) {
        const fluxo = new Blob([bruto]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        arquivos[nome] = await new Response(fluxo).arrayBuffer();
      }
    }
    off += 46 + nl + el + cl;
  }
  return arquivos;
}
