import { paperDims } from '../paper';
import { buildRegionColorMap, drawTemplate } from '../render';
import type { Color, Orientation, PaperFormat, PipelineResult } from '../types';
import { renderTemplateCanvas } from './png';

export interface LegendEntry {
  number: number;
  hex: string;
  page: number;
  x: number;
  y: number;
}

export interface LegendLayout {
  entries: LegendEntry[];
  pageCount: number;
  rowHeight: number;
  swatchSize: number;
  columnWidth: number;
}

/**
 * Compute legend positions (mm) with column flow and page breaks.
 * Pure so it can be unit-tested without jsPDF.
 */
export function layoutLegend(
  palette: Color[],
  pageWidth: number,
  pageHeight: number,
  margin = 15,
  headerSpace = 15,
): LegendLayout {
  const rowHeight = 10;
  const swatchSize = 7;
  const usableHeight = pageHeight - margin * 2 - headerSpace;
  const rowsPerColumn = Math.max(1, Math.floor(usableHeight / rowHeight));
  const columnWidth = 60;
  const columnsPerPage = Math.max(1, Math.floor((pageWidth - margin * 2) / columnWidth));
  const rowsPerPage = rowsPerColumn * columnsPerPage;

  const entries: LegendEntry[] = palette.map((color, i) => {
    const page = Math.floor(i / rowsPerPage);
    const indexOnPage = i % rowsPerPage;
    const column = Math.floor(indexOnPage / rowsPerColumn);
    const row = indexOnPage % rowsPerColumn;
    return {
      number: color.id + 1,
      hex: color.hex,
      page,
      x: margin + column * columnWidth,
      y: margin + headerSpace + row * rowHeight,
    };
  });

  return {
    entries,
    pageCount: palette.length === 0 ? 1 : Math.floor((palette.length - 1) / rowsPerPage) + 1,
    rowHeight,
    swatchSize,
    columnWidth,
  };
}

export interface PdfExportParams {
  result: PipelineResult;
  palette: Color[];
  paperFormat: PaperFormat;
  orientation: Orientation;
  legendTitle: string;
  showFill?: boolean;
  showNumbers?: boolean;
  numberOpacity?: number;
  lineScale?: number;
}

/** Template page(s) + color legend, sized to the chosen paper format. */
export async function exportPdf(params: PdfExportParams): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const { result, palette, paperFormat, orientation, legendTitle } = params;
  const dims = paperDims(paperFormat, orientation);

  const doc = new jsPDF({
    orientation: dims.width > dims.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [dims.width, dims.height],
    compress: true,
  });

  // Page 1: the numbered template, centered with a small margin
  const canvas = renderTemplateCanvas(params);
  const margin = 8;
  const availW = dims.width - margin * 2;
  const availH = dims.height - margin * 2;
  const scale = Math.min(availW / canvas.width, availH / canvas.height);
  const imgW = canvas.width * scale;
  const imgH = canvas.height * scale;
  doc.addImage(
    canvas.toDataURL('image/png'),
    'PNG',
    (dims.width - imgW) / 2,
    (dims.height - imgH) / 2,
    imgW,
    imgH,
  );

  // Colored mini reference (like the picture on a physical kit box)
  const refCanvas = document.createElement('canvas');
  const refScale = Math.min(2, 640 / Math.max(result.width, result.height));
  refCanvas.width = Math.max(1, Math.round(result.width * refScale));
  refCanvas.height = Math.max(1, Math.round(result.height * refScale));
  const refCtx = refCanvas.getContext('2d');
  let refHeightMm = 0;
  const refWidthMm = 45;
  if (refCtx) {
    drawTemplate(refCtx, {
      outlines: result.outlines,
      placements: result.placements,
      palette,
      regionColorIds: buildRegionColorMap(result.regions),
      width: result.width,
      height: result.height,
      scale: refScale,
      showFill: true,
      showNumbers: false,
      lineWidth: 1,
    });
    refHeightMm = Math.min(60, (refWidthMm * refCanvas.height) / refCanvas.width);
  }

  // Legend pages — rows start below the title and the reference image
  const headerSpace = Math.max(15, refHeightMm + 8);
  const layout = layoutLegend(palette, dims.width, dims.height, 15, headerSpace);
  for (let page = 0; page < layout.pageCount; page++) {
    doc.addPage([dims.width, dims.height], dims.width > dims.height ? 'landscape' : 'portrait');
    doc.setFontSize(16);
    doc.setTextColor(30);
    doc.text(legendTitle, 15, 18);
    if (page === 0 && refCtx && refHeightMm > 0) {
      doc.addImage(
        refCanvas.toDataURL('image/png'),
        'PNG',
        dims.width - 15 - (refHeightMm * refCanvas.width) / refCanvas.height,
        15,
        (refHeightMm * refCanvas.width) / refCanvas.height,
        refHeightMm,
      );
    }
    doc.setFontSize(10);
    for (const entry of layout.entries) {
      if (entry.page !== page) continue;
      const color = palette[entry.number - 1];
      doc.setFillColor(color.rgb[0], color.rgb[1], color.rgb[2]);
      doc.setDrawColor(120);
      doc.rect(
        entry.x + 8,
        entry.y - layout.swatchSize + 1.5,
        layout.swatchSize,
        layout.swatchSize,
        'FD',
      );
      doc.setTextColor(30);
      doc.text(String(entry.number), entry.x, entry.y);
      doc.setTextColor(110);
      doc.text(entry.hex, entry.x + 18, entry.y);
    }
  }

  return doc.output('blob');
}
