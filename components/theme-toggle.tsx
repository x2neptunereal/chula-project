"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    // Default is dark unless user explicitly chose light
    const dark = stored !== "light";
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  // Avoid hydration mismatch — render a placeholder until mounted
  if (!mounted) return <div className="size-8" />;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <IconSun className="size-4 text-amber-500" />
      ) : (
        <IconMoon className="size-4" />
      )}
    </Button>
  );
}
