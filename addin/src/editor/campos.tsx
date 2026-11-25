import { useEffect, useRef, useState, type ReactNode } from "react";
import { Field, Input, Select, makeStyles, tokens } from "@fluentui/react-components";

/** Campos compactos do painel de propriedades. */
export const useCampos = makeStyles({
  duas: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalS },
  coluna: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  linha: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center" },
  cor: { width: "100%", height: "28px", padding: "1px", border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusSmall, background: "#fff", cursor: "pointer" },
  cartao: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingVerticalS, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium },
  cartaoSel: { border: `1px solid #f35919` },
  nota: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

export function Duas({ children }: { children: ReactNode }) { return <div className={useCampos().duas}>{children}</div>; }

/** Número com texto local: aceita "12," e "12." durante a digitação e só grava valores válidos. */
export function CampoNum(p: { rotulo: string; valor: number; onMudar: (n: number) => void; min?: number; max?: number; passo?: number }) {
  const [txt, setTxt] = useState(String(p.valor));
  const foco = useRef(false);
  useEffect(() => { if (!foco.current) setTxt(String(p.valor)); }, [p.valor]);
  return (
    <Field label={p.rotulo} size="small">
      <Input size="small" type="text" inputMode="decimal" value={txt}
        onFocus={() => (foco.current = true)}
        onBlur={() => { foco.current = false; setTxt(String(p.valor)); }}
        onChange={(_, d) => {
          setTxt(d.value);
          const n = Number(d.value.replace(",", "."));
          if (d.value.trim() !== "" && Number.isFinite(n)) p.onMudar(Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, n)));
        }} />
    </Field>
  );
}

export function CampoTexto(p: { rotulo: string; valor: string; onMudar: (v: string) => void; dica?: string }) {
  return (
    <Field label={p.rotulo} size="small" hint={p.dica}>
      <Input size="small" value={p.valor} onChange={(_, d) => p.onMudar(d.value)} />
    </Field>
  );
}

export function CampoCor(p: { rotulo: string; valor: string; onMudar: (v: string) => void }) {
  return (
    <Field label={p.rotulo} size="small">
      <input type="color" aria-label={p.rotulo} className={useCampos().cor} value={p.valor} onChange={(e) => p.onMudar(e.target.value)} />
    </Field>
  );
}

export function CampoLista(p: { rotulo: string; valor: string; opcoes: { valor: string; texto: string }[]; onMudar: (v: string) => void; vazio?: string; desabilitado?: boolean }) {
  return (
    <Field label={p.rotulo} size="small">
      <Select size="small" value={p.valor} disabled={p.desabilitado} onChange={(_, d) => p.onMudar(d.value)}>
        {p.vazio !== undefined && <option value="">{p.vazio}</option>}
        {p.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </Select>
    </Field>
  );
}

export const opcoes = (vs: string[]) => vs.map((v) => ({ valor: v, texto: v }));
