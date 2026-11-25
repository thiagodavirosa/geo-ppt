import { useEffect, useState } from "react";
import { Button, Caption1, Card, Text, makeStyles, tokens } from "@fluentui/react-components";
import { UFS, nomeBr } from "@geo-ppt/core";
import { irParaMapa, lerMapa, limparOrfas, listarMapas, temApiFormas, type MapaDoc, type MapaLido } from "../powerpoint";

const useStyles = makeStyles({
  raiz: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  linha: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

interface Item { doc: MapaDoc; lido: MapaLido | null }

/** Aba Mapas: lista dos mapas da apresentação, navegação e edição. Ao listar, remove fontes de mapas apagados. */
export function Mapas(p: { desabilitado: boolean; onExecutar: (a: () => Promise<string>) => void; onEditar: (m: MapaLido) => void }) {
  const s = useStyles();
  const [itens, setItens] = useState<Item[] | null>(null);
  const atualizar = () =>
    p.onExecutar(async () => {
      const docs = await listarMapas();
      const lista: Item[] = [];
      for (const doc of docs) lista.push({ doc, lido: await lerMapa(doc).catch(() => null) });
      setItens(lista);
      const removidas = await limparOrfas(new Set(docs.map((d) => d.id))).catch(() => 0);
      return `${docs.length} mapa(s) na apresentação.${removidas ? ` ${removidas} fonte(s) órfã(s) removida(s).` : ""}`;
    });
  useEffect(() => { if (temApiFormas()) atualizar(); }, []);

  if (!temApiFormas()) return <Caption1>Requer PowerPointApi 1.5 (Microsoft 365 versão 2208 ou mais recente).</Caption1>;
  return (
    <div className={s.raiz}>
      <div className={s.linha}><Button disabled={p.desabilitado} onClick={atualizar}>Atualizar lista</Button></div>
      {itens?.length === 0 && <Caption1>Nenhum mapa nesta apresentação.</Caption1>}
      {itens?.map(({ doc, lido }) => {
        const f = lido?.fonte;
        const rod = f ? [...new Set(f.trechos.map((t) => nomeBr(t.br)))].join(", ") : "";
        return (
          <Card key={doc.forma.shapeId} size="small">
            <Text weight="semibold">Slide {doc.slide} · {f?.titulo ?? "fonte não encontrada"}</Text>
            {f && <Caption1>{UFS[f.enquadramento.valor]?.[1] ?? f.enquadramento.valor}{rod ? ` · ${rod}` : ""} · revisão {f.revisao}</Caption1>}
            <div className={s.linha}>
              <Button size="small" disabled={p.desabilitado} onClick={() => p.onExecutar(async () => { await irParaMapa(doc); return `Slide ${doc.slide}.`; })}>Ir</Button>
              {lido && <Button size="small" disabled={p.desabilitado} onClick={async () => { await irParaMapa(doc); p.onEditar(lido); }}>Editar</Button>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
