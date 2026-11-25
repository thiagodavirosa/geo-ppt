# Plano — geo_ppt

Requisitos em `docs/Requisitos_Suplemento_PowerPoint_Mapas.md`. Organização idêntica à do word-fluxo.

## Arquitetura

```
packages/core            lógica pura (sem Office.js e sem DOM), testada com Vitest
  src/esquema.ts           esquema geo-ppt/1.0 (zod): validar, migrar, tipos
  src/leitores.ts          SHP/DBF/PRJ/CPG (solto ou ZIP), GeoJSON, KML/KMZ
  src/crs.ts, geo.ts       UTM SIRGAS/WGS84 e Web Mercator → graus; recorte por km; ponto interno
  src/catalogo.ts          IBGE (UFs, envelopes, URLs) e GeoServer do DNIT (WFS); camadas pré-carregadas
  src/mapa.ts              operações: camadas, trechos por km, pontos, tabela, instantâneo p/ desfazer
  src/render.ts            renderSvg (texto SVG), layout de caixas e tabela, medição de texto (Arial)
  src/temas.ts, lote.ts, verificar.ts, modelos.ts
  modelos/*.json           galeria (projetos, uf, pontes, localizacao, branco) + demo offline
addin                    suplemento (React + Fluent UI v9, Vite)
  taskpane.html → src/main.tsx → App.tsx        painel: Mapa selecionado · Novo · Mapas · Substituir · Verificar
  editor.html  → src/editor-main.tsx → editor/   janela grande: Propriedades (seções) · Verificar · Tela
  src/powerpoint.ts        inserir/atualizar no lugar, ler seleção, listar, lote, órfãs, abrirEditor
  src/fonte.ts             empacotar (gzip+base64), XML personalizado, texto alternativo
  src/camadas.ts           carga das camadas oficiais com cache (IndexedDB)
  src/mensagens.ts         painel ⇄ editor (pronto/abrir/aplicar/cancelar), em partes se grande
docker/nginx.conf, Dockerfile, docker-compose.yml   painel compilado em https://localhost:3200
tools/gerar_manifesto.mjs                           manifesto para o endereço publicado
.github/workflows/publicar.yml                      testes, tipos, build e GitHub Pages
```

Fluxo de uma figura: **painel** → `abrirEditor(fonte, rótulo)` → editor devolve a **fonte** → painel carrega as camadas, desenha com `renderSvg`, converte em PNG e insere/atualiza; grava a fonte (XML + texto alternativo) e sobe a revisão.

## Fases

| Fase | Conteúdo | Situação |
|---|---|---|
| 0 | Protótipo HTML (camadas, trechos por km, pontos, caixas ancoradas, tabela) | concluída |
| 1 | Núcleo em TypeScript: esquema geo-ppt/1.0, leitores, SRC, recorte por km, renderSvg | concluída (22 testes) |
| 2 | Persistência: forma nomeada, parte XML personalizada, texto alternativo, revisão e conflito | concluída (Office.js simulado) |
| 3 | Editor em janela grande: tela com arraste/redimensionamento, propriedades, desfazer, teclado | concluída |
| 4 | Painel: galeria, Mapas, Substituir (lote, tema, atualizar camadas), Verificar | concluída |
| 4b | **Teste no PowerPoint real** (Windows e Web): PowerPointApi 1.5/1.7, texto alternativo, DialogApi, rede do DNIT | pendente |
| 5 | Publicação: GitHub Pages ou servidor institucional; CORS no GeoServer do DNIT; implantação centralizada | pendente |
| 6 | Evolução: legenda de camadas, escala gráfica e norte, rótulos de rodovias, SNV do Data Lake | proposta |

## Decisões

- **Desenho no núcleo**: `renderSvg` gera texto SVG sem navegador (como no word-fluxo); o painel converte em PNG e o editor usa o mesmo desenho. Texto medido com a métrica do Arial, para caixas e tabela terem o mesmo tamanho em qualquer máquina.
- **PNG no slide**: fiel ao editor (o PowerPoint pode ignorar sombras e marcadores de seta em SVG).
- **Revisão pelo atributo do XML**: é o que a coedição grava; a revisão dentro da fonte é só informativa.
- **Camadas oficiais fora da fonte**: a apresentação fica leve; o cache local garante uso sem rede depois da primeira carga.
- **Porta 3200**: convive com o word-fluxo (3100).
