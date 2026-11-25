# geo_ppt

Suplemento do PowerPoint para criar e editar mapas rodoviários: UF, SNV por km, municípios, hidrografia, malhas estaduais, pontos, caixas ancoradas e tabela. Plano em [PLANO.md](PLANO.md); requisitos em [docs/](docs/Requisitos_Suplemento_PowerPoint_Mapas.md).

Segue a mesma sistemática do **word-fluxo**: monorepo `packages/core` + `addin`, TypeScript + React + Fluent UI v9 (tema eis-ds), Vite, Vitest, zod, nginx no Docker e publicação no GitHub Pages.

O painel é servido em **https://localhost:3200** (a 3100 é do word-fluxo; os dois rodam juntos).

## Uso diário (Docker)

```
docker compose up -d --build
```

O container (`restart: unless-stopped`) volta sozinho com o Docker Desktop; depois da primeira vez basta abrir o PowerPoint. Rode o comando acima de novo só quando o código mudar.

Desenvolvimento com recarga automática (usa a mesma porta, então pare o painel antes):

```
docker compose stop painel
docker compose --profile dev up dev
```

## Configuração inicial (uma vez por máquina)

- `npm install` (gera o `package-lock.json`, que o Docker e o GitHub Actions usam com `npm ci`; faça o commit dele).
- Certificado HTTPS de desenvolvimento — é o mesmo do word-fluxo; se ele já roda nesta máquina, este passo já está feito:
  ```
  npm run certs
  ```
- Registrar o suplemento no PowerPoint (repetir só se o manifesto mudar):
  ```
  npm run sideload
  ```
  Aba **Página Inicial**, botão **Mapas**.

## Testes

```
npm run test
npm run typecheck
npm run build
```

`packages/core/test` usa arquivos reais em `fixtures/` (shapefile SIRGAS UTM 20S zipado, GeoJSON, KMZ) e confere coordenadas com o pyproj.

## Painel

- **Mapa selecionado**: clique num mapa no slide; o painel mostra título, UF, trechos, revisão, tamanho e de onde a fonte foi lida. **Editar mapa** abre o editor; **Tamanho…** troca o tamanho do elemento sem abrir o editor.
- **Novo**: UF, tema e galeria de modelos (Projetos por rodovia, Mapa da UF, Pontes e OAEs, Localização da UF, Em branco). Ao escolher, abre o editor; **Inserir no slide** coloca o mapa.
- **Mapas**: lista dos mapas da apresentação, **Ir** e **Editar**. Ao listar, remove fontes de mapas apagados.
- **Substituir**: localizar/substituir em todos os mapas (conta antes de substituir), tema da apresentação inteira e **Atualizar todos os mapas** com as camadas oficiais.
- **Verificar**: trecho sem geometria ou fora da faixa de km, caixa fora do elemento, contraste da caixa, tabela vazia, camada indisponível.

## Editor

Abre numa janela grande (Dialog API). Barra: **Inserir no slide / Atualizar mapa**, **Cancelar**, desfazer/refazer, tema, exportar SVG/PNG/JSON e importar JSON. Abas **Propriedades** e **Verificar**.

- **Camadas**: oficiais carregadas para a UF com cache local (IBGE: estados, municípios com população do Censo 2022; GeoServer do DNIT: SNV, malhas estaduais, hidrografia). Camada própria: SHP (.zip ou .shp+.dbf+.prj), GeoJSON, KML, KMZ. **Arquivo…** numa camada oficial substitui os dados mantendo o estilo. Municípios em pontos ou polígonos; "só as principais" = capital + N maiores.
- **Elemento e enquadramento**: tamanho, *Ajustar o mapa ao tamanho* ou *Manter a escala*, fundo transparente, UF, recorte, vizinhas, zoom, sombra do mapa.
- **Rodovias e trechos**: km inicial/final (recorte pelos campos do SNV), cor e espessura; a caixa nasce ancorada no meio do trecho.
- **Pontos**: clique no mapa; círculo com as cores dos trechos.
- **Caixa selecionada**: conteúdo (rodovia, UF, km, extensão, prefixo, texto livre) e aparência; arrasta-se só o texto, a seta fica presa.
- **Tabela**: colunas, linhas, cores, bordas, sombra; arrastável; *Preencher a partir dos trechos*.
- Arrastar o fundo desloca o mapa; alças redimensionam o elemento; Ctrl+Z / Ctrl+Y; Delete exclui; setas movem caixa ou tabela 1 px (Shift: 8 px); Esc cancela a inserção de ponto.

Pré-visualizar o editor fora do PowerPoint (sem Office.js), em http comum:

```
SEM_HTTPS=1 npm run dev -w addin -- --port 3201
```

Abrir `http://localhost:3201/editor.html?demo=demo` (dados simplificados, sem rede) ou `?demo=projetos&uf=RR&tema=cinza` (qualquer modelo; camadas oficiais).

## Como o mapa fica guardado na apresentação

- Imagem no slide com **nome de forma** `geo-ppt:<id>` (e tag `GEOPPT`).
- **Fonte** (esquema `geo-ppt/1.0`, JSON → gzip → base64) numa **parte XML personalizada** por mapa (`urn:geo-ppt:<id>`, atributo `revisao`) — PowerPointApi 1.7. Sem 1.7, nas configurações do documento.
- **Cópia no texto alternativo** da imagem (`[geo-ppt:v1:…]`), para recuperar se a parte XML se perder.
- Camadas oficiais não são gravadas (vêm do cache/serviço); camadas de arquivo próprio são.
- Cada atualização sobe a revisão; se outra pessoa atualizou o mesmo mapa enquanto o editor estava aberto, aparece aviso de conflito.

## Instalar no PowerPoint (sem npm, sem Docker)

O painel é publicado no GitHub Pages a cada push na `main` (ative em *Settings → Pages → Source: GitHub Actions*): `https://<usuario>.github.io/geo-ppt/`

1. Baixe `https://<usuario>.github.io/geo-ppt/manifest.xml`.
2. **PowerPoint para Windows:** coloque o arquivo numa pasta, compartilhe-a e, em Arquivo → Opções → Central de Confiabilidade → Configurações → Catálogos de Suplementos Confiáveis, adicione o caminho de rede e marque "Mostrar no Menu". Reinicie e abra Inserir → Meus Suplementos → Pasta Compartilhada → Mapas.
3. **PowerPoint na web ou Mac:** Inserir → Suplementos → Meus suplementos → Carregar meu suplemento → `manifest.xml`.
4. **Organização:** o administrador do Microsoft 365 envia o `manifest.xml` em Centro de administração → Configurações → Aplicativos integrados.

Para publicar uma nova versão, basta `git push`; quem já instalou recebe a atualização ao reabrir o painel.

## Pendente de teste no PowerPoint

Verificado com Office.js simulado (inserir, editar, atualizar no lugar, conflito de revisão, Mapas, Substituir, Verificar, fontes órfãs, sem PowerPointApi 1.7, recuperação pelo texto alternativo). Falta confirmar no PowerPoint real: partes XML personalizadas (PowerPointApi 1.7), texto alternativo pela API, `messageChild` e o acesso ao IBGE e ao GeoServer do DNIT a partir da rede do DNIT (CORS/proxy).
