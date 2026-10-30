"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { ArenaBackground } from "@/components/arena/background";
import { BrandMark } from "@/components/arena/brand";
import { FestiveLights } from "@/components/arena/festive-lights";
import { TicketPanel } from "@/components/arena/ticket-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/login", { method: "POST", json: { email, password } });
      router.replace("/host");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Sign in failed.");
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5">
      <ArenaBackground dense />
      <FestiveLights />
      <div className="relative z-10 w-full max-w-sm">
        <TicketPanel eyebrow="Staff access">
          <BrandMark size="sm" href="/" />
          <h1 className="mt-6 font-display text-2xl font-bold">Host sign in</h1>
          <p className="mt-1 text-sm text-ink-400">
            Run the game from here. Players never need an account.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="host@qubit.local"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              <KeyRound aria-hidden /> Sign in
            </Button>
          </form>

          <p className="mt-5 panel rounded-lg p-3 text-xs leading-relaxed text-ink-400">
            Development credentials default to{" "}
            <span className="font-mono text-ink-200">host@qubit.local</span> /{" "}
            <span className="font-mono text-ink-200">fun-friday</span>. Override with
            ADMIN_EMAIL and ADMIN_PASSWORD.
          </p>
        </TicketPanel>
      </div>
    </main>
  );
}
