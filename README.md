# Tintpath

Turn any photo into a **paint-by-numbers template** — 100% in your browser.

Tintpath converts an uploaded image into numbered outline regions with a color
legend, ready to print or to engrave with a laser. No server, no uploads, no
accounts: every pixel stays on your device.

## Features

- **Linear wizard** with live preview at every step:
  Upload → Crop & paper size → Detail level → Outlines → Colors → Export
- **k-means color quantization** in LAB space with k-means++ seeding — or
  restrict the palette to the paint colors you actually own
- **Auto-merge** of tiny regions into their most similar neighbor
- **Outline extraction** via connected components + Moore-neighbor contour
  tracing, smoothed with Douglas-Peucker
- **Color editing**: swap single colors, or apply preset filters
  (pastel, vintage, high contrast, grayscale, neon, synthwave, 3D retro,
  pop art, ocean, sunset — with live palette previews)
- **Exports**: PNG, JPG, PDF (template + color legend with a colored mini
  reference), SVG and DXF for laser engraving — including *layer-per-color*,
  *grayscale (variable power)* modes and an optional engraved-numbers layer
- **Session resume**: pick up where you left off — everything is stored
  locally (IndexedDB), nothing ever leaves the device
- **i18n** (English + German), dark mode, PWA/offline support
- **Privacy by design**: no uploads, no accounts, no tracking

## Development

```bash
npm install
npm run dev          # start dev server
npm test             # run unit tests (vitest)
npm run check        # svelte-check (type checking)
npm run lint         # biome
npm run build        # static production build -> build/
npm run preview      # preview the production build
```

Optional git hooks via [prek](https://github.com/j178/prek) (see `prek.toml`):

```bash
uv tool install prek   # or: cargo install prek / brew install prek
prek install
```

## Self-hosting

The production build is a static site — any web server works.

**Docker:**

```bash
docker compose up -d   # serves on http://localhost:8080
```

**Plain static files:**

```bash
npm run build
# copy build/ to nginx, caddy, apache, ...
```

## Tech stack

SvelteKit (static adapter) · TypeScript · Tailwind CSS · Canvas API ·
Web Workers · jsPDF · svelte-i18n · Vitest · Biome · Knip

## License

[MIT](./LICENSE)
