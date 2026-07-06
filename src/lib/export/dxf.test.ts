import { describe, expect, it } from 'vitest';
import type { OutlinePath } from '../types';
import { generateDxf } from './dxf';

const square: OutlinePath = {
  regionId: 0,
  points: [
    { x: 0, y: 0 },
    { x: 9, y: 0 },
    { x: 9, y: 9 },
    { x: 0, y: 9 },
  ],
};

describe('generateDxf', () => {
  it('contains the required DXF structure', () => {
    const dxf = generateDxf([square], 10);
    expect(dxf).toContain('SECTION');
    expect(dxf).toContain('ENTITIES');
    expect(dxf).toContain('$ACADVER');
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
  });

  it('emits one closed LWPOLYLINE per outline with a vertex count', () => {
    const dxf = generateDxf([square, square], 10);
    expect(dxf.match(/LWPOLYLINE/g)).toHaveLength(2);
    expect(dxf).toContain('90\n4'); // vertex count
    expect(dxf).toContain('70\n1'); // closed flag
  });

  it('flips the y-axis (DXF y grows upward)', () => {
    const dxf = generateDxf([square], 10);
    // Image point (0, 0) becomes DXF (0, 10)
    expect(dxf).toContain('10\n0.000\n20\n10.000');
    // Image point (9, 9) becomes DXF (9, 1)
    expect(dxf).toContain('10\n9.000\n20\n1.000');
  });

  it('skips degenerate outlines', () => {
    const dxf = generateDxf([{ regionId: 0, points: [{ x: 1, y: 1 }] }], 10);
    expect(dxf).not.toContain('LWPOLYLINE');
    expect(dxf).toContain('EOF');
  });
});
