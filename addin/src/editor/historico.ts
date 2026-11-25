import { instantaneo, restaurar, type Mapa } from "@geo-ppt/core";

type Inst = ReturnType<typeof instantaneo>;
const LIMITE = 80, AGRUPAR_MS = 700;

/** Desfazer/refazer (Ctrl+Z / Ctrl+Y). Alterações seguidas da mesma origem (digitação, setas) viram um passo só. */
export class Historico {
  private pilha: Inst[] = [];
  private refeitos: Inst[] = [];
  private ultimo = 0;
  private chave = "";

  /** Chamar ANTES de alterar o mapa. */
  antes(m: Mapa, chave = "") {
    const agora = Date.now();
    if (chave && chave === this.chave && agora - this.ultimo < AGRUPAR_MS) { this.ultimo = agora; return; }
    this.pilha.push(instantaneo(m));
    if (this.pilha.length > LIMITE) this.pilha.shift();
    this.refeitos = [];
    this.ultimo = agora;
    this.chave = chave;
  }
  desfazer(m: Mapa): Mapa | null {
    const s = this.pilha.pop();
    if (!s) return null;
    this.refeitos.push(instantaneo(m));
    this.chave = "";
    return restaurar(s);
  }
  refazer(m: Mapa): Mapa | null {
    const s = this.refeitos.pop();
    if (!s) return null;
    this.pilha.push(instantaneo(m));
    this.chave = "";
    return restaurar(s);
  }
  get podeDesfazer() { return this.pilha.length > 0; }
  get podeRefazer() { return this.refeitos.length > 0; }
}
