import { useState } from "react";
import { EnemySchema, type EnemyStats, type MainEnemyProfile } from "@/lib/schemas/enemy";
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
  "rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white focus:border-rose-500/50 focus:outline-none";

function modifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 px-2 py-2">
      <span className="text-xs font-semibold tracking-wide text-blue-100/50 uppercase">{label}</span>
      <span className="text-base font-bold text-white">{value}</span>
      <span className="text-xs text-blue-100/60">{modifier(value)}</span>
    </div>
  );
}

function numVal(n: number): number | "" {
  return isNaN(n) ? "" : n;
}

function EnemyEditForm({ initialStats, onSave, onCancel, isLoading }: EditFormProps) {
  const [draft, setDraft] = useState<EnemyStats>(initialStats);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-start gap-2">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => {
            setDraft((prev) => ({ ...prev, name: e.target.value }));
          }}
          className="flex-1 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-lg font-bold text-white focus:border-rose-500/50 focus:outline-none"
        />
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-xs text-blue-100/50">CR</span>
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

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-1 text-blue-100/70">
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
        <label className="flex items-center gap-1 text-blue-100/70">
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
        <label className="flex items-center gap-1 text-blue-100/70">
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
          <div
            key={attr}
            className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-2"
          >
            <span className="text-xs font-semibold tracking-wide text-blue-100/50 uppercase">{attr}</span>
            <input
              type="number"
              min={1}
              max={30}
              value={numVal(draft[attr])}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, [attr]: e.target.valueAsNumber }));
              }}
              className="w-full rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-sm text-white focus:border-rose-500/50 focus:outline-none"
            />
          </div>
        ))}
      </div>

      {draft.saving_throws && Object.keys(draft.saving_throws).length > 0 && (
        <div className="mb-3">
          <span className="text-xs font-semibold text-blue-100/80">Saves: </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {Object.entries(draft.saving_throws).map(([k, v]) => (
              <label key={k} className="flex items-center gap-1 text-xs text-blue-100/60">
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
                  className="w-12 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-xs text-white focus:border-rose-500/50 focus:outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {draft.skill_modifiers && Object.keys(draft.skill_modifiers).length > 0 && (
        <div className="mb-3">
          <span className="text-xs font-semibold text-blue-100/80">Skills: </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {Object.entries(draft.skill_modifiers).map(([k, v]) => (
              <label key={k} className="flex items-center gap-1 text-xs text-blue-100/60">
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
                  className="w-12 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-xs text-white focus:border-rose-500/50 focus:outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {draft.abilities.length > 0 && (
        <ul className="mb-4 space-y-2 border-t border-white/10 pt-3">
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
                className={`w-full text-blue-100/70 ${inputCls}`}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => {
            onSave(draft);
          }}
          disabled={isLoading}
          className="flex-1 rounded-lg bg-[#701c3b] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#9f1239] disabled:opacity-50"
        >
          {isLoading ? "..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-blue-100/70 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          Cancel
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
      <div className="rounded-xl border border-red-500/30 bg-red-900/10 p-4 text-sm text-red-300">
        Could not parse stat block for <strong>{enemy.name}</strong>.
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
    <div
      className={`rounded-xl border bg-white/5 p-5 backdrop-blur-xl ${isMain ? "border-l-2 border-white/10 border-l-amber-400/60" : "border-white/10"}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-white">{stats.name}</h3>
        <div className="flex shrink-0 gap-2 text-xs text-blue-100/60">
          <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5">CR {stats.cr}</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-sm text-blue-100/70">
        <span>
          HP <strong className="text-white">{stats.hp}</strong>
        </span>
        <span>
          AC <strong className="text-white">{stats.ac}</strong>
        </span>
        <span>
          Speed <strong className="text-white">{stats.speed}</strong>
        </span>
      </div>

      <div className="mb-4 grid grid-cols-6 gap-1">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((attr) => (
          <StatBox key={attr} label={attr.toUpperCase()} value={stats[attr]} />
        ))}
      </div>

      {stats.saving_throws && Object.keys(stats.saving_throws).length > 0 && (
        <div className="mb-3 text-xs text-blue-100/60">
          <span className="font-semibold text-blue-100/80">Saves: </span>
          {Object.entries(stats.saving_throws)
            .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`)
            .join(", ")}
        </div>
      )}

      {stats.skill_modifiers && Object.keys(stats.skill_modifiers).length > 0 && (
        <div className="mb-3 text-xs text-blue-100/60">
          <span className="font-semibold text-blue-100/80">Skills: </span>
          {Object.entries(stats.skill_modifiers)
            .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`)
            .join(", ")}
        </div>
      )}

      {stats.abilities.length > 0 && (
        <ul className="mb-4 space-y-1.5 border-t border-white/10 pt-3">
          {stats.abilities.map((ab) => (
            <li key={ab.name} className="text-sm">
              <span className="font-semibold text-blue-100">{ab.name}.</span>{" "}
              <span className="text-blue-100/70">{ab.description}</span>
            </li>
          ))}
        </ul>
      )}

      {isMain && mainEnemyProfile && (
        <div className="mt-3 border-t border-amber-400/30 pt-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-amber-400 uppercase">Main Villain</p>
          <p className="mb-2 text-sm text-blue-100/80">{mainEnemyProfile.description}</p>
          <p className="mb-2 text-sm text-blue-100/60 italic">{mainEnemyProfile.tactics}</p>
          <div className="space-y-1">
            {mainEnemyProfile.dialogue.map((line, i) => (
              <p key={i} className="text-sm text-blue-100/70">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {isPending && (
        <div className="flex gap-2 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-[#701c3b] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#9f1239] disabled:opacity-50"
          >
            {isLoading ? "..." : "Confirm"}
          </button>
          <button
            type="button"
            onClick={onDeny}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-blue-100/70 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {isLoading ? "..." : "Deny"}
          </button>
        </div>
      )}

      {isConfirmed && (
        <div className="flex items-center gap-2 border-t border-white/10 pt-3">
          {isRemoving ? (
            <>
              <span className="flex-1 text-sm text-blue-100/70">Remove this enemy?</span>
              <button
                type="button"
                onClick={onRemoveConfirm}
                disabled={isLoading}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {isLoading ? "..." : "Yes"}
              </button>
              <button
                type="button"
                onClick={onRemoveCancel}
                disabled={isLoading}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-blue-100/70 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onEditStart}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-blue-100/70 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onRemoveStart}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-red-500/30 bg-red-900/10 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
              >
                Remove
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
