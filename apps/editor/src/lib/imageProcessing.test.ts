import { describe, expect, it } from 'vitest';
import {
  computeResizedDimensions,
  isAllowedContentType,
  MAX_EDGE_PX,
  shouldResize,
} from './imageProcessing';

describe('computeResizedDimensions', () => {
  it('passes through dimensions <= max edge unchanged', () => {
    expect(computeResizedDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(computeResizedDimensions(MAX_EDGE_PX, 1)).toEqual({ width: MAX_EDGE_PX, height: 1 });
  });

  it('scales the longest edge to max and preserves aspect ratio', () => {
    const result = computeResizedDimensions(4800, 3600);
    expect(result.width).toBe(MAX_EDGE_PX);
    expect(result.height).toBe(Math.round(3600 * (MAX_EDGE_PX / 4800)));
  });

  it('handles portrait orientation correctly', () => {
    const result = computeResizedDimensions(3000, 6000);
    expect(result.height).toBe(MAX_EDGE_PX);
    expect(result.width).toBe(Math.round(3000 * (MAX_EDGE_PX / 6000)));
  });

  it('respects a custom max edge', () => {
    expect(computeResizedDimensions(2000, 1000, 1000)).toEqual({ width: 1000, height: 500 });
  });
});

describe('shouldResize', () => {
  it('returns true for oversized jpeg/png', () => {
    expect(shouldResize('image/jpeg', 4000, 3000)).toBe(true);
    expect(shouldResize('image/png', 1, 5000)).toBe(true);
  });

  it('returns false for jpeg/png within the limit', () => {
    expect(shouldResize('image/jpeg', 2400, 1600)).toBe(false);
    expect(shouldResize('image/png', 100, 100)).toBe(false);
  });

  it('returns false for pass-through types regardless of size', () => {
    expect(shouldResize('image/webp', 9999, 9999)).toBe(false);
    expect(shouldResize('image/gif', 9999, 9999)).toBe(false);
    expect(shouldResize('application/pdf', 9999, 9999)).toBe(false);
  });
});

describe('isAllowedContentType', () => {
  it('accepts the 5 allowed content types', () => {
    expect(isAllowedContentType('image/jpeg')).toBe(true);
    expect(isAllowedContentType('image/png')).toBe(true);
    expect(isAllowedContentType('image/webp')).toBe(true);
    expect(isAllowedContentType('image/gif')).toBe(true);
    expect(isAllowedContentType('application/pdf')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isAllowedContentType('image/svg+xml')).toBe(false);
    expect(isAllowedContentType('application/octet-stream')).toBe(false);
    expect(isAllowedContentType('text/plain')).toBe(false);
  });
});
