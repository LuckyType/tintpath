import { paperPixels } from '../paper';
import { buildRegionColorMap, drawTemplate } from '../render';
import type { Color, Orientation, PaperFormat, PipelineResult } from '../types';
import { renderGrayscalePixels } from './laser';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))),
      type,
      quality,
    );
  });
}

export interface RasterExportParams {
  result: PipelineResult;
  palette: Color[];
  paperFormat: PaperFormat;
  orientation: Orientation;
  showFill?: boolean;
  showNumbers?: boolean;
  numberOpacity?: number;
}

/** Render the template onto a print-resolution canvas. */
export function renderTemplateCanvas(params: RasterExportParams): HTMLCanvasElement {
  const { result, palette, paperFormat, orientation } = params;
  const target = paperPixels(paperFormat, orientation);
  const scale = Math.min(target.width / result.width, target.height / result.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(result.width * scale));
  canvas.height = Math.max(1, Math.round(result.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  drawTemplate(ctx, {
    outlines: result.outlines,
    placements: result.placements,
    palette,
    regionColorIds: buildRegionColorMap(result.regions),
    width: result.width,
    height: result.height,
    scale,
    showFill: params.showFill ?? false,
    showNumbers: params.showNumbers ?? true,
    numberOpacity: params.numberOpacity ?? 1,
    lineWidth: Math.max(1.2, scale * 0.8),
  });
  return canvas;
}

export async function exportRaster(
  params: RasterExportParams & { kind: 'png' | 'jpeg' },
): Promise<Blob> {
  const canvas = renderTemplateCanvas(params);
  return params.kind === 'png'
    ? canvasToBlob(canvas, 'image/png')
    : canvasToBlob(canvas, 'image/jpeg', 0.92);
}

/** Grayscale raster for single-pass variable-power laser engraving. */
export async function exportGrayscalePng(result: PipelineResult, palette: Color[]): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = result.width;
  canvas.height = result.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const pixels = renderGrayscalePixels(result.labelMap, palette, result.width, result.height);
  ctx.putImageData(new ImageData(pixels, result.width, result.height), 0, 0);
  return canvasToBlob(canvas, 'image/png');
}
