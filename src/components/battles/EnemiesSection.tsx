import { useState } from "react";
import { Wand2 } from "lucide-react";
import { EnemyCard } from "@/components/battles/EnemyCard";
import type { Enemy } from "@/types";

interface Props {
  battleId: string;
  initialPending: Enemy[];
  initialConfirmed: Enemy[];
}

export default function EnemiesSection({ battleId, initialPending, initialConfirmed }: Props) {
  const [pending, setPending] = useState<Enemy[]>(initialPending);
  const [confirmed, setConfirmed] = useState<Enemy[]>(initialConfirmed);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleGenerate(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/battles/${battleId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = (await res.json()) as { error?: string; enemies?: Enemy[] };
      if (!res.ok) {
        setGenerateError(data.error ?? "Generation failed. Please try again.");
      } else {
        setPending((prev) => [...(data.enemies ?? []), ...prev]);
        setPrompt("");
      }
    } catch {
      setGenerateError("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleConfirm(enemy: Enemy) {
    setLoadingId(enemy.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/enemies/${enemy.id}`, { method: "PATCH" });
      if (res.ok) {
        const data = (await res.json()) as { enemy: Enemy };
        setPending((prev) => prev.filter((e) => e.id !== enemy.id));
        setConfirmed((prev) => [...prev, data.enemy]);
      } else {
        setActionError("Could not confirm enemy. Please try again.");
      }
    } catch {
      setActionError("Could not confirm enemy. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDeny(enemy: Enemy) {
    setLoadingId(enemy.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/enemies/${enemy.id}`, { method: "DELETE" });
      if (res.ok) {
        setPending((prev) => prev.filter((e) => e.id !== enemy.id));
      } else {
        setActionError("Could not remove enemy. Please try again.");
      }
    } catch {
      setActionError("Could not remove enemy. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-blue-100/50 uppercase">Generate Enemies</h2>
        <form onSubmit={handleGenerate} className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
            }}
            placeholder="e.g. 2 ice wolves and a frost troll"
            rows={3}
            disabled={isGenerating}
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-blue-100/30 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 focus:outline-none disabled:opacity-50"
          />
          {generateError && (
            <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
              {generateError}
            </p>
          )}
          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="size-4" />
                Generate
              </>
            )}
          </button>
        </form>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-blue-100/50 uppercase">Pending Review</h2>
          {actionError && (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
              {actionError}
            </p>
          )}
          <div className="space-y-4">
            {pending.map((enemy) => (
              <EnemyCard
                key={enemy.id}
                enemy={enemy}
                onConfirm={() => handleConfirm(enemy)}
                onDeny={() => handleDeny(enemy)}
                isLoading={loadingId === enemy.id}
              />
            ))}
          </div>
        </section>
      )}

      {confirmed.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-blue-100/50 uppercase">Confirmed Enemies</h2>
          <div className="space-y-4">
            {confirmed.map((enemy) => (
              <EnemyCard key={enemy.id} enemy={enemy} />
            ))}
          </div>
        </section>
      )}

      {pending.length === 0 && confirmed.length === 0 && (
        <p className="text-center text-sm text-blue-100/30">
          No enemies yet — type a scenario above and click Generate.
        </p>
      )}
    </div>
  );
}
