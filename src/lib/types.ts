export type Locale = 'de' | 'en';

export type Orientation = 'portrait' | 'landscape';

export type LaserMode = 'outline' | 'layer-per-color' | 'grayscale';

export type PaletteFilter = 'none' | 'pastel' | 'vintage' | 'high-contrast' | 'grayscale';

export interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PaperFormat {
  name: string;
  width: number;
  height: number;
  unit: 'mm' | 'px';
  dpi: number;
}

export interface Color {
  id: number;
  lab: [number, number, number];
  rgb: [number, number, number];
  hex: string;
}

export interface OutlinePath {
  points: { x: number; y: number }[];
  regionId: number;
}

export interface Region {
  id: number;
  colorId: number;
  centroid: { x: number; y: number };
  area: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  seed: { x: number; y: number };
}

export interface LabelPlacement {
  regionId: number;
  colorId: number;
  number: number;
  x: number;
  y: number;
  fontSize: number;
}

export interface PipelineParams {
  detailLevel: number;
  minRegionSize: number;
  reduceNoise: boolean;
  seed?: number;
}

export interface PipelineResult {
  labelMap: Int32Array;
  palette: Color[];
  regions: Region[];
  outlines: OutlinePath[];
  placements: LabelPlacement[];
  width: number;
  height: number;
}

export interface ProjectState {
  step: number;
  sourceImage: ImageBitmap | null;
  sourceName: string;
  crop: CropRegion | null;
  paperFormat: PaperFormat;
  orientation: Orientation;
  detailLevel: number;
  minRegionSize: number;
  reduceNoise: boolean;
  croppedImage: ImageData | null;
  croppedSignature: string;
  result: PipelineResult | null;
  basePalette: Color[];
  palette: Color[];
  activeFilter: PaletteFilter;
  laserMode: LaserMode;
  numberOpacity: number;
  processing: boolean;
  error: string | null;
}

export interface Settings {
  locale: Locale;
  theme: 'light' | 'dark';
  advancedMode: boolean;
}
