import { cn } from "@/lib/utils";
import { TicketGlyph } from "@/components/arena/icons";

/**
 * The one recurring card shape that isn't just a rounded rectangle with a
 * blur behind it — die-cut corners and a perforated stub, like an actual
 * admission ticket. Reserved for the handful of moments a person is
 * "holding" something: entering a PIN, signing in, joining.
 */
export function TicketPanel({
  eyebrow,
  className,
  bodyClassName,
  children,
}: {
  eyebrow?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("ticket glass-strong w-full", className)}>
      {eyebrow ? (
        <div className="ticket-stub flex items-center justify-between px-6 py-2.5 sm:px-8">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-ink-500">
            {eyebrow}
          </span>
          <TicketGlyph className="size-4 text-ink-500" aria-hidden />
        </div>
      ) : null}
      <div className={cn("p-6 sm:p-8", bodyClassName)}>{children}</div>
    </div>
  );
}
