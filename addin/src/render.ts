/** SVG (texto) -> PNG em base64, na escala pedida (3x = nítido no slide e na projeção). */
export async function svgParaPng(svg: string, largura: number, altura: number, escala = 3): Promise<string> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = Math.round(largura * escala);
    cv.height = Math.round(altura * escala);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/png").split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function baixar(nome: string, dados: BlobPart | Blob, tipo = "application/octet-stream") {
  const blob = dados instanceof Blob ? dados : new Blob([dados], { type: tipo });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
