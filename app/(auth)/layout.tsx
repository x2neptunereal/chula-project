"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { Particles } from "@/components/ui/particles";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const [particleColor, setParticleColor] = useState("#71717a");

  useEffect(() => {
    const update = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setParticleColor(isDark ? "#a1a1aa" : "#52525b");
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <Particles
        className="z-0"
        quantity={120}
        staticity={50}
        ease={50}
        color={particleColor}
      />

      <div className="z-10 absolute top-4 right-4 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="relative z-10 w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
