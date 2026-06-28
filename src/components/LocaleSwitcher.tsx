import { getLocale, setLocale, locales } from "@/paraglide/runtime.js";
import { m } from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = { en: "EN", pl: "PL" };

export function LocaleSwitcher() {
  const current = getLocale();

  return (
    <div
      className="border-border/70 flex overflow-hidden rounded-md border text-xs"
      role="group"
      aria-label={m.locale_switcher_label()}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => {
            if (locale !== current) void setLocale(locale);
          }}
          aria-pressed={locale === current}
          className={cn(
            "px-2 py-1 font-medium uppercase transition-colors",
            locale === current ? "bg-blood/30 text-ivory font-bold" : "text-ivory-dim hover:text-ivory",
          )}
        >
          {LABELS[locale] ?? locale}
        </button>
      ))}
    </div>
  );
}
