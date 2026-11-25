import { Button, Caption1, Card, Select, Text, makeStyles, tokens } from "@fluentui/react-components";
import { TAMANHOS, UFS } from "@geo-ppt/core";
import type { Fonte } from "../fonte";
import type { MapaLido } from "../powerpoint";

const useStyles = makeStyles({
  linha: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap" },
  vazio: { color: tokens.colorNeutralForeground3 },
});

const ORIGEM = { xml: "parte XML", config: "configurações do documento", alt: "texto alternativo (recuperada)" } as const;

/** Quadro com o mapa sob a seleção: dados, Editar e troca rápida do tamanho do elemento. */
export function MapaSelecionado(p: { lido: MapaLido | null; desabilitado: boolean; onEditar: () => void; onTamanho: (f: Fonte) => void }) {
  const s = useStyles();
  if (!p.lido) return <Caption1 className={s.vazio}>Selecione um mapa no slide para editá-lo.</Caption1>;
  const f = p.lido.fonte;
  return (
    <Card size="small">
      <Text weight="semibold">{f.titulo}</Text>
      <Caption1>
        {UFS[f.enquadramento.valor]?.[1] ?? f.enquadramento.valor} · {f.trechos.length} trecho(s) · {f.pontos.length} ponto(s) · revisão {f.revisao} · {f.tela.largura} × {f.tela.altura}
      </Caption1>
      <Caption1>Fonte: {ORIGEM[p.lido.origem]}</Caption1>
      <div className={s.linha}>
        <Button appearance="primary" disabled={p.desabilitado} onClick={p.onEditar}>Editar mapa</Button>
        <Select
          aria-label="Tamanho do elemento"
          disabled={p.desabilitado}
          value=""
          onChange={(_, d) => {
            const t = TAMANHOS[d.value];
            if (t) p.onTamanho({ ...f, tela: { ...f.tela, largura: t.largura, altura: t.altura, predefinicao: d.value }, tabela: { ...f.tabela, x: null, y: null } });
          }}
        >
          <option value="">Tamanho…</option>
          {Object.entries(TAMANHOS).map(([k, t]) => <option key={k} value={k}>{t.texto}</option>)}
        </Select>
      </div>
    </Card>
  );
}
