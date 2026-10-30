"use client";

import { Eraser, Paintbrush, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRUSH_COLORS, BRUSH_SIZES } from "@/lib/scribble/stroke-buffer";
import { cn } from "@/lib/utils";

interface Props {
  color: string;
  size: number;
  erase: boolean;
  onColor: (color: string) => void;
  onSize: (size: number) => void;
  onErase: (erase: boolean) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
}

/** Six colours, three sizes, undo and clear. Deliberately nothing else. */
export function DrawingToolbar({
  color,
  size,
  erase,
  onColor,
  onSize,
  onErase,
  onUndo,
  onClear,
  canUndo,
}: Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ink-400">Colour</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {BRUSH_COLORS.map((swatch) => {
            const active = !erase && color === swatch.value;
            return (
              <button
                key={swatch.value}
                type="button"
                onClick={() => {
                  onColor(swatch.value);
                  onErase(false);
                }}
                aria-label={swatch.name}
                aria-pressed={active}
                className={cn(
                  "size-9 rounded-full border-2 transition-transform",
                  active
                    ? "scale-110 border-white shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-aqua-500)_35%,transparent)]"
                    : "border-ink-500/60 active:scale-105",
                )}
                style={{ background: swatch.value }}
              />
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ink-400">Size</p>
        <div className="mt-2 flex gap-2">
          {BRUSH_SIZES.map((brush) => {
            const active = size === brush.value;
            return (
              <button
                key={brush.value}
                type="button"
                onClick={() => onSize(brush.value)}
                aria-label={`${brush.name} brush`}
                aria-pressed={active}
                className={cn(
                  "flex h-11 flex-1 items-center justify-center rounded-xl border transition-colors",
                  active
                    ? "border-brand-500/70 bg-brand-500/15"
                    : "border-ink-600/60 active:border-ink-500",
                )}
              >
                <span
                  className="rounded-full bg-ink-100"
                  style={{ width: brush.value + 2, height: brush.value + 2 }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={erase ? "outline" : "secondary"}
          size="sm"
          className="flex-1"
          onClick={() => onErase(!erase)}
          aria-pressed={erase}
        >
          {erase ? <Paintbrush aria-hidden /> : <Eraser aria-hidden />}
          {erase ? "Brush" : "Eraser"}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onUndo} disabled={!canUndo}>
          <RotateCcw aria-hidden /> Undo
        </Button>
        <Button variant="danger" size="sm" className="flex-1" onClick={onClear}>
          <Trash2 aria-hidden /> Clear
        </Button>
      </div>
    </div>
  );
}
