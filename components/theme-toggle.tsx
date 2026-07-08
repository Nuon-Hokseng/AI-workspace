"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid rendering theme-dependent UI until mounted -- resolvedTheme is
  // undefined on the server/first client render, before next-themes reads
  // the persisted preference.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // "have we hydrated on the client yet" has no render-time derivation --
    // it's a one-time signal from outside React, the textbook case for an
    // effect-driven setState rather than a lint-rule violation to work around.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
