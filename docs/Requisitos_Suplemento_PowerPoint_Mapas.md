# Suplemento do PowerPoint para criação e edição de mapas rodoviários

Documento de requisitos · Versão 0.2 · Novembro de 2026

## 1 Contexto e problema

Apresentações da DPP usam mapas de UF com rodovias federais destacadas, caixas indicando trechos e uma tabela de contratos. Hoje o mapa é montado no QGIS, exportado como imagem e colado no PowerPoint, e as setas e caixas são desenhadas à mão. Qualquer ajuste (trecho, km, ponte, UF) exige voltar ao QGIS, refazer a imagem, colar de novo e redesenhar as setas.

O suplemento mantém, junto de cada mapa inserido, a **fonte editável** e oferece no próprio PowerPoint uma interface para criar, editar e regenerar o mapa — a mesma solução do word-fluxo para diagramas no Word.

## 2 Objetivo

- **Criar** mapas a partir de modelos, com camadas oficiais já carregadas.
- **Editar** trechos, pontos, caixas, tabela, camadas e estilo, inclusive em mapas já inseridos.
- **Reinserir** o mapa no slide sem perder posição e largura.
- **Padronizar** com temas e operações em lote na apresentação inteira.

## 3 Escopo

**Abrange:** mapas temáticos de UF (limite, hidrografia, SNV, malhas estaduais, municípios em pontos ou polígonos); trechos por km; pontos; caixas ancoradas; tabela; camadas próprias SHP/GeoJSON/KML/KMZ (graus, UTM, Web Mercator); inserção, edição, atualização no lugar e lote.

**Não abrange (versão 1):** geoprocessamento (continua no QGIS); projeções cônicas em arquivos próprios (reprojetar antes); mapas de base em imagem; Word e Excel.

## 4 Público e ambiente

Analistas e engenheiros que montam apresentações técnicas. PowerPoint para Microsoft 365 (Windows e Web); Mac desejável. Sideload em testes; implantação centralizada ou GitHub Pages em produção.

**Verificar:** versão do Office (PowerPointApi 1.5 para editar/atualizar; 1.7 para partes XML) e acesso de rede aos serviços (item 10).

## 5 Catálogo de modelos

| Id | Modelo | Conteúdo inicial |
|---|---|---|
| `projetos` | Projetos por rodovia | UF, SNV, caixas "Rodovia:", tabela Rodovia/Contrato/Tipo/Extensão/Situação |
| `uf` | Mapa da UF | Camadas oficiais, sem trechos |
| `pontes` | Pontes e OAEs | Tabela Ponte/Rodovia/km/Situação |
| `localizacao` | Localização da UF | UF entre as vizinhas, quadrado |
| `branco` | Em branco | Sem camadas oficiais |
| `demo` | Demonstração (só `?demo=demo`) | Dados simplificados offline |

## 6 Requisitos funcionais

| Id | Requisito |
|---|---|
| RF-01 | Botão **Mapas** na guia Página Inicial abre o painel. |
| RF-02 | Quadro do mapa selecionado: título, UF, trechos, revisão, tamanho, origem da fonte; Editar; troca de tamanho. |
| RF-03 | **Novo**: UF, tema e galeria; abre o editor; "Inserir no slide". |
| RF-04 | Editor em janela grande; "Inserir no slide"/"Atualizar mapa" e "Cancelar". |
| RF-05 | Fonte na apresentação: parte XML personalizada (ou configurações do documento) + cópia no texto alternativo. |
| RF-06 | Revisão a cada atualização; aviso de conflito se outra pessoa atualizou o mapa. |
| RF-07 | Camadas oficiais por UF com cache e indicação de estado; escolha manual da camada WFS. |
| RF-08 | Camada própria por arquivo; substituir os dados de uma camada oficial mantendo o estilo. |
| RF-09 | Trechos por km (campos do SNV ou comprimento acumulado). |
| RF-10 | Caixa automática ancorada no trecho/ponto; arrasta-se só o texto. |
| RF-11 | Conteúdo e aparência da caixa por elemento; aplicar a todas. |
| RF-12 | Pontos por clique, círculo com as cores dos trechos. |
| RF-13 | Tabela configurável e arrastável; preencher a partir dos trechos. |
| RF-14 | Elemento redimensionável; ajustar ou manter escala; sombras opcionais; fundo transparente. |
| RF-15 | Desfazer/refazer, Delete, setas (1/8 px), Esc. |
| RF-16 | **Mapas**: lista, Ir, Editar; limpeza de fontes órfãs. |
| RF-17 | **Substituir**: localizar/substituir (contando antes), tema e atualização de camadas em todos os mapas. |
| RF-18 | **Verificar** no painel e no editor. |
| RF-19 | Editor no navegador (`?demo=`), exportação SVG/PNG/JSON e importação JSON. |

## 7 Requisitos não funcionais

Núcleo puro testado (Vitest) e tipado (`strict`); esquema versionado (`geo-ppt/1.0`) com ponto único de migração; mesma aparência (eis-ds) e mesma operação (Docker, sideload, Pages) do word-fluxo; painel utilizável a ~350 px.

## 8 Arquitetura

Ver `PLANO.md`.

## 9 Armazenamento

| Item | Onde |
|---|---|
| Imagem | Forma no slide, nome `geo-ppt:<id>`, tag `GEOPPT` |
| Fonte | Parte XML `urn:geo-ppt:<id>` (atributo `revisao`); sem PowerPointApi 1.7, configurações do documento |
| Redundância | Texto alternativo `[geo-ppt:v1:<base64>]` (até 30 mil caracteres) |
| Camadas oficiais | Não gravadas; cache local (IndexedDB) |

## 10 Fontes de dados

| Camada | Serviço |
|---|---|
| Estados | IBGE, malhas v3 |
| Municípios | IBGE, malhas v3 + localidades v1 + agregado 4709 (Censo 2022) |
| SNV, malhas estaduais, hidrografia | GeoServer do DNIT (WFS), o mesmo do VGeo |

Riscos: proxy e CORS. Mitigação: cache, "Arquivo…" por camada, pedido ao DNITGeo para liberar CORS ao endereço de publicação.

## 11 Critérios de aceite

1. Criar um mapa *Projetos por rodovia*, com dois trechos, caixas e tabela, e inseri-lo.
2. Mover e redimensionar a imagem; Editar; alterar um km; Atualizar no mesmo lugar (revisão 2).
3. Salvar, fechar, reabrir (idealmente em outra máquina) e editar de novo.
4. Substituir um termo em todos os mapas e trocar o tema da apresentação.
5. Usar um shapefile do SNV em UTM como camada de rodovias.
