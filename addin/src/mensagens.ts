/**
 * Mensagens painel ⇄ editor: {tipo: "pronto" | "abrir" | "aplicar" | "cancelar", ...} como no word-fluxo.
 * Mensagens curtas vão como JSON simples; as longas (mapas com camadas próprias) vão em partes,
 * porque messageParent/messageChild têm limite de tamanho por mensagem.
 */
const PARTE = 30000;

export function dividir(obj: object): string[] {
  const s = JSON.stringify(obj);
  if (s.length <= PARTE) return [s];
  const id = Math.random().toString(36).slice(2, 10), n = Math.ceil(s.length / PARTE);
  return Array.from({ length: n }, (_, i) => JSON.stringify({ tipo: "parte", id, i, n, d: s.slice(i * PARTE, (i + 1) * PARTE) }));
}

/** Remonta as partes; chama `cb` com cada mensagem completa. */
export function montador(cb: (msg: any) => void): (bruto: string) => void {
  const bufs = new Map<string, string[]>();
  return (bruto) => {
    const m = JSON.parse(bruto);
    if (m?.tipo !== "parte") { cb(m); return; }
    const b = bufs.get(m.id) ?? new Array<string>(m.n);
    b[m.i] = m.d;
    bufs.set(m.id, b);
    if (b.filter((x) => x !== undefined).length === m.n) { bufs.delete(m.id); cb(JSON.parse(b.join(""))); }
  };
}
