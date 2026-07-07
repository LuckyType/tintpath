import { type Readable, get, writable } from 'svelte/store';
import { rotateBitmap } from '../image';
import { makePaperFormat, paperAspect } from '../paper';
import { applyFilter, swapColor } from '../pipeline/palette';
import { rgbToLab } from '../pipeline/quantize';
import { type PipelineRunner, runPipeline } from '../pipeline/runner';
import type {
  CropRegion,
  Orientation,
  PaletteFilter,
  PaperFormat,
  ProjectState,
  Smoothing,
} from '../types';

export const TOTAL_STEPS = 6;
/** Pipeline input is capped to keep recomputes interactive. */
const MAX_PIPELINE_SIDE = 2400;

function initialState(): ProjectState {
  return {
    step: 1,
    sourceImage: null,
    sourceBlob: null,
    sourceName: '',
    rotation: 0,
    crop: null,
    paperFormat: makePaperFormat('A4'),
    orientation: 'portrait',
    detailLevel: 15,
    minRegionSize: 100,
    reduceNoise: false,
    smoothing: 'medium',
    croppedImage: null,
    croppedSignature: '',
    result: null,
    basePalette: [],
    palette: [],
    activeFilter: 'none',
    laserMode: 'outline',
    numberOpacity: 0.9,
    lineScale: 1,
    jpgQuality: 0.92,
    customPalette: null,
    processing: false,
    error: null,
  };
}

/** Largest crop rect with the paper aspect ratio, centered in the image. */
export function defaultCrop(imageWidth: number, imageHeight: number, aspect: number): CropRegion {
  let w = imageWidth;
  let h = w / aspect;
  if (h > imageHeight) {
    h = imageHeight;
    w = h * aspect;
  }
  return { x: (imageWidth - w) / 2, y: (imageHeight - h) / 2, w, h };
}

/** The subset of state that session persistence stores and restores. */
export interface SessionSnapshot {
  step: number;
  sourceName: string;
  rotation: number;
  crop: CropRegion | null;
  paperFormat: PaperFormat;
  orientation: Orientation;
  detailLevel: number;
  minRegionSize: number;
  reduceNoise: boolean;
  smoothing: Smoothing;
  laserMode: ProjectState['laserMode'];
  numberOpacity: number;
  lineScale: number;
  jpgQuality: number;
  activeFilter: PaletteFilter;
  paletteHexes: string[] | null;
  customPalette: string[] | null;
}

export interface ProjectStore extends Readable<ProjectState> {
  setImage(image: ImageBitmap, name: string, blob?: Blob | null): void;
  setCrop(crop: CropRegion): void;
  setPaperFormat(format: PaperFormat): void;
  setOrientation(orientation: Orientation): void;
  setDetailLevel(value: number): void;
  setMinRegionSize(value: number): void;
  setReduceNoise(value: boolean): void;
  setSmoothing(value: Smoothing): void;
  setLaserMode(mode: ProjectState['laserMode']): void;
  setNumberOpacity(value: number): void;
  setLineScale(value: number): void;
  setJpgQuality(value: number): void;
  setCustomPalette(hexes: string[] | null): void;
  rotateImage(direction: 1 | -1): Promise<void>;
  setCroppedImage(image: ImageData, signature?: string): void;
  applyCrop(): void;
  recompute(): Promise<void>;
  applyPaletteFilter(filter: PaletteFilter): void;
  swapPaletteColor(colorId: number, hex: string): void;
  overridePalette(hexes: string[]): void;
  restoreSession(snapshot: SessionSnapshot, image: ImageBitmap, blob: Blob): Promise<void>;
  nextStep(): void;
  prevStep(): void;
  goToStep(step: number): void;
  reset(): void;
}

export function createProjectStore(runner: PipelineRunner = runPipeline): ProjectStore {
  const store = writable<ProjectState>(initialState());
  const { subscribe, update, set } = store;

  function resetCropToAspect(state: ProjectState): ProjectState {
    if (!state.sourceImage) return state;
    const aspect = paperAspect(state.paperFormat, state.orientation);
    return {
      ...state,
      crop: defaultCrop(state.sourceImage.width, state.sourceImage.height, aspect),
    };
  }

  /** Replace the pipeline input image and invalidate downstream results. */
  function setCroppedImage(image: ImageData, signature = ''): void {
    update((st) => ({
      ...st,
      croppedImage: image,
      croppedSignature: signature,
      result: null,
      basePalette: [],
      palette: [],
      activeFilter: 'none',
    }));
  }

  function applyCrop(): void {
    const s = get(store);
    if (!s.sourceImage || !s.crop || typeof document === 'undefined') return;
    const cw = Math.max(1, Math.round(s.crop.w));
    const ch = Math.max(1, Math.round(s.crop.h));
    const scale = Math.min(1, MAX_PIPELINE_SIDE / Math.max(cw, ch));
    const tw = Math.max(1, Math.round(cw * scale));
    const th = Math.max(1, Math.round(ch * scale));
    const signature = `${Math.round(s.crop.x)},${Math.round(s.crop.y)},${cw},${ch}@${tw}x${th}`;
    if (signature === s.croppedSignature && s.croppedImage) return;

    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(s.sourceImage, s.crop.x, s.crop.y, cw, ch, 0, 0, tw, th);
    setCroppedImage(ctx.getImageData(0, 0, tw, th), signature);
  }

  async function recompute(): Promise<void> {
    const state = get(store);
    if (!state.croppedImage) return;
    update((s) => ({ ...s, processing: true, error: null }));
    const image = state.croppedImage;
    try {
      const result = await runner(image, {
        detailLevel: state.detailLevel,
        minRegionSize: state.minRegionSize,
        reduceNoise: state.reduceNoise,
        smoothing: state.smoothing,
        fixedPalette: state.customPalette ?? undefined,
      });
      if (result === null) return; // superseded by a newer run
      update((s) => ({
        ...s,
        result,
        basePalette: result.palette,
        palette: result.palette,
        activeFilter: 'none',
        processing: false,
      }));
    } catch (error) {
      update((s) => ({
        ...s,
        processing: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  function applyPaletteFilterFn(filter: PaletteFilter): void {
    update((s) => ({
      ...s,
      activeFilter: filter,
      palette: applyFilter(s.basePalette, filter),
    }));
  }

  /** Replace all palette colors by hex value (used when restoring a session). */
  function overridePalette(hexes: string[]): void {
    update((s) => {
      if (s.palette.length === 0 || hexes.length !== s.palette.length) return s;
      const palette = s.palette.map((color, i) => {
        const hex = hexes[i]?.toLowerCase();
        if (!hex || hex === color.hex) return color;
        const r = Number.parseInt(hex.slice(1, 3), 16);
        const g = Number.parseInt(hex.slice(3, 5), 16);
        const b = Number.parseInt(hex.slice(5, 7), 16);
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return color;
        return {
          id: color.id,
          rgb: [r, g, b] as [number, number, number],
          lab: rgbToLab(r, g, b),
          hex,
        };
      });
      return { ...s, palette, basePalette: palette };
    });
  }

  return {
    subscribe,

    setImage(image, name, blob = null) {
      update((s) => {
        const next: ProjectState = {
          ...initialState(),
          paperFormat: s.paperFormat,
          orientation: s.orientation,
          detailLevel: s.detailLevel,
          minRegionSize: s.minRegionSize,
          reduceNoise: s.reduceNoise,
          smoothing: s.smoothing,
          laserMode: s.laserMode,
          numberOpacity: s.numberOpacity,
          lineScale: s.lineScale,
          jpgQuality: s.jpgQuality,
          customPalette: s.customPalette,
          sourceImage: image,
          sourceBlob: blob,
          sourceName: name,
          step: 2,
        };
        return resetCropToAspect(next);
      });
    },

    setCrop(crop) {
      update((s) => ({ ...s, crop }));
    },

    setPaperFormat(format) {
      update((s) => resetCropToAspect({ ...s, paperFormat: format }));
    },

    setOrientation(orientation) {
      update((s) => resetCropToAspect({ ...s, orientation }));
    },

    setDetailLevel(value) {
      update((s) => ({ ...s, detailLevel: Math.max(5, Math.min(50, Math.round(value))) }));
    },

    setMinRegionSize(value) {
      update((s) => ({ ...s, minRegionSize: Math.max(10, Math.min(1000, Math.round(value))) }));
    },

    setReduceNoise(value) {
      update((s) => ({ ...s, reduceNoise: value }));
    },

    setSmoothing(value) {
      update((s) => ({ ...s, smoothing: value }));
    },

    setLaserMode(mode) {
      update((s) => ({ ...s, laserMode: mode }));
    },

    setNumberOpacity(value) {
      update((s) => ({ ...s, numberOpacity: Math.max(0, Math.min(1, value)) }));
    },

    setLineScale(value) {
      update((s) => ({ ...s, lineScale: Math.max(0.5, Math.min(2.5, value)) }));
    },

    setJpgQuality(value) {
      update((s) => ({ ...s, jpgQuality: Math.max(0.5, Math.min(1, value)) }));
    },

    setCustomPalette(hexes) {
      const valid = hexes?.filter((h) => /^#[0-9a-fA-F]{6}$/.test(h)).map((h) => h.toLowerCase());
      update((s) => ({ ...s, customPalette: valid && valid.length > 0 ? valid : null }));
    },

    /** Rotate the source image in quarter turns; resets crop to the new aspect. */
    async rotateImage(direction) {
      const s = get(store);
      if (!s.sourceImage || typeof document === 'undefined') return;
      const rotated = await rotateBitmap(s.sourceImage, direction);
      update((st) =>
        resetCropToAspect({
          ...st,
          sourceImage: rotated,
          rotation: (st.rotation + direction * 90 + 360) % 360,
          croppedImage: null,
          croppedSignature: '',
          result: null,
          basePalette: [],
          palette: [],
          activeFilter: 'none',
        }),
      );
    },

    setCroppedImage,

    /**
     * Rasterize the crop region into pipeline input. Skips work (and keeps
     * the existing result) when the crop hasn't changed since the last call.
     */
    applyCrop,

    recompute,

    applyPaletteFilter: applyPaletteFilterFn,

    swapPaletteColor(colorId, hex) {
      update((s) => {
        const palette = swapColor(s.palette, colorId, hex);
        // Manual swaps become the new baseline so filters start from them.
        return { ...s, palette, basePalette: palette, activeFilter: 'none' };
      });
    },

    overridePalette,

    /**
     * Rebuild the full state from a saved session: the pipeline is
     * deterministic, so recomputing with the same parameters reproduces the
     * same regions; saved palette edits are re-applied on top by hex.
     */
    async restoreSession(snapshot, image, blob) {
      update(() => ({
        ...initialState(),
        sourceImage: image,
        sourceBlob: blob,
        sourceName: snapshot.sourceName,
        rotation: snapshot.rotation ?? 0,
        crop: snapshot.crop,
        paperFormat: snapshot.paperFormat,
        orientation: snapshot.orientation,
        detailLevel: snapshot.detailLevel,
        minRegionSize: snapshot.minRegionSize,
        reduceNoise: snapshot.reduceNoise,
        smoothing: snapshot.smoothing,
        laserMode: snapshot.laserMode,
        numberOpacity: snapshot.numberOpacity,
        lineScale: snapshot.lineScale,
        jpgQuality: snapshot.jpgQuality,
        customPalette: snapshot.customPalette ?? null,
        step: Math.max(2, Math.min(TOTAL_STEPS, snapshot.step)),
      }));
      if (!get(store).crop) {
        update((s) => resetCropToAspect(s));
      }
      applyCrop();
      await recompute();
      // Invariant: a non-'none' filter means the palette is a pure transform
      // of the base; otherwise saved hexes carry the user's manual swaps.
      if (snapshot.activeFilter !== 'none') {
        applyPaletteFilterFn(snapshot.activeFilter);
      } else if (snapshot.paletteHexes) {
        overridePalette(snapshot.paletteHexes);
      }
    },

    nextStep() {
      update((s) => ({ ...s, step: Math.min(TOTAL_STEPS, s.step + 1) }));
    },

    prevStep() {
      update((s) => ({ ...s, step: Math.max(1, s.step - 1) }));
    },

    goToStep(step) {
      update((s) => ({ ...s, step: Math.max(1, Math.min(TOTAL_STEPS, Math.round(step))) }));
    },

    reset() {
      set(initialState());
    },
  };
}

export const project = createProjectStore();
