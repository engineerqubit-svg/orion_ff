"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ListChecks, LogOut } from "lucide-react";
import { BrandMark } from "@/components/arena/brand";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/host", label: "Dashboard", icon: LayoutDashboard },
  { href: "/host/quizzes", label: "My Quizzes", icon: ListChecks },
] as const;

export function HostNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <BrandMark size="sm" href="/" />
        <nav className="flex gap-1" aria-label="Host sections">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-brand-500/15 text-brand-400" : "text-ink-300 active:bg-ink-700/50",
                )}
              >
                <link.icon className="size-4" aria-hidden />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-ink-400 sm:inline">{email}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await apiFetch("/api/auth/logout", { method: "POST" });
            router.replace("/host/login");
            router.refresh();
          }}
        >
          <LogOut aria-hidden /> Sign out
        </Button>
      </div>
    </header>
  );
}
