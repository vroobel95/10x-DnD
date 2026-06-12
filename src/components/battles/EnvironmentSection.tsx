import { useState } from "react";
import { Wand2 } from "lucide-react";
import type { BattleEnvironment } from "@/lib/schemas/environment";

interface Props {
  battleId: string;
  location: string | null;
  initialEnvironment: BattleEnvironment | null;
}

const FIELD_LABELS: { key: keyof BattleEnvironment; label: string }[] = [
  { key: "terrain", label: "Terrain" },
  { key: "lighting", label: "Lighting" },
  { key: "hazards", label: "Hazards" },
  { key: "ambiance", label: "Ambiance" },
  { key: "trivia", label: "Trivia" },
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
        setError(data.error ?? "Generation failed. Please try again.");
        if (data.environment) setEnvironment(data.environment);
      } else {
        if (!data.environment) {
          setError("Generation failed. Please try again.");
          return;
        }
        setEnvironment(data.environment);
      }
    } catch {
      setError("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  const canGenerate = location !== null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-blue-100/50 uppercase">Battle Environment</h2>

      {environment && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELD_LABELS.map(({ key, label }) => (
            <div key={key} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="mb-1 text-xs font-semibold tracking-wide text-blue-100/50 uppercase">{label}</p>
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
        title={!canGenerate ? "Set a location on this battle to generate an environment" : undefined}
        className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Generating…
          </>
        ) : (
          <>
            <Wand2 className="size-4" />
            {environment ? "Regenerate Environment" : "Generate Environment"}
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
