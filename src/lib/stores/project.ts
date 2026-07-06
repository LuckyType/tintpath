import { type Readable, get, writable } from 'svelte/store';
import { makePaperFormat, paperAspect } from '../paper';
import { applyFilter, swapColor } from '../pipeline/palette';
import { type PipelineRunner, runPipeline } from '../pipeline/runner';
import type { CropRegion, Orientation, PaletteFilter, PaperFormat, ProjectState } from '../types';

export const TOTAL_STEPS = 6;
/** Pipeline input is capped to keep recomputes interactive. */
const MAX_PIPELINE_SIDE = 2400;

function initialState(): ProjectState {
  return {
    step: 1,
    sourceImage: null,
    sourceName: '',
    crop: null,
    paperFormat: makePaperFormat('A4'),
    orientation: 'portrait',
    detailLevel: 15,
    minRegionSize: 100,
    reduceNoise: false,
    croppedImage: null,
    croppedSignature: '',
    result: null,
    basePalette: [],
    palette: [],
    activeFilter: 'none',
    laserMode: 'outline',
    numberOpacity: 0.9,
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

export interface ProjectStore extends Readable<ProjectState> {
  setImage(image: ImageBitmap, name: string): void;
  setCrop(crop: CropRegion): void;
  setPaperFormat(format: PaperFormat): void;
  setOrientation(orientation: Orientation): void;
  setDetailLevel(value: number): void;
  setMinRegionSize(value: number): void;
  setReduceNoise(value: boolean): void;
  setLaserMode(mode: ProjectState['laserMode']): void;
  setNumberOpacity(value: number): void;
  setCroppedImage(image: ImageData, signature?: string): void;
  applyCrop(): void;
  recompute(): Promise<void>;
  applyPaletteFilter(filter: PaletteFilter): void;
  swapPaletteColor(colorId: number, hex: string): void;
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

  return {
    subscribe,

    setImage(image, name) {
      update((s) => {
        const next: ProjectState = {
          ...initialState(),
          paperFormat: s.paperFormat,
          orientation: s.orientation,
          detailLevel: s.detailLevel,
          minRegionSize: s.minRegionSize,
          reduceNoise: s.reduceNoise,
          laserMode: s.laserMode,
          numberOpacity: s.numberOpacity,
          sourceImage: image,
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

    setLaserMode(mode) {
      update((s) => ({ ...s, laserMode: mode }));
    },

    setNumberOpacity(value) {
      update((s) => ({ ...s, numberOpacity: Math.max(0, Math.min(1, value)) }));
    },

    setCroppedImage,

    /**
     * Rasterize the crop region into pipeline input. Skips work (and keeps
     * the existing result) when the crop hasn't changed since the last call.
     */
    applyCrop() {
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
    },

    recompute,

    applyPaletteFilter(filter) {
      update((s) => ({
        ...s,
        activeFilter: filter,
        palette: applyFilter(s.basePalette, filter),
      }));
    },

    swapPaletteColor(colorId, hex) {
      update((s) => {
        const palette = swapColor(s.palette, colorId, hex);
        // Manual swaps become the new baseline so filters start from them.
        return { ...s, palette, basePalette: palette, activeFilter: 'none' };
      });
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
