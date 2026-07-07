import { paperDims } from '../paper';
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
): LegendLayout {
  const rowHeight = 10;
  const swatchSize = 7;
  const headerSpace = 15;
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

  // Legend pages
  const layout = layoutLegend(palette, dims.width, dims.height);
  for (let page = 0; page < layout.pageCount; page++) {
    doc.addPage([dims.width, dims.height], dims.width > dims.height ? 'landscape' : 'portrait');
    doc.setFontSize(16);
    doc.setTextColor(30);
    doc.text(legendTitle, 15, 18);
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
