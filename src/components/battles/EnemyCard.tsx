import { useState } from "react";
import { EnemySchema, normalizeDialogueLine, type EnemyStats, type MainEnemyProfile } from "@/lib/schemas/enemy";
import { m } from "@/paraglide/messages.js";
import type { Enemy } from "@/types";

interface Props {
  enemy: Enemy;
  onConfirm?: () => void;
  onDeny?: () => void;
  onEditStart?: () => void;
  onEditSave?: (stats: EnemyStats) => void;
  onEditCancel?: () => void;
  onRemoveStart?: () => void;
  onRemoveConfirm?: () => void;
  onRemoveCancel?: () => void;
  isLoading?: boolean;
  isEditing?: boolean;
  isRemoving?: boolean;
  isMain?: boolean;
  mainEnemyProfile?: MainEnemyProfile | null;
}

interface EditFormProps {
  initialStats: EnemyStats;
  onSave: (stats: EnemyStats) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const inputCls =
  "rounded border border-border bg-ink-deep/60 px-2 py-1 text-sm text-ivory focus:border-blood focus:outline-none";

function modifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-cell">
      <div className="section-label text-[0.6rem]!">{label}</div>
      <div className="text-ivory font-display text-2xl leading-none">{value}</div>
      <div className="text-ivory-dim text-xs">{modifier(value)}</div>
    </div>
  );
}

function numVal(n: number): number | "" {
  return isNaN(n) ? "" : n;
}

function EnemyEditForm({ initialStats, onSave, onCancel, isLoading }: EditFormProps) {
  const [draft, setDraft] = useState<EnemyStats>(initialStats);

  return (
    <div className="ink-card p-5">
      <div className="mb-3 flex items-start gap-2">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => {
            setDraft((prev) => ({ ...prev, name: e.target.value }));
          }}
          className="bg-ink-deep/60 border-border text-ivory focus:border-blood font-display flex-1 rounded border px-3 py-1.5 text-lg focus:outline-none"
        />
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-ivory-dim text-xs">CR</span>
          <input
            type="text"
            value={draft.cr}
            onChange={(e) => {
              setDraft((prev) => ({ ...prev, cr: e.target.value }));
            }}
            className={`w-14 text-center ${inputCls}`}
          />
        </div>
      </div>

      <div className="text-ivory-dim mb-4 flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-1">
          HP
          <input
            type="number"
            min={1}
            value={numVal(draft.hp)}
            onChange={(e) => {
              setDraft((prev) => ({ ...prev, hp: e.target.valueAsNumber }));
            }}
            className={`w-16 ${inputCls}`}
          />
        </label>
        <label className="flex items-center gap-1">
          AC
          <input
            type="number"
            min={1}
            max={30}
            value={numVal(draft.ac)}
            onChange={(e) => {
              setDraft((prev) => ({ ...prev, ac: e.target.valueAsNumber }));
            }}
            className={`w-16 ${inputCls}`}
          />
        </label>
        <label className="flex items-center gap-1">
          Speed
          <input
            type="text"
            value={draft.speed}
            onChange={(e) => {
              setDraft((prev) => ({ ...prev, speed: e.target.value }));
            }}
            className={`w-24 ${inputCls}`}
          />
        </label>
      </div>

      <div className="mb-4 grid grid-cols-6 gap-1">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((attr) => (
          <div key={attr} className="stat-cell flex flex-col items-center gap-1">
            <span className="section-label text-[0.6rem]!">{attr}</span>
            <input
              type="number"
              min={1}
              max={30}
              value={numVal(draft[attr])}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, [attr]: e.target.valueAsNumber }));
              }}
              className="bg-ink-deep/60 border-border text-ivory focus:border-blood w-full rounded border px-1 py-0.5 text-center text-sm focus:outline-none"
            />
          </div>
        ))}
      </div>

      {draft.saving_throws && Object.keys(draft.saving_throws).length > 0 && (
        <div className="mb-3">
          <span className="text-ivory text-xs font-semibold">Saves: </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {Object.entries(draft.saving_throws).map(([k, v]) => (
              <label key={k} className="text-ivory-dim flex items-center gap-1 text-xs">
                {k}
                <input
                  type="number"
                  value={numVal(v)}
                  onChange={(e) => {
                    setDraft((prev) => ({
                      ...prev,
                      saving_throws: { ...prev.saving_throws, [k]: e.target.valueAsNumber },
                    }));
                  }}
                  className="bg-ink-deep/60 border-border text-ivory focus:border-blood w-12 rounded border px-1 py-0.5 text-center text-xs focus:outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {draft.skill_modifiers && Object.keys(draft.skill_modifiers).length > 0 && (
        <div className="mb-3">
          <span className="text-ivory text-xs font-semibold">Skills: </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {Object.entries(draft.skill_modifiers).map(([k, v]) => (
              <label key={k} className="text-ivory-dim flex items-center gap-1 text-xs">
                {k}
                <input
                  type="number"
                  value={numVal(v)}
                  onChange={(e) => {
                    setDraft((prev) => ({
                      ...prev,
                      skill_modifiers: { ...prev.skill_modifiers, [k]: e.target.valueAsNumber },
                    }));
                  }}
                  className="bg-ink-deep/60 border-border text-ivory focus:border-blood w-12 rounded border px-1 py-0.5 text-center text-xs focus:outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {draft.abilities.length > 0 && (
        <ul className="border-border mb-4 space-y-2 border-t pt-3">
          {draft.abilities.map((ab, i) => (
            <li key={i} className="space-y-1">
              <input
                type="text"
                value={ab.name}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    abilities: prev.abilities.map((a, idx) => (idx === i ? { ...a, name: e.target.value } : a)),
                  }));
                }}
                className={`w-full font-semibold ${inputCls}`}
              />
              <input
                type="text"
                value={ab.description}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    abilities: prev.abilities.map((a, idx) => (idx === i ? { ...a, description: e.target.value } : a)),
                  }));
                }}
                className={`text-ivory-dim w-full ${inputCls}`}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="border-border flex gap-2 border-t pt-3">
        <button
          type="button"
          onClick={() => {
            onSave(draft);
          }}
          disabled={isLoading}
          className="blood-button flex-1 rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {isLoading ? m.common_loading_short() : m.common_save()}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="border-border bg-ink-soft/60 text-ivory hover:border-blood/60 flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {m.common_cancel()}
        </button>
      </div>
    </div>
  );
}

export function EnemyCard({
  enemy,
  onConfirm,
  onDeny,
  onEditStart,
  onEditSave,
  onEditCancel,
  onRemoveStart,
  onRemoveConfirm,
  onRemoveCancel,
  isLoading = false,
  isEditing = false,
  isRemoving = false,
  isMain = false,
  mainEnemyProfile = null,
}: Props) {
  const parseResult = EnemySchema.safeParse(enemy.stats);

  if (!parseResult.success) {
    return (
      <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
        {m.enemy_parse_error({ name: enemy.name })}
      </div>
    );
  }

  const stats = parseResult.data;
  const isPending = !!onConfirm || !!onDeny;
  const isConfirmed = !!onEditSave;

  if (isEditing && onEditSave && onEditCancel) {
    return <EnemyEditForm initialStats={stats} onSave={onEditSave} onCancel={onEditCancel} isLoading={isLoading} />;
  }

  return (
    <div className={isConfirmed ? "monster-card px-6 pt-8 pb-6" : "ink-card p-6"}>
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-ivory font-display text-3xl leading-tight">{stats.name}</h3>
        <span className="border-blood/50 bg-blood/15 text-ivory font-display shrink-0 rounded border px-2.5 py-1 text-sm">
          CR {stats.cr}
        </span>
      </div>

      <div className="text-ivory-dim mt-1 text-sm">
        <span className="font-semibold">HP</span> <b className="text-ivory">{stats.hp}</b>
        {"   "}
        <span className="font-semibold">AC</span> <b className="text-ivory">{stats.ac}</b>
        {"   "}
        <span className="font-semibold">Speed</span> <b className="text-ivory">{stats.speed}</b>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((attr) => (
          <StatBox key={attr} label={attr.toUpperCase()} value={stats[attr]} />
        ))}
      </div>

      {stats.saving_throws && Object.keys(stats.saving_throws).length > 0 && (
        <div className="text-ivory-dim mt-3 text-xs">
          <span className="text-ivory font-semibold">Saves: </span>
          {Object.entries(stats.saving_throws)
            .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`)
            .join(", ")}
        </div>
      )}

      {stats.skill_modifiers && Object.keys(stats.skill_modifiers).length > 0 && (
        <div className="text-ivory-dim mt-2 text-xs">
          <span className="text-ivory font-semibold">Skills: </span>
          {Object.entries(stats.skill_modifiers)
            .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`)
            .join(", ")}
        </div>
      )}

      {stats.abilities.length > 0 && (
        <ul className="border-border mt-5 space-y-2 border-t pt-4 text-sm leading-relaxed">
          {stats.abilities.map((ab) => (
            <li key={ab.name}>
              <span className="text-ivory font-bold">{ab.name}.</span>{" "}
              <span className="text-ivory-dim">{ab.description}</span>
            </li>
          ))}
        </ul>
      )}

      {isMain && mainEnemyProfile && (
        <div className="border-blood/40 mt-6 border-t pt-4">
          <p className="text-gold font-display text-base tracking-widest">{m.enemy_main_villain()}</p>
          <p className="text-ivory mt-2 text-sm leading-relaxed">{mainEnemyProfile.description}</p>
          <p className="text-ivory-dim mt-3 font-serif text-sm leading-relaxed italic">{mainEnemyProfile.tactics}</p>
          <div className="mt-3 space-y-1">
            {mainEnemyProfile.dialogue.map((line, i) => (
              <p key={i} className="text-ivory text-sm leading-relaxed">
                {normalizeDialogueLine(line)}
              </p>
            ))}
          </div>
        </div>
      )}

      {isPending && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="blood-button inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {isLoading ? m.common_loading_short() : m.btn_confirm()}
          </button>
          <button
            type="button"
            onClick={onDeny}
            disabled={isLoading}
            className="border-border bg-ink-soft/60 text-ivory hover:border-destructive/60 hover:text-destructive inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {isLoading ? m.common_loading_short() : m.btn_deny()}
          </button>
        </div>
      )}

      {isConfirmed && (
        <div className="mt-5 flex items-center gap-3">
          {isRemoving ? (
            <>
              <span className="text-ivory-dim flex-1 text-sm">{m.enemy_remove_confirm()}</span>
              <button
                type="button"
                onClick={onRemoveConfirm}
                disabled={isLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isLoading ? m.common_loading_short() : m.btn_yes()}
              </button>
              <button
                type="button"
                onClick={onRemoveCancel}
                disabled={isLoading}
                className="border-border bg-ink-soft/60 text-ivory hover:border-blood/60 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {m.common_cancel()}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onEditStart}
                disabled={isLoading}
                className="border-border bg-ink-soft/60 text-ivory hover:border-blood/60 inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {m.common_edit()}
              </button>
              <button
                type="button"
                onClick={onRemoveStart}
                disabled={isLoading}
                className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {m.common_remove()}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
