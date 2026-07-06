import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { makeColor } from '../pipeline/quantize';
import { runPipelineSync } from '../pipeline/run';
import type { PipelineRunner } from '../pipeline/runner';
import type { PipelineResult } from '../types';
import { TOTAL_STEPS, createProjectStore, defaultCrop } from './project';

const fakeResult = (): PipelineResult => ({
  labelMap: new Int32Array([0, 1, 0, 1]),
  palette: [makeColor(0, [50, 20, -10]), makeColor(1, [80, -5, 5])],
  regions: [],
  outlines: [],
  placements: [],
  width: 2,
  height: 2,
});

const fakeRunner: PipelineRunner = () => Promise.resolve(fakeResult());

const fakeBitmap = (width = 100, height = 100) =>
  ({ width, height, close() {} }) as unknown as ImageBitmap;

const fakeImageData = (width = 2, height = 2) =>
  ({
    data: new Uint8ClampedArray(width * height * 4).fill(200),
    width,
    height,
  }) as unknown as ImageData;

describe('project store', () => {
  it('starts with spec defaults', () => {
    const store = createProjectStore(fakeRunner);
    const state = get(store);
    expect(state.step).toBe(1);
    expect(state.detailLevel).toBe(15);
    expect(state.minRegionSize).toBe(100);
    expect(state.reduceNoise).toBe(false);
    expect(state.paperFormat.name).toBe('A4');
    expect(state.paperFormat.dpi).toBe(300);
    expect(state.orientation).toBe('portrait');
    expect(state.laserMode).toBe('outline');
    expect(state.result).toBeNull();
  });

  it('clamps step navigation to 1..TOTAL_STEPS', () => {
    const store = createProjectStore(fakeRunner);
    store.prevStep();
    expect(get(store).step).toBe(1);
    store.goToStep(99);
    expect(get(store).step).toBe(TOTAL_STEPS);
    store.nextStep();
    expect(get(store).step).toBe(TOTAL_STEPS);
    store.goToStep(-4);
    expect(get(store).step).toBe(1);
  });

  it('clamps parameters to their spec ranges', () => {
    const store = createProjectStore(fakeRunner);
    store.setDetailLevel(3);
    expect(get(store).detailLevel).toBe(5);
    store.setDetailLevel(80);
    expect(get(store).detailLevel).toBe(50);
    store.setMinRegionSize(1);
    expect(get(store).minRegionSize).toBe(10);
    store.setMinRegionSize(5000);
    expect(get(store).minRegionSize).toBe(1000);
  });

  it('setImage advances to step 2 with a paper-aspect crop', () => {
    const store = createProjectStore(fakeRunner);
    store.setImage(fakeBitmap(100, 100), 'photo.jpg');
    const state = get(store);
    expect(state.step).toBe(2);
    expect(state.sourceName).toBe('photo.jpg');
    expect(state.crop).not.toBeNull();
    if (!state.crop) return;
    // A4 portrait aspect = 210/297
    expect(state.crop.w / state.crop.h).toBeCloseTo(210 / 297, 5);
    expect(state.crop.h).toBeCloseTo(100, 5);
  });

  it('recompute stores the pipeline result and resets the filter state', async () => {
    const store = createProjectStore(fakeRunner);
    store.setCroppedImage(fakeImageData());
    await store.recompute();
    const state = get(store);
    expect(state.result).not.toBeNull();
    expect(state.palette).toHaveLength(2);
    expect(state.basePalette).toHaveLength(2);
    expect(state.processing).toBe(false);
    expect(state.activeFilter).toBe('none');
  });

  it('setCroppedImage invalidates a previous result', async () => {
    const store = createProjectStore(fakeRunner);
    store.setCroppedImage(fakeImageData());
    await store.recompute();
    expect(get(store).result).not.toBeNull();
    store.setCroppedImage(fakeImageData(4, 4));
    expect(get(store).result).toBeNull();
    expect(get(store).palette).toHaveLength(0);
  });

  it('ignores superseded pipeline runs (runner returns null)', async () => {
    const store = createProjectStore(() => Promise.resolve(null));
    store.setCroppedImage(fakeImageData());
    await store.recompute();
    expect(get(store).result).toBeNull();
  });

  it('records pipeline failures as errors', async () => {
    const store = createProjectStore(() => Promise.reject(new Error('boom')));
    store.setCroppedImage(fakeImageData());
    await store.recompute();
    const state = get(store);
    expect(state.error).toBe('boom');
    expect(state.processing).toBe(false);
  });

  it('applies palette filters without compounding', async () => {
    const store = createProjectStore(fakeRunner);
    store.setCroppedImage(fakeImageData());
    await store.recompute();

    store.applyPaletteFilter('grayscale');
    let state = get(store);
    expect(state.activeFilter).toBe('grayscale');
    expect(state.palette.every((c) => c.lab[1] === 0 && c.lab[2] === 0)).toBe(true);
    // Base palette keeps its chroma so filters derive from the original
    expect(state.basePalette.some((c) => c.lab[1] !== 0)).toBe(true);

    store.applyPaletteFilter('none');
    state = get(store);
    expect(state.palette.map((c) => c.hex)).toEqual(state.basePalette.map((c) => c.hex));
  });

  it('swapPaletteColor updates the color and becomes the new baseline', async () => {
    const store = createProjectStore(fakeRunner);
    store.setCroppedImage(fakeImageData());
    await store.recompute();
    store.swapPaletteColor(0, '#ff0000');
    const state = get(store);
    expect(state.palette[0].hex).toBe('#ff0000');
    expect(state.palette[0].rgb).toEqual([255, 0, 0]);
    expect(state.basePalette[0].hex).toBe('#ff0000');
    expect(state.activeFilter).toBe('none');
  });

  it('reset returns to the initial state', () => {
    const store = createProjectStore(fakeRunner);
    store.setImage(fakeBitmap(), 'x.png');
    store.goToStep(4);
    store.reset();
    const state = get(store);
    expect(state.step).toBe(1);
    expect(state.sourceImage).toBeNull();
    expect(state.crop).toBeNull();
    expect(state.result).toBeNull();
  });

  it('runs the real pipeline end-to-end through the store', async () => {
    const realRunner: PipelineRunner = (image, params) =>
      Promise.resolve(runPipelineSync(image.data, image.width, image.height, params));
    const store = createProjectStore(realRunner);

    // 8x8 image, left half dark red, right half light blue
    const width = 8;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const [r, g, b] = x < width / 2 ? [120, 20, 20] : [180, 200, 240];
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
    store.setCroppedImage({ data, width, height } as unknown as ImageData);
    store.setDetailLevel(5);
    store.setMinRegionSize(10);
    await store.recompute();

    const state = get(store);
    expect(state.result).not.toBeNull();
    if (!state.result) return;
    expect(state.result.palette.length).toBeGreaterThanOrEqual(2);
    expect(state.result.regions.length).toBeGreaterThanOrEqual(2);
    expect(state.result.outlines.length).toBe(state.result.regions.length);
    expect(state.result.placements.length).toBe(state.result.regions.length);
    // Every placement number references a palette color
    for (const placement of state.result.placements) {
      expect(placement.number).toBeGreaterThanOrEqual(1);
      expect(placement.number).toBeLessThanOrEqual(state.result.palette.length);
    }
  });
});
