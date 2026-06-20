import { getLocale, setLocale, locales } from "@/paraglide/runtime.js";
import { m } from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = { en: "EN", pl: "PL" };

export function LocaleSwitcher() {
  const current = getLocale();

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={m.locale_switcher_label()}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => {
            if (locale !== current) void setLocale(locale);
          }}
          aria-pressed={locale === current}
          className={cn(
            "rounded px-2 py-0.5 text-xs font-medium uppercase transition-colors",
            locale === current ? "bg-white/15 text-white" : "text-white/50 hover:text-white",
          )}
        >
          {LABELS[locale] ?? locale}
        </button>
      ))}
    </div>
  );
}
