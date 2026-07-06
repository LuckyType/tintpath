import type { OutlinePath } from '../types';

/**
 * Minimal DXF (AC1015) with one closed LWPOLYLINE per contour.
 * DXF's y-axis points up, so y-coordinates are flipped against image height.
 */
export function generateDxf(outlines: OutlinePath[], height: number): string {
  const lines: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1015',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ];

  for (const outline of outlines) {
    if (outline.points.length < 2) continue;
    lines.push(
      '0',
      'LWPOLYLINE',
      '100',
      'AcDbEntity',
      '8',
      '0',
      '100',
      'AcDbPolyline',
      '90',
      String(outline.points.length),
      '70',
      '1', // closed
    );
    for (const p of outline.points) {
      lines.push('10', p.x.toFixed(3), '20', (height - p.y).toFixed(3));
    }
  }

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}
