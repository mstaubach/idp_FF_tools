export interface Point {
  x: number;
  y: number;
}

// A left-to-right cubic bezier with horizontal control handles, so arrows leave
// the source row horizontally and arrive at the target row horizontally.
export function computeArrowPath(from: Point, to: Point): string {
  const handle = Math.max(40, Math.abs(to.x - from.x) / 2);
  const c1x = from.x + handle;
  const c2x = to.x - handle;
  return `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`;
}
