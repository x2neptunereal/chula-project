"use client";

import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { lang, toggleLang } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleLang}
      title={lang === "en" ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English"}
      className="font-semibold text-xs"
    >
      {lang === "en" ? "TH" : "EN"}
    </Button>
  );
}
