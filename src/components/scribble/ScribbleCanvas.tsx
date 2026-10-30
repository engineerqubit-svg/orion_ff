"use client";

import { useCallback, useEffect, useRef } from "react";
import { renderStrokes, type StrokeBuffer } from "@/lib/scribble/stroke-buffer";
import type { DrawingPoint } from "@/types/scribble";
import { cn } from "@/lib/utils";

/** How often a drag is flushed upstream. ~8 posts/sec keeps lines smooth and cheap. */
const FLUSH_MS = 120;

export interface ScribbleCanvasProps {
  buffer: StrokeBuffer;
  /** True for the drawer only; everyone else gets a read-only view. */
  interactive?: boolean;
  color?: string;
  width?: number;
  erase?: boolean;
  /** Fired with only the points added since the previous flush. */
  onStrokeDelta?: (strokeId: string, points: DrawingPoint[]) => void;
  onStrokeStart?: (strokeId: string) => void;
  className?: string;
}

export function ScribbleCanvas({
  buffer,
  interactive = false,
  color = "#12151f",
  width = 9,
  erase = false,
  onStrokeDelta,
  onStrokeStart,
  className,
}: ScribbleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const drawing = useRef(false);
  const strokeId = useRef<string | null>(null);
  const pending = useRef<DrawingPoint[]>([]);
  const lastFlush = useRef(0);
  const renderedVersion = useRef(-1);

  // Latest tool settings, read inside pointer handlers without re-binding them.
  const tool = useRef({ color, width, erase });
  useEffect(() => {
    tool.current = { color, width, erase };
  });

  /** Repaints on an animation frame whenever the buffer's version has moved. */
  useEffect(() => {
    let frame = 0;

    const paint = () => {
      frame = requestAnimationFrame(paint);

      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(wrapper.clientWidth * ratio);
      const targetHeight = Math.round(wrapper.clientHeight * ratio);
      if (targetWidth === 0 || targetHeight === 0) return;

      const resized = canvas.width !== targetWidth || canvas.height !== targetHeight;
      if (resized) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      if (!resized && renderedVersion.current === buffer.version) return;
      renderedVersion.current = buffer.version;

      const ctx = canvas.getContext("2d");
      if (ctx) renderStrokes(ctx, buffer.list(), canvas.width, canvas.height);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [buffer]);

  const toPoint = useCallback((event: React.PointerEvent): DrawingPoint | null => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    // Normalised and rounded — keeps the payload small and screen-independent.
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * 10000) / 10000,
      y: Math.round(((event.clientY - rect.top) / rect.height) * 10000) / 10000,
    };
  }, []);

  const flush = useCallback(
    (force = false) => {
      const id = strokeId.current;
      if (!id || pending.current.length === 0) return;
      if (!force && Date.now() - lastFlush.current < FLUSH_MS) return;

      const points = pending.current;
      pending.current = [];
      lastFlush.current = Date.now();
      onStrokeDelta?.(id, points);
    },
    [onStrokeDelta],
  );

  const handleDown = useCallback(
    (event: React.PointerEvent) => {
      if (!interactive) return;
      const point = toPoint(event);
      if (!point) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      drawing.current = true;
      strokeId.current = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      pending.current = [point];
      lastFlush.current = 0;

      onStrokeStart?.(strokeId.current);
      // Paint locally first so the drawer never waits on a round trip.
      buffer.applyDelta(
        strokeId.current,
        tool.current.color,
        tool.current.width,
        [point],
        tool.current.erase,
      );
      flush(true);
    },
    [interactive, toPoint, buffer, flush, onStrokeStart],
  );

  const handleMove = useCallback(
    (event: React.PointerEvent) => {
      if (!interactive || !drawing.current || !strokeId.current) return;
      const point = toPoint(event);
      if (!point) return;

      pending.current.push(point);
      buffer.applyDelta(
        strokeId.current,
        tool.current.color,
        tool.current.width,
        [point],
        tool.current.erase,
      );
      flush();
    },
    [interactive, toPoint, buffer, flush],
  );

  const handleUp = useCallback(() => {
    if (!drawing.current) return;
    flush(true);
    drawing.current = false;
    strokeId.current = null;
  }, [flush]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink-500/40 shadow-[0_20px_50px_-30px_var(--color-ink-100)]",
        interactive ? "cursor-crosshair touch-none" : "",
        className,
      )}
      style={{ background: "#fdfdfb" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onPointerLeave={handleUp}
        role="img"
        aria-label={interactive ? "Drawing canvas" : "Live drawing from the current drawer"}
      />
    </div>
  );
}
