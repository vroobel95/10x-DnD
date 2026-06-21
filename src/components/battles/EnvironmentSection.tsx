import { useState } from "react";
import { Wand2 } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { BattleEnvironment } from "@/lib/schemas/environment";

interface Props {
  battleId: string;
  location: string | null;
  initialEnvironment: BattleEnvironment | null;
}

const FIELD_LABELS: { key: keyof BattleEnvironment; label: () => string }[] = [
  { key: "terrain", label: () => m.env_terrain() },
  { key: "lighting", label: () => m.env_lighting() },
  { key: "hazards", label: () => m.env_hazards() },
  { key: "ambiance", label: () => m.env_ambiance() },
  { key: "trivia", label: () => m.env_trivia() },
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
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-blue-100/50 uppercase">{m.env_section_title()}</h2>

      {environment && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELD_LABELS.map(({ key, label }) => (
            <div key={key} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="mb-1 text-xs font-semibold tracking-wide text-blue-100/50 uppercase">{label()}</p>
              <p className="text-sm text-blue-100/80">{environment[key]}</p>
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
        className="flex items-center gap-2 rounded-lg bg-[#701c3b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#9f1239] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
        <p className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
