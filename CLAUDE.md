# Paint-by-Numbers Generator — Projekt-Spezifikation

> Agent-ready Dokumentation für die Entwicklung einer client-seitigen Web-App zum Erstellen von Malen-nach-Zahlen-Bildern.

---

## 1. Überblick

### Ziel
Eine kostenlose, im Browser laufende Web-App, die ein hochgeladenes Bild in ein Malen-nach-Zahlen-Vorlage umwandelt. Der User durchläuft einen linearen Wizard mit Live-Preview an jedem Schritt. Am Ende kann das Ergebnis als PDF, PNG, JPG oder als Vektor-Datei für Laser-Gravierung exportiert werden.

### Grundprinzipien
- **100% Client-Side** — kein Server-Compute, keine API-Calls, keine Kosten
- **Kostenlos** — Self-hosted (Docker / Static Files, 0€ Serverkosten)
- **Live-Preview an jedem Schritt** — keine Blind-Operationen
- **Keine nutzerbezogenen Daten** — keine Logins, keine Speicherung, Privatsphäre by design
- **i18n von Anfang an** — Deutsch + Englisch, erweiterbar auf weitere Sprachen
- **Hobby-First mit Advanced Options** — simple Defaults, ausklappbare Experten-Controls
- **PWA** — installierbar, offline-fähig (Service Worker cached die static assets)

### Lizenz
**MIT** — Open Source, kommerzielle Nutzung erlaubt, Attribution erforderlich.
Der gesamte Code wird öffentlich auf GitHub gehostet.

### USP (Unique Selling Points)
- Laser-Export (SVG) als Differenzierer zu bestehenden Tools
- Farbswap nach Outline-Generierung
- Vollständig browserbasiert, keine Uploads zu fremden Servern

### Projektname
**Tintpath**

- .com und .app Domain beide frei (Stand: Juli 2026)
- Bedeutung: Tint (Farbe/Tinte) + Path (Pfad/Outlines) — beschreibt die Kernfunktion
- 2 Silben, kurz, international aussprechbar
- Assoziiert sowohl Malen-nach-Zahlen (Farbe) als auch Laser-Export (Vektor-Pfade)

---

## 2. Workflow / User Journey

```
Upload → Crop & Papierformat → Detailgrad → Outlines → Farbanpassung → Export
```

### Step 1: Bild-Upload
- Drag & Drop oder File-Picker
- Akzeptierte Formate: JPG, PNG, WEBP
- Sofortige Anzeige im Canvas
- Maximalauflösung: ca. 4000×4000px (größere werden herunterskaliert)

### Step 2: Crop, Position & Papiergröße
- Bild zuschneiden (Crop-Tool mit Drag-Handles)
- Positionierung auf Papierformat
- Papiergrößen zur Auswahl: A4, A3, Letter, Square (1:1), Custom
- Orientierung: Portrait / Landscape
- Live-Preview zeigt das finale Seitenverhältnis

### Step 3: Detailgrad definieren
- Slider/Control für Detailgrad (= Anzahl Farbregionen)
- Bereich: ca. 5–50 Farben
- **Default-Wert: 15** (bewährter Sweet-Spot für typische Bilder)
- **Minimale Region-Größe (Auto-Merge):** Default 100px — Regionen darunter werden mit der Nachbar-Region verschmolzen, die die ähnlichste Farbe hat
- **Advanced Option:** Min-Region-Größe manuell einstellbar (10–1000px)
- **Advanced Option:** Rauschen reduzieren (morphologische Opening-Operation, entfernt Einzel-Pixel-Artefakte)
- Live-Preview: Original vs. quantisiertes Bild (Split-View oder Toggle)
- Bei jeder Änderung: sofortige Neu-Berechnung der Farbpalette
- Anzeige der aktuellen Farbpalette als Swatches
- **Region-Count-Anzeige:** "23 Farben, 187 Regionen" — live aktualisiert

### Step 4: Outline-Generierung
- Automatische Umwandlung des quantisierten Bildes in Outlines
- Jede Farbregion bekommt eine Nummer
- Darstellung: Outline-Zeichnung mit nummerierten Regionen
- Zoom/Pan zur Inspektion von Details
- Optional: Farbe anzeigen vs. nur Outlines (Toggle)

### Step 5: Farbanpassung (Optional)
- Farbpalette wird angezeigt (Nummer → Farbe)
- Einzelne Farben können getauscht werden (Color-Picker pro Region)
- Preset-Filter anwendbar (z.B. "Pastell", "Vintage", "High-Contrast", "Grayscale")
- Filter verändern die gesamte Palette gleichzeitig
- Live-Preview aktualisiert sich sofort

### Step 6: Export
- **PNG** — hochauflösendes Rasterbild
- **JPG** — komprimiert, für Sharing
- **PDF** — Malvorlage mit nummerierten Regionen + Farb-Legende auf separater Seite
- **SVG** — Vektor-Outlines für Laser-Gravierung (keine Farbfill, nur Pfade)
- **DXF** — optional, für Laser-Software die kein SVG unterstützt (LightBurn/RDWorks können SVG, daher niedrigere Priorität)

#### Laser-Export-Modi (Advanced)
- **Outline-Modus** — nur Kontur-Pfade, ein Layer (Standard)
- **Layer-per-Color** — jede Farbe ein separater Layer/Path (für mehrfarbige Gravierung in mehreren Durchgängen)
- **Graustufen-Modus** — Regionen nicht als Outlines sondern als gefüllte Flächen mit variierender Graustufe entsprechend der LAB-Luminanz. Erlaubt **ein Durchgang** mit variabler Laser-Power (PWM) für unterschiedliche Gravurtiefe. Export als hochauflösendes PNG/SVG mit Grauwerten.

---

## 3. Technische Architektur

### Stack
| Komponente | Wahl | Begründung |
|---|---|---|
| Framework | SvelteKit (static export) | Klein, schnell, kein React-Overhead, exzellente DX |
| Bildverarbeitung | Canvas API + Custom JS | Keine 8MB WASM-Bibliothek nötig |
| PDF-Export | jsPDF | Klein, bewährt, Client-side |
| SVG-Export | Custom String-Generierung | Trivial, keine Library nötig |
| DXF-Export | Custom String-Generierung | DXF ist Text-Format, simple Header + Entities |
| i18n | svelte-i18n | Leichtgewichtig, reactive, lazy-loading von locales |
| Deploy | Static Files / Docker | Self-hosted friendly (siehe Deploy-Section) |
| Styling | Tailwind CSS | Utility-first, schnell, konsistent |

### Dev Toolkit

| Tool | Zweck | Begründung |
|---|---|---|
| Biome | Linting + Formatting | Ersetzt ESLint + Prettier in einem Tool, Rust-basiert, extrem schnell |
| Vitest | Unit Tests | Vite-native, Zero-Config, schnelle Watch-Mode |
| prek | Git Hooks (pre-commit) | Rust-basiert, pre-commit-kompatibel, single binary, 10x schneller als pre-commit |
| Knip | Dead Code & Unused Deps Detection | Findet unbenutzte Exporte, Files, Dependencies — hält das Bundle schlank |

#### Biome Konfiguration (`biome.json`)
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "svelte": { "recommended": true }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "files": {
    "ignore": ["build/", ".svelte-kit/", "node_modules/"]
  }
}
```

#### prek Konfiguration (`prek.toml`)
```toml
# prek: Rust-basierter Git Hook Manager (drop-in für pre-commit)
# Installation: uv tool install prek  ODER  cargo install prek  ODER  brew install prek
# Setup: prek install  (installiert die Git Hooks automatisch)

[[repos]]
repo = "builtin"  # prek's Rust-native Built-in Hooks (kein Python nötig)

[[repos.hooks]]
id = "trailing-whitespace"

[[repos.hooks]]
id = "end-of-file-fixer"

[[repos.hooks]]
id = "check-yaml"

[[repos.hooks]]
id = "check-json"

[[repos.hooks]]
id = "check-added-large-files"

# Lokale Hooks für unsere Tools
[[repos]]
repo = "local"

[[repos.hooks]]
id = "biome-check"
name = "Biome Check"
language = "system"
entry = "npx biome check --apply"
files = "\\.(js|ts|svelte|json)$"

[[repos.hooks]]
id = "svelte-check"
name = "svelte-check"
language = "system"
entry = "npx svelte-check --tsconfig ./tsconfig.json"
files = "\\.(ts|svelte)$"

[[repos.hooks]]
id = "vitest"
name = "Vitest"
language = "system"
entry = "npx vitest run --quiet"
files = "\\.(ts|test\\.ts)$"
pass_filenames = false

[[repos.hooks]]
id = "knip"
name = "Knip"
language = "system"
entry = "npx knip --no-progress"
pass_filenames = false
```

#### Vitest Setup (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/types.ts']
    }
  }
});
```

#### Test-Strategie
```
src/lib/
├── pipeline/
│   ├── quantize.test.ts        # k-means: Cluster-Zuweisung, LAB-Konvertierung
│   ├── outline.test.ts          # Connected Components, Kontur-Trace
│   ├── simplify.test.ts         # Douglas-Peucker: einfache Pfade, Edge Cases
│   └── numbering.test.ts        # Zentroid-Berechnung, Nummer-Placement
├── export/
│   ├── svg.test.ts              # Pfad-String-Generierung, ViewBox
│   ├── dxf.test.ts             # DXF-Header + Entities
│   └── pdf.test.ts              # jsPDF Mock, Legenden-Layout
└── stores/
    └── project.test.ts          # State-Transitions, Pipeline-Orchestrierung
```

**Was getestet wird:**
- **Pipeline-Algorithmen** (quantize, outline, simplify) — Core-Logik mit festen Input/Output-Paaren
- **Export-Generatoren** (svg, dxf, pdf) — String-Output gegen erwartete Templates
- **Store-Transitions** — Step-Wechsel, State-Reset, Pipeline-Re-Compute bei Parameter-Änderung
- **Nicht getestet:** Canvas-Rendering, UI-Interaktion (manuell oder E2E später)

#### Knip Konfiguration (`knip.json`)
```json
{
  "$schema": "https://unpkg.com/knip@latest/schema.json",
  "entry": ["src/routes/+page.svelte"],
  "project": ["src/**/*.ts", "src/**/*.svelte"],
  "ignore": ["src/lib/types.ts"],
  "ignoreDependencies": ["@sveltejs/vite-plugin-svelte"]
}
```

#### Dev Dependencies (komplett)
```bash
npm i -D @biomejs/biome vitest @testing-library/svelte jsdom \
  @sveltejs/vite-plugin-svelte svelte-check knip
```
> **Hinweis:** `prek` wird nicht via npm installiert — es ist ein standalone Binary.
> Installation: `uv tool install prek` oder `cargo install prek` oder `brew install prek`

### Verzeichnisstruktur (SvelteKit)
```
tintpath/
├── src/
│   ├── routes/
│   │   └── +page.svelte          # Haupt-UI, Wizard-Orchestrierung
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Uploader.svelte       # Step 1
│   │   │   ├── Cropper.svelte        # Step 2
│   │   │   ├── DetailSlider.svelte   # Step 3
│   │   │   ├── OutlineView.svelte     # Step 4
│   │   │   ├── ColorEditor.svelte    # Step 5
│   │   │   └── ExportPanel.svelte    # Step 6
│   │   ├── pipeline/
│   │   │   ├── quantize.ts            # k-means LAB-Farbquantisierung
│   │   │   ├── outline.ts            # Connected Components + Kontur-Trace
│   │   │   ├── simplify.ts           # Douglas-Peucker Pfad-Vereinfachung
│   │   │   ├── numbering.ts          # Region-Nummerierung + Zentroid-Berechnung
│   │   │   └── palette.ts            # Farb-Swap, Filter, Palette-Management
│   │   ├── export/
│   │   │   ├── png.ts                # Canvas → PNG
│   │   │   ├── pdf.ts                # jsPDF, nummerierte Regionen + Legende
│   │   │   ├── svg.ts                # SVG-String für Laser-Export
│   │   │   ├── dxf.ts                # DXF-String (optional, für Laser ohne SVG-Support)
│   │   │   └── laser.ts              # Laser-Modi: Graustufen, Layer-per-Color
│   │   ├── i18n/
│   │   │   ├── en.json               # Englische Übersetzungen
│   │   │   ├── de.json               # Deutsche Übersetzungen
│   │   │   └── index.ts              # svelte-i18n Setup + Locale-Detection
│   │   ├── stores/
│   │   │   ├── project.ts            # Svelte Store: Bild, Pipeline-State, Palette
│   │   │   └── settings.ts           # UI-Settings: Sprache, Theme, Advanced-Mode
│   │   └── types.ts                  # TypeScript Types
│   ├── app.html
│   └── app.css
├── static/
├── svelte.config.js
├── tailwind.config.js
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Build & Deploy
```bash
npm create svelte@latest paint-by-numbers
# Adapter-static für reine Static-Site
npm i -D @sveltejs/adapter-static
# jsPDF für PDF-Export
npm i jspdf
# svelte-i18n für Internationalisierung
npm i svelte-i18n
# Tailwind
npm i -D tailwindcss postcss autoprefixer
# Build
npm run build  # → static site in build/
```

#### Self-Hosted Deploy-Optionen

Da die App 100% Client-Side läuft, ist das Deployment trivial — nur static files:

**Option 1: Docker (Empfohlen)**
```dockerfile
# Dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
```
```bash
docker build -t paint-by-numbers .
docker run -p 8080:80 paint-by-numbers
```

**Option 2: Static Files auf beliebigem Webserver**
```bash
npm run build
# build/ Ordner auf beliebigen Webserver kopieren (nginx, caddy, apache, Python http.server)
```

**Option 3: Docker Compose (für Homelab)**
```yaml
# docker-compose.yml
services:
  paint-by-numbers:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

**Wichtig:** Da die App keine Server-Komponente hat, läuft sie auch hinter Reverse-Proxies (npm/traefik/caddy) problemlos. Keine WebSocket-Abhängigkeiten, keine Server-State, keine Datenbank.

---

## 4. Algorithmus-Pipeline (Detail)

### 4.1 Bild-Vorbereitung
1. Upload → `FileReader.readAsArrayBuffer` → `createImageBitmap`
2. Zeichnen auf Offscreen-Canvas
3. Falls Bild > 4000px: herunterrechnen auf max 4000px (breiteste Seite)
4. Pixel-Daten auslesen: `ctx.getImageData()` → `Uint8ClampedArray` (RGBA)

### 4.2 Crop & Papierformat
1. Crop-Rechteck in Bildkoordinaten berechnen
2. Auf Ziel-Canvas zeichnen (nur Crop-Region)
3. Seitenverhältnis aus Papierformat ableiten
4. Gegebenenfalls Letterbox (schwarze Ränder) oder Fit
5. Neue `ImageData` für Pipeline

#### Papierformate
- **Standard:** A4, A3, Letter, Square (1:1)
- **Großformat:** A2, A1, Tabloid (11×17"), Custom (Freie Eingabe mm)
- **Orientierung:** Portrait / Landscape
- **Export-Auflösung:** 300 DPI für Standard-Drucker, Option für 600 DPI bei Großformat

### 4.3 Farbquantisierung (Detailgrad)
1. RGB → LAB-Konvertierung aller Pixel (perceptuell gleichmäßig)
2. **k-means Clustering** im LAB-Raum:
   - k = Detailgrad-Slider-Wert (5–50)
   - Initialisierung: k-means++ Seed-Selektion
   - Iterationen: max 10 (ausreichend für Konvergenz)
   - Konvergenz-Check: Cluster-Verschiebung < Schwellwert
3. Jeder Pixel bekommt Cluster-ID zugewiesen → `labelMap` (Int32Array)
4. Cluster-Zentren → Farbpalette (LAB → RGB → HEX)
5. **Performance-Optimierung:** Sampling — nicht jeder Pixel wird geclustert, sondern jeder N-te (z.B. jeder 4.). Finaler Pass weist alle Pixel zu.
6. Quantisiertes Bild rendern: jeder Pixel = seine Cluster-Farbe
7. **Region-Merging (Auto-Merge):**
   - Connected Components auf labelMap → einzelne Regionen
   - Regionen mit Fläche < `minRegionSize` (Default 100px) identifizieren
   - Diese Regionen mit Nachbar-Region verschmelzen, die die ähnlichste Cluster-Farbe hat
   - Neu labelMap aktualisieren
8. **Rauschen reduzieren (Advanced, optional):**
   - Morphologische Opening-Operation (Erosion + Dilation mit 3×3 Kernel)
   - Entfernt Einzel-Pixel-Artefakte vor dem Region-Merging
   - Default: aus, Advanced-Option zum Aktivieren

### 4.4 Outline-Extraktion
1. `labelMap` durchlaufen: für jedes Pixel prüfen, ob Nachbarn andere Labels haben
2. Pixel mit unterschiedlichen Nachbarn = Grenzpixel → Binärmaske
3. **Connected Components** auf Grenzmaske → einzelne Kontur-Segmente
4. **Kontur-Tracing:** Moore-Neighbor- oder Square-Tracing-Algorithmus
   - Liefert geordnete Punkt-Listen für jede Region-Grenze
5. **Douglas-Peucker Vereinfachung:** Reduziert Punkt-Anzahl, glättet Pfade
   - Epsilon abhängig von Bildgröße (z.B. 1–3px Toleranz)
6. Ergebnis: Array von Pfaden, jeder Pfad = Array von {x, y} Punkten

### 4.5 Region-Nummerierung
1. Für jede zusammenhängende Farb-Region: Zentroid berechnen
   - Schwerpunkt aller Pixel in dieser Region
2. Nummerierung: fortlaufend, sortiert nach Region-Größe (größte zuerst) oder nach Farbe
3. Nummer am Zentroid platzieren
4. Font-Size abhängig von Region-Fläche (zu kleine Regionen → Nummer daneben mit Linie)

### 4.6 Farbanpassung
- **Farb-Swap:** Palette-Array modifizieren, Regionen neu rendern mit neuer Farbe
- **Filter:** Transformation der gesamten Palette
  - Pastell: LAB-Helligkeit +15, Chroma -10
  - Vintage: Sepia-Töne, reduzierte Sättigung
  - High-Contrast: LAB-Luminanz strecken, Chroma +15
  - Grayscale: Chroma = 0
- **Re-Render:** Nur Palette austauschen, labelMap bleibt gleich → instant

### 4.7 Export

#### PNG/JPG
- Canvas mit fertigen Outlines + Nummern → `canvas.toBlob('image/png')`
- Download via `<a download>` Link

#### PDF (jsPDF)
- Seite 1: Outline-Zeichnung mit nummerierten Regionen (Canvas → Bild → jsPDF.addImage)
- Seite 2: Farb-Legende (Tabelle: Nummer → Farb-Swatch → HEX-Code)
- Papiergröße aus Step 2 übernehmen

#### SVG (Laser-Export)
- Pfade aus Outline-Pipeline → `<path d="M x,y L ... Z">` Strings
- Nur Outlines, kein Fill (Laser graviert Linien)
- ViewBox = Bildabmessungen
- **Laser-Modus "Layer-per-Color":** jede Farbe ein separater `<g>` Layer mit `data-color` Attribut (für mehrfarbige Gravierung in mehreren Durchgängen)
- **Laser-Modus "Graustufen":** Regionen als gefüllte `<rect>`/`<path>` mit `fill="rgb(g,g,g)"` entsprechend LAB-Luminanz (für variablen Laser-Power-PWM-Gravierung in einem Durchgang)

#### DXF (Optional)
- DXF ist Text-Format (ASCII), kein Binary
- Header-Section + Entities-Section (LWPOLYLINE pro Kontur)
- Nur Outline-Modus, keine Fills (DXF unterstützt keine zuverlässige Layer-per-Color in einfachem Export)
- Niedrigere Priorität — die meisten Laser-Tools (LightBurn, RDWorks) akzeptieren SVG problemlos

---

## 5. Datenstrukturen

```typescript
// types.ts

type Locale = 'de' | 'en';

interface ProjectState {
  sourceImage: ImageBitmap | null;
  crop: CropRegion | null;
  paperFormat: PaperFormat;
  orientation: 'portrait' | 'landscape';
  detailLevel: number;          // 5–50, default 15
  minRegionSize: number;         // default 100, advanced 10–1000
  reduceNoise: boolean;          // default false, advanced
  labelMap: Int32Array | null;   // Cluster-ID pro Pixel
  palette: Color[];              // Farbpalette
  outlines: OutlinePath[];      // Vereinfachte Pfade
  regions: Region[];             // Nummerierte Regionen
  laserMode: LaserMode;          // 'outline' | 'layer-per-color' | 'grayscale'
}

interface Settings {
  locale: Locale;
  theme: 'light' | 'dark';
  advancedMode: boolean;
}

interface CropRegion { x: number; y: number; w: number; h: number; }
interface PaperFormat { name: string; width: number; height: number; unit: 'mm' | 'px'; dpi: number; }
interface Color { id: number; lab: [number, number, number]; rgb: [number, number, number]; hex: string; }
interface OutlinePath { points: { x: number; y: number }[]; regionId: number; }
interface Region { id: number; colorId: number; centroid: { x: number; y: number }; area: number; }
type LaserMode = 'outline' | 'layer-per-color' | 'grayscale';
```

---

## 6. Performance-Targets

| Operation | Ziel-Latenz | Strategie |
|---|---|---|
| Upload + Anzeige | < 100ms | createImageBitmap (async) |
| Crop | instant | Canvas redraw |
| k-means (k=20, 1MP) | < 200ms | Sampling + Web Worker |
| Outline-Extraktion | < 100ms | Typed Arrays, single-pass |
| Pfad-Vereinfachung | < 50ms | Douglas-Peucker mit Early-Exit |
| Farbswap/Filter | < 50ms | Nur Palette austauschen, Canvas redraw |
| PNG-Export | < 200ms | canvas.toBlob |
| PDF-Export | < 500ms | jsPDF.addImage |
| SVG-Export | < 100ms | String-Generierung |

### Web Worker Strategie
- k-means und Outline-Extraktion in Web Worker auslagern
- UI bleibt responsive (kein Main-Thread-Blocking)
- Worker kommuniziert via `postMessage` mit `Transferable` (ArrayBuffer)
- Progressive: erst grobes Ergebnis (k=5), dann verfeinern

---

## 7. npm Scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "biome check src/",
    "format": "biome format --write src/",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "knip": "knip --no-progress"
  }
}
```

---

## 8. Browser Support

### Minimum (evergreen browsers, letzte 2 Versionen)
- **Chrome/Edge** 120+
- **Firefox** 120+
- **Safari** 17+

### Erforderliche APIs (alle in evergreen browsers verfügbar)
- Canvas 2D API (`getContext('2d')`, `getImageData`, `putImageData`)
- `createImageBitmap` (async Bild-Decode)
- Web Workers (`Worker`, `postMessage`, `Transferable`)
- OffscreenCanvas (optional, falls Worker direkt rendern sollen)
- `FileReader` / `Blob` / `URL.createObjectURL` (Upload + Download)
- `requestAnimationFrame` (Live-Preview-Loop)
- `Intl.NumberFormat` (i18n Zahlen-Formatierung)

### Mobile
- Touch-Events für Crop/Zoom/Pan
- Responsive Layout (min. 360px Breite)
- Bild-Auswahl aus Foto-Bibliothek (File-API mit `accept="image/*"`)

### Kompatibilitäts-Check
- `navigator.canShare()` für Web Share API (optional, für mobile Sharing)
- `OffscreenCanvas` mit Feature-Detection, Fallback auf Main-Thread

---

## 9. Accessibility (a11y)

- **Keyboard-Navigation** — alle Schritte per Tab/Enter bedienbar
- **ARIA-Labels** — Slider, Buttons, Canvas-Regionen mit `aria-label` und `role`
- **Screen Reader** — Bild-Upload mit `aria-describedby`, Live-Region für "23 Farben, 187 Regionen"
- **Color Contrast** — UI erfüllt WCAG 2.1 AA (min. 4.5:1 für Text)
- **Focus Management** — sichtbarer Focus-Ring, Focus-Trap im Wizard
- **Reduced Motion** — `prefers-reduced-motion` Media Query respektieren
- **Touch Targets** — min. 44×44px für alle interaktiven Elemente (Mobile)
- **Canvas a11y** — Outline-Canvas mit `role="img"` und `aria-label` mit aktueller Step-Beschreibung

---

## 10. Error Handling & Edge Cases

### Bild-Eingabe
- **Korruptes Bild** → Fehlermeldung "Bild konnte nicht geladen werden", Upload-Reset
- **Nicht unterstütztes Format** (GIF, BMP, TIFF) → "Bitte JPG, PNG oder WEBP verwenden"
- **Zu große Datei** (>50MB) → Warnung vor Upload, Option zum Trotz laden
- **Leeres/weißes Bild** → k-means mit k=1, Hinweis "Bild hat zu wenig Kontrast für Detailgrad"

### Pipeline
- **k=5 bei einfarbigem Bild** → alle Pixel in einem Cluster, Outline leer → Hinweis an User
- **k-means Konvergenz-Fehler** → max. 10 Iterationen, dann bestes Ergebnis nehmen
- **Memory-Limit überschritten** (>100MP Bild) → automatisches Herunterskalieren auf max 4000px
- **Web Worker Crash** → Fallback auf Main-Thread-Berechnung mit Progress-Indicator

### Export
- **PDF-Generierung fehlgeschlagen** → Fehlermeldung mit Retry-Button
- **SVG-Export bei 0 Regionen** → leere SVG mit ViewBox, Hinweis
- **Browser Download blockiert** → Fallback: SVG als Text in Clipboard, "In Datei einfügen"

### User-Feedback
- Toast-Benachrichtigungen für Erfolge/Fehler (auto-dismiss nach 5s)
- Loading-Spinner bei langen Operationen (>200ms)
- Error-Boundary in Svelte fängt Component-Crashes ab

---

## 11. State Persistence

### Prinzip: Alles bleibt auf dem Gerät (Privacy by Design)
- **Keine Server, keine Uploads** — Persistenz ausschließlich lokal
- PWA Service Worker cached nur static assets (HTML/CSS/JS), keine Nutzerdaten

### UI-Settings (localStorage)
- `locale` (Sprache), `theme` (light/dark), `advancedMode` (bool)
- localStorage Key: `tintpath:settings`, Wert als JSON

### Session-Resume (IndexedDB) — Entscheidung 2026-07
- Die aktuelle Session (Original-Bild als Blob + alle Wizard-Parameter +
  Paletten-Anpassungen) wird debounced in IndexedDB (`tintpath`/`session`)
  gespeichert, damit User nach einem Refresh weitermachen können
- Pipeline-Ergebnisse (labelMap etc.) werden NICHT gespeichert — die Pipeline
  ist deterministisch (fester Seed) und rechnet beim Restore identisch neu
- Beim Start zeigt Step 1 ein "Fortsetzen?"-Banner mit Resume/Verwerfen
- "Neu starten" und "Verwerfen" löschen die gespeicherte Session
- Alles bleibt auf dem Gerät; nichts wird übertragen

---

## 12. PWA Konfiguration

```json
// static/manifest.json
{
  "name": "Tintpath",
  "short_name": "Tintpath",
  "description": "Create paint-by-numbers templates from images",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
- Service Worker via `vite-plugin-pwa` (Workbox, auto-update)
- Precache: HTML, CSS, JS, Fonts, i18n JSON
- Keine Runtime-Caching-Strategien nötig (keine API-Calls)
- Offline-fähig nach erstem Laden

### Vite Plugin Config
```typescript
// vite.config.ts
import { SvelteKitPWA } from '@vite-pwa/kit';
export default {
  plugins: [
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'] }
    })
  ]
};
```

---

## 13. UX/UI-Prinzipien

- **Linearer Wizard** mit Fortschrittsanzeige (Step 1/6, 2/6, ...)
- **Zurück-Button** zu jedem Schritt — State bleibt erhalten
- **Live-Preview** immer sichtbar (Split-View: Original vs. Ergebnis)
- **Mobile-First** — funktioniert auf Phone und Desktop
- **Dark-Mode** optional
- **Keine Logins** — sofort loslegen
- **Debounce** bei Slider-Input (200ms) um Re-Compute-Storms zu vermeiden

---

## 14. Milestones

### M1: Core-Pipeline Prototyp (Proof-of-Concept)
- [ ] SvelteKit-Projekt aufsetzen
- [ ] Bild-Upload + Canvas-Anzeige
- [ ] k-means Quantisierung mit Detailgrad-Slider
- [ ] Outline-Extraktion + Kontur-Vereinfachung
- [ ] PNG-Export der Outlines
- [ ] Live-Preview: Original vs. quantisiert
- **Ziel:** Beweisen dass die Pipeline im Browser performant läuft

### M2: Full Wizard UI
- [ ] Crop-Komponente
- [ ] Papierformat-Auswahl
- [ ] Step-Navigation (Wizard-Framework)
- [ ] Outline-View mit Zoom/Pan + Nummern
- [ ] Split-View/Toggle Preview
- **Ziel:** Kompletter Workflow durchklickbar

### M3: Farb-System
- [ ] Farbpalette-Anzeige (Swatches)
- [ ] Einzel-Farb-Swap (Color-Picker)
- [ ] Preset-Filter (Pastell, Vintage, High-Contrast, Grayscale)
- [ ] Filter-Vorschau mit Live-Update
- **Ziel:** Farb-Anpassung voll funktionsfähig

### M4: Export-System
- [ ] PNG/JPG Export (hochauflösend)
- [ ] PDF-Export mit jsPDF (Outline-Seite + Farb-Legende)
- [ ] SVG-Export für Laser (Pfade-only, kein Fill)
- [ ] Export-Optionen (Auflösung, Qualität)
- **Ziel:** Alle Export-Formate funktional

### M5: Polish & Deploy
- [ ] Responsive/Mobile-Optimierung
- [ ] Dark-Mode
- [ ] Performance-Optimierung (Web Worker, Sampling)
- [ ] Docker Build + docker-compose
- [ ] Lighthouse-Audit (>90 alle Kategorien)
- [ ] README / About-Page
- **Ziel:** Produktionsreife, selbst-hostbare App
