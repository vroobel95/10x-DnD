import { useState } from "react";
import { Wand2, MapPin, Eye, Flame, Wind, BookOpen, type LucideIcon } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { BattleEnvironment } from "@/lib/schemas/environment";

interface Props {
  battleId: string;
  location: string | null;
  initialEnvironment: BattleEnvironment | null;
}

const FIELD_LABELS: { key: keyof BattleEnvironment; label: () => string; Icon: LucideIcon }[] = [
  { key: "terrain", label: () => m.env_terrain(), Icon: MapPin },
  { key: "lighting", label: () => m.env_lighting(), Icon: Eye },
  { key: "hazards", label: () => m.env_hazards(), Icon: Flame },
  { key: "ambiance", label: () => m.env_ambiance(), Icon: Wind },
  { key: "trivia", label: () => m.env_trivia(), Icon: BookOpen },
];

export default function EnvironmentSection({ battleId, location, initialEnvironment }: Props) {
  const [environment, setEnvironment] = useState<BattleEnvironment | null>(initialEnvironment);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/battles/${battleId}/environment`, { method: "POST" });
      const data = (await res.json()) as { error?: string; environment?: BattleEnvironment };
      if (!res.ok) {
        setError(data.error ?? m.err_generation_failed());
        if (data.environment) setEnvironment(data.environment);
      } else {
        if (!data.environment) {
          setError(m.err_generation_failed());
          return;
        }
        setEnvironment(data.environment);
      }
    } catch {
      setError(m.err_generation_failed());
    } finally {
      setIsGenerating(false);
    }
  }

  const canGenerate = location !== null;

  return (
    <section className="mb-10">
      <h2 className="section-label">{m.env_section_title()}</h2>

      {environment && (
        <div className="mt-3 mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELD_LABELS.map(({ key, label, Icon }) => (
            <div key={key} className="ink-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <Icon className="text-blood-bright h-4 w-4" />
                <span className="section-label">{label()}</span>
              </div>
              <p className="text-ivory text-sm leading-relaxed">{environment[key]}</p>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          void handleGenerate();
        }}
        disabled={isGenerating || !canGenerate}
        title={!canGenerate ? m.env_need_location() : undefined}
        className="blood-button mt-3 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isGenerating ? (
          <>
            <span className="border-ivory/30 border-t-ivory size-4 animate-spin rounded-full border-2" />
            {m.env_generating()}
          </>
        ) : (
          <>
            <Wand2 className="size-4" />
            {environment ? m.env_regenerate() : m.env_generate()}
          </>
        )}
      </button>

      {error && (
        <p className="border-destructive/40 bg-destructive/10 text-destructive mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
