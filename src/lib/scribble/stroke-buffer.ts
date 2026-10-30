import type { DrawingPoint, DrawingStroke } from "@/types/scribble";

/**
 * Canvas state, deliberately outside React.
 *
 * Strokes arrive as deltas roughly eight times a second per drawer; running that
 * through component state would re-render the tree on every flush. Instead the
 * buffer mutates in place and bumps `version`, and the canvas repaints on an
 * animation frame when it sees the number change.
 */
export class StrokeBuffer {
  private strokes = new Map<string, DrawingStroke>();
  private order: string[] = [];

  /** Increments on every mutation; the renderer polls this. */
  version = 0;

  /** Appends new points to a stroke, creating it if this is the first delta. */
  applyDelta(
    id: string,
    color: string,
    width: number,
    points: DrawingPoint[],
    erase = false,
  ): void {
    const existing = this.strokes.get(id);
    if (existing) {
      existing.points.push(...points);
    } else {
      this.strokes.set(id, { id, color, width, erase, points: [...points] });
      this.order.push(id);
    }
    this.version++;
  }

  remove(id: string): void {
    if (this.strokes.delete(id)) {
      this.order = this.order.filter((strokeId) => strokeId !== id);
      this.version++;
    }
  }

  clear(): void {
    this.strokes.clear();
    this.order = [];
    this.version++;
  }

  /** Used on connect and reconnect, when the server sends the full picture. */
  replaceAll(strokes: DrawingStroke[]): void {
    this.strokes.clear();
    this.order = [];
    for (const stroke of strokes) {
      this.strokes.set(stroke.id, { ...stroke, points: [...stroke.points] });
      this.order.push(stroke.id);
    }
    this.version++;
  }

  list(): DrawingStroke[] {
    return this.order
      .map((id) => this.strokes.get(id))
      .filter((stroke): stroke is DrawingStroke => stroke !== undefined);
  }

  get lastStrokeId(): string | null {
    return this.order.at(-1) ?? null;
  }

  get isEmpty(): boolean {
    return this.order.length === 0;
  }
}

export const CANVAS_BACKGROUND = "#fdfdfb";

/**
 * Paints the whole buffer. Points are normalised 0..1, so the same stroke data
 * renders identically on a phone and a 4K projector.
 */
export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: DrawingStroke[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = CANVAS_BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Scale brush width off the smaller edge so lines keep their weight on any aspect.
  const scale = Math.min(width, height) / 600;

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;

    ctx.strokeStyle = stroke.erase ? CANVAS_BACKGROUND : stroke.color;
    ctx.lineWidth = Math.max(1, stroke.width * scale);
    ctx.beginPath();

    const first = stroke.points[0]!;
    ctx.moveTo(first.x * width, first.y * height);

    if (stroke.points.length === 1) {
      // A tap with no drag still leaves a dot.
      ctx.lineTo(first.x * width + 0.01, first.y * height);
    } else {
      // Quadratic smoothing through midpoints removes the polyline look.
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const current = stroke.points[i]!;
        const next = stroke.points[i + 1]!;
        ctx.quadraticCurveTo(
          current.x * width,
          current.y * height,
          ((current.x + next.x) / 2) * width,
          ((current.y + next.y) / 2) * height,
        );
      }
      const last = stroke.points.at(-1)!;
      ctx.lineTo(last.x * width, last.y * height);
    }

    ctx.stroke();
  }
}

export const BRUSH_COLORS = [
  { name: "Black", value: "#12151f" },
  { name: "Red", value: "#e03131" },
  { name: "Blue", value: "#1c7ed6" },
  { name: "Green", value: "#2f9e44" },
  { name: "Yellow", value: "#f0a30a" },
  { name: "Purple", value: "#7b5cff" },
] as const;

export const BRUSH_SIZES = [
  { name: "Small", value: 4 },
  { name: "Medium", value: 9 },
  { name: "Large", value: 18 },
] as const;
