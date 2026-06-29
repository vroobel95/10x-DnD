import { useState } from "react";
import { Download, Wand2 } from "lucide-react";
import { EnemyCard } from "@/components/battles/EnemyCard";
import { m } from "@/paraglide/messages.js";
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
        setGenerateError(data.error ?? m.err_generation_failed());
      } else {
        setPending((prev) => [...(data.enemies ?? []), ...prev]);
        setPrompt("");
        if (data.main_enemy_id && mainEnemyId === null) {
          setMainEnemyId(data.main_enemy_id);
          setMainEnemyProfile(data.main_enemy_profile ?? null);
        }
      }
    } catch {
      setGenerateError(m.err_generation_failed());
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
        setActionError(m.err_confirm_enemy());
      }
    } catch {
      setActionError(m.err_confirm_enemy());
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
        setActionError(m.err_remove_enemy());
      }
    } catch {
      setActionError(m.err_remove_enemy());
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
        setActionError(data.error ?? m.err_save_changes());
      } else {
        const updatedEnemy = data.enemy;
        if (updatedEnemy) {
          setConfirmed((prev) => prev.map((e) => (e.id === enemy.id ? updatedEnemy : e)));
          setEditingId(null);
        }
      }
    } catch {
      setActionError(m.err_save_changes());
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
        setActionError(data.error ?? m.err_remove_enemy());
      }
    } catch {
      setActionError(m.err_remove_enemy());
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
        setExportError(data.error ?? m.err_export_failed());
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
      setExportError(m.err_export_failed());
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="section-label mb-3">{m.enemies_generate_title()}</h2>
        <form onSubmit={handleGenerate} className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
            }}
            placeholder={m.enemies_prompt_placeholder()}
            rows={3}
            disabled={isGenerating}
            className="bg-ink-deep/60 border-border text-ivory placeholder-ivory-dim/50 focus:border-blood w-full resize-none rounded-md border px-4 py-3 text-sm focus:outline-none disabled:opacity-50"
          />
          {generateError && (
            <p className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              {generateError}
            </p>
          )}
          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className="blood-button inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            {isGenerating ? (
              <>
                <span className="border-ivory/30 border-t-ivory size-4 animate-spin rounded-full border-2" />
                {m.enemies_generate_pending()}
              </>
            ) : (
              <>
                <Wand2 className="size-4" />
                {m.enemies_generate_btn()}
              </>
            )}
          </button>
        </form>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="section-label mb-3">{m.enemies_pending_title()}</h2>
          {actionError && (
            <p className="border-destructive/40 bg-destructive/10 text-destructive mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
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
            <h2 className="section-label">{m.enemies_confirmed_title()}</h2>
            <button
              type="button"
              onClick={() => {
                void handleExport();
              }}
              disabled={isExporting}
              className="blood-button inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              {isExporting ? (
                <>
                  <span className="border-ivory/30 border-t-ivory size-4 animate-spin rounded-full border-2" />
                  {m.enemies_export_pending()}
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  {m.enemies_export_pdf()}
                </>
              )}
            </button>
          </div>
          {exportError && (
            <p className="border-destructive/40 bg-destructive/10 text-destructive mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              {exportError}
            </p>
          )}
          {actionError && (
            <p className="border-destructive/40 bg-destructive/10 text-destructive mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
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
        <p className="text-ivory-dim text-center font-serif text-sm italic">{m.enemies_empty()}</p>
      )}
    </div>
  );
}
