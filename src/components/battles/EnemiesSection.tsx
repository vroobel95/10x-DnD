import { useState } from "react";
import { Download, Wand2 } from "lucide-react";
import { EnemyCard } from "@/components/battles/EnemyCard";
import type { Enemy } from "@/types";
import type { EnemyStats, MainEnemyProfile } from "@/lib/schemas/enemy";

interface Props {
  battleId: string;
  initialPending: Enemy[];
  initialConfirmed: Enemy[];
  initialMainEnemyId: string | null;
  initialMainEnemyProfile: MainEnemyProfile | null;
}

export default function EnemiesSection({
  battleId,
  initialPending,
  initialConfirmed,
  initialMainEnemyId,
  initialMainEnemyProfile,
}: Props) {
  const [pending, setPending] = useState<Enemy[]>(initialPending);
  const [confirmed, setConfirmed] = useState<Enemy[]>(initialConfirmed);
  const [mainEnemyId, setMainEnemyId] = useState<string | null>(initialMainEnemyId);
  const [mainEnemyProfile, setMainEnemyProfile] = useState<MainEnemyProfile | null>(initialMainEnemyProfile);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
      const data = (await res.json()) as {
        error?: string;
        enemies?: Enemy[];
        main_enemy_id?: string | null;
        main_enemy_profile?: MainEnemyProfile | null;
      };
      if (!res.ok) {
        setGenerateError(data.error ?? "Generation failed. Please try again.");
      } else {
        setPending((prev) => [...(data.enemies ?? []), ...prev]);
        setPrompt("");
        if (data.main_enemy_id) {
          setMainEnemyId(data.main_enemy_id);
          setMainEnemyProfile(data.main_enemy_profile ?? null);
        }
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
    setExportError(null);
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
    setExportError(null);
    try {
      const res = await fetch(`/api/enemies/${enemy.id}`, { method: "DELETE" });
      if (res.ok) {
        const data = (await res.json()) as { main_enemy_cleared?: boolean };
        setPending((prev) => prev.filter((e) => e.id !== enemy.id));
        if (data.main_enemy_cleared) {
          setMainEnemyId(null);
          setMainEnemyProfile(null);
        }
      } else {
        setActionError("Could not remove enemy. Please try again.");
      }
    } catch {
      setActionError("Could not remove enemy. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleEditSave(enemy: Enemy, stats: EnemyStats): Promise<void> {
    setLoadingId(enemy.id);
    setActionError(null);
    setExportError(null);
    try {
      const res = await fetch(`/api/enemies/${enemy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats }),
      });
      const data = (await res.json()) as { error?: string; enemy?: Enemy };
      if (!res.ok) {
        setActionError(data.error ?? "Could not save changes. Please try again.");
      } else {
        const updatedEnemy = data.enemy;
        if (updatedEnemy) {
          setConfirmed((prev) => prev.map((e) => (e.id === enemy.id ? updatedEnemy : e)));
          setEditingId(null);
        }
      }
    } catch {
      setActionError("Could not save changes. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  function handleEditStart(enemy: Enemy) {
    setEditingId(enemy.id);
  }

  function handleEditCancel() {
    setEditingId(null);
  }

  function handleRemoveStart(enemy: Enemy) {
    setRemovingId(enemy.id);
  }

  async function handleRemoveConfirm(enemy: Enemy): Promise<void> {
    setLoadingId(enemy.id);
    setActionError(null);
    setExportError(null);
    try {
      const res = await fetch(`/api/enemies/${enemy.id}`, { method: "DELETE" });
      if (res.ok) {
        const data = (await res.json()) as { main_enemy_cleared?: boolean };
        setConfirmed((prev) => prev.filter((e) => e.id !== enemy.id));
        setRemovingId(null);
        if (data.main_enemy_cleared) {
          setMainEnemyId(null);
          setMainEnemyProfile(null);
        }
      } else {
        const data = (await res.json()) as { error?: string };
        setActionError(data.error ?? "Could not remove enemy. Please try again.");
      }
    } catch {
      setActionError("Could not remove enemy. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  function handleRemoveCancel() {
    setRemovingId(null);
  }

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/battles/${battleId}/export.pdf`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setExportError(data.error ?? "Export failed. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const rfc5987 = /filename\*=UTF-8''([^\s;]+)/i.exec(disposition);
      const legacy = /filename="([^"]+)"/i.exec(disposition);
      const filename = rfc5987 ? decodeURIComponent(rfc5987[1]) : (legacy?.[1] ?? "battle.pdf");
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
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
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-blue-100/30 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 focus:outline-none disabled:opacity-50"
          />
          {generateError && (
            <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
              {generateError}
            </p>
          )}
          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#701c3b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#9f1239] disabled:opacity-50"
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
                isMain={mainEnemyId === enemy.id}
                mainEnemyProfile={mainEnemyId === enemy.id ? mainEnemyProfile : null}
              />
            ))}
          </div>
        </section>
      )}

      {confirmed.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-blue-100/50 uppercase">Confirmed Enemies</h2>
            <button
              type="button"
              onClick={() => {
                void handleExport();
              }}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-lg bg-[#701c3b] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#9f1239] disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Export PDF
                </>
              )}
            </button>
          </div>
          {exportError && (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
              {exportError}
            </p>
          )}
          {actionError && (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
              {actionError}
            </p>
          )}
          <div className="space-y-4">
            {[...confirmed]
              .sort((a, b) => (a.id === mainEnemyId ? -1 : b.id === mainEnemyId ? 1 : 0))
              .map((enemy) => (
                <EnemyCard
                  key={enemy.id}
                  enemy={enemy}
                  onEditStart={() => {
                    handleEditStart(enemy);
                  }}
                  onEditSave={(stats) => {
                    void handleEditSave(enemy, stats);
                  }}
                  onEditCancel={handleEditCancel}
                  onRemoveStart={() => {
                    handleRemoveStart(enemy);
                  }}
                  onRemoveConfirm={() => {
                    void handleRemoveConfirm(enemy);
                  }}
                  onRemoveCancel={handleRemoveCancel}
                  isEditing={editingId === enemy.id}
                  isRemoving={removingId === enemy.id}
                  isLoading={loadingId === enemy.id}
                  isMain={mainEnemyId === enemy.id}
                  mainEnemyProfile={mainEnemyId === enemy.id ? mainEnemyProfile : null}
                />
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
