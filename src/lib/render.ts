import type { Color, LabelPlacement, OutlinePath } from './types';

/** Rasterize the label map with the given palette into RGBA pixels. */
export function renderQuantizedPixels(
  labelMap: Int32Array,
  palette: Color[],
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < labelMap.length; p++) {
    const color = palette[labelMap[p]];
    const i = p * 4;
    out[i] = color ? color.rgb[0] : 0;
    out[i + 1] = color ? color.rgb[1] : 0;
    out[i + 2] = color ? color.rgb[2] : 0;
    out[i + 3] = 255;
  }
  return out;
}

export interface TemplateOptions {
  outlines: OutlinePath[];
  placements: LabelPlacement[];
  palette: Color[];
  regionColorIds: Map<number, number>;
  width: number;
  height: number;
  scale: number;
  offsetX?: number;
  offsetY?: number;
  showFill: boolean;
  showNumbers: boolean;
  numberOpacity?: number;
  lineWidth?: number;
  background?: string;
}

function tracePath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
  if (points.length === 0) return;
  // +0.5 centers strokes on pixel centers
  ctx.beginPath();
  ctx.moveTo(points[0].x + 0.5, points[0].y + 0.5);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x + 0.5, points[i].y + 0.5);
  }
  ctx.closePath();
}

/**
 * Draw the paint-by-numbers template. Coordinates are in image space; the
 * caller-provided scale maps them onto the target canvas. Outlines must be
 * sorted largest-first so filled mode paints enclosed regions on top.
 */
export function drawTemplate(ctx: CanvasRenderingContext2D, options: TemplateOptions): void {
  const {
    outlines,
    placements,
    palette,
    regionColorIds,
    width,
    height,
    scale,
    showFill,
    showNumbers,
    background = '#ffffff',
  } = options;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, options.offsetX ?? 0, options.offsetY ?? 0);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  if (showFill) {
    for (const outline of outlines) {
      const colorId = regionColorIds.get(outline.regionId);
      const color = colorId !== undefined ? palette[colorId] : undefined;
      if (!color || outline.points.length < 3) continue;
      tracePath(ctx, outline.points);
      ctx.fillStyle = color.hex;
      ctx.fill();
    }
  }

  ctx.strokeStyle = showFill ? 'rgba(0,0,0,0.55)' : '#1e293b';
  ctx.lineWidth = (options.lineWidth ?? 1.2) / scale;
  ctx.lineJoin = 'round';
  for (const outline of outlines) {
    if (outline.points.length < 2) continue;
    tracePath(ctx, outline.points);
    ctx.stroke();
  }

  if (showNumbers) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = Math.max(0, Math.min(1, options.numberOpacity ?? 1));
    ctx.fillStyle = showFill ? '#0f172a' : '#334155';
    for (const placement of placements) {
      ctx.font = `${placement.fontSize}px system-ui, sans-serif`;
      ctx.fillText(String(placement.number), placement.x + 0.5, placement.y + 0.5);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Map regionId -> colorId for quick lookup while drawing. */
export function buildRegionColorMap(
  regions: { id: number; colorId: number }[],
): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of regions) map.set(r.id, r.colorId);
  return map;
}
