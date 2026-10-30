"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Built for spamming: Enter submits, the field clears itself and focus never
 * leaves, so a player can fire off six guesses without touching the mouse.
 */
export function GuessInput({
  onGuess,
  disabled,
}: {
  onGuess: (guess: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const guess = value.trim();
    if (!guess || disabled) return;
    onGuess(guess);
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex gap-2"
    >
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Type your guess…"
        aria-label="Your guess"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        autoFocus
        maxLength={60}
        className="h-12 text-base"
      />
      <Button type="submit" size="lg" disabled={disabled || value.trim().length === 0}>
        <Send aria-hidden />
        <span className="sr-only sm:not-sr-only">Submit</span>
      </Button>
    </form>
  );
}
