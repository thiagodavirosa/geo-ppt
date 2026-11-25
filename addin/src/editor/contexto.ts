import type { Dados, Mapa } from "@geo-ppt/core";
import type { Cargas } from "../camadas";

/** O que as seções do painel de propriedades recebem do editor. */
export interface Ctx {
  m: Mapa;
  dados: Dados;
  cargas: Cargas;
  sel: string | null;
  selecionar: (id: string | null) => void;
  /** Altera o mapa registrando o passo de desfazer. `chave` agrupa alterações seguidas do mesmo campo. */
  mutar: (fn: (m: Mapa) => void, chave?: string) => void;
  /** Registra o passo de desfazer sem redesenhar (arrastes alteram o mapa diretamente). */
  antes: () => void;
  /** Redesenha após alterações feitas diretamente no mapa. */
  refrescar: () => void;
  recarregar: (forcar?: boolean) => void;
  aviso: (msg: string, erro?: boolean) => void;
  modoPonto: boolean;
  setModoPonto: (b: boolean) => void;
}
