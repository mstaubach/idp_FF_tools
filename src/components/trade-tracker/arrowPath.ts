export interface Point {
  x: number;
  y: number;
}

// Clear lanes for an arrow to route through so it never crosses a card:
// exitX = the column-gap just right of the source, enterX = the column-gap just
// left of the target, gutterY = a row-gap lane between rows. All are card-free.
export interface GutterRoute {
  exitX: number;
  enterX: number;
  gutterY: number;
}

// Without a route: a left-to-right cubic bezier with horizontal control handles
// (used for clean adjacent same-row arrows). With a route: an orthogonal path
// that travels only through the grid's empty gutters, so it can span columns or
// rows without passing through any card.
export function computeArrowPath(
  from: Point,
  to: Point,
  route?: GutterRoute,
): string {
  if (!route) {
    const handle = Math.max(40, Math.abs(to.x - from.x) / 2);
    return `M ${from.x} ${from.y} C ${from.x + handle} ${from.y}, ${to.x - handle} ${to.y}, ${to.x} ${to.y}`;
  }
  return orthogonalPath([
    from,
    { x: route.exitX, y: from.y },
    { x: route.exitX, y: route.gutterY },
    { x: route.enterX, y: route.gutterY },
    { x: route.enterX, y: to.y },
    to,
  ]);
}

// Builds an axis-aligned path through the waypoints with rounded corners.
function orthogonalPath(points: Point[], radius = 12): string {
  const pts = points.filter(
    (p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y,
  );
  if (pts.length < 2) return "";

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    const r = Math.min(radius, distance(prev, curr) / 2, distance(curr, next) / 2);
    const a = pointToward(curr, prev, r);
    const b = pointToward(curr, next, r);
    d += ` L ${round(a.x)} ${round(a.y)} Q ${curr.x} ${curr.y} ${round(b.x)} ${round(b.y)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointToward(origin: Point, target: Point, dist: number): Point {
  const len = distance(origin, target) || 1;
  return {
    x: origin.x + ((target.x - origin.x) / len) * dist,
    y: origin.y + ((target.y - origin.y) / len) * dist,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
