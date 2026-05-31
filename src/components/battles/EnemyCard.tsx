import { EnemySchema, type EnemyStats } from "@/lib/schemas/enemy";
import type { Enemy } from "@/types";

interface Props {
  enemy: Enemy;
  onConfirm?: () => void;
  onDeny?: () => void;
  isLoading?: boolean;
}

function modifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 px-2 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-blue-100/50">{label}</span>
      <span className="text-base font-bold text-white">{value}</span>
      <span className="text-xs text-blue-100/60">{modifier(value)}</span>
    </div>
  );
}

export function EnemyCard({ enemy, onConfirm, onDeny, isLoading }: Props) {
  let stats: EnemyStats | null = null;
  try {
    stats = EnemySchema.parse(enemy.stats);
  } catch {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-900/10 p-4 text-sm text-red-300">
        Could not parse stat block for <strong>{enemy.name}</strong>.
      </div>
    );
  }

  const isPending = !!onConfirm || !!onDeny;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-white">{stats.name}</h3>
        <div className="flex shrink-0 gap-2 text-xs text-blue-100/60">
          <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5">CR {stats.cr}</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-sm text-blue-100/70">
        <span>HP <strong className="text-white">{stats.hp}</strong></span>
        <span>AC <strong className="text-white">{stats.ac}</strong></span>
        <span>Speed <strong className="text-white">{stats.speed}</strong></span>
      </div>

      <div className="mb-4 grid grid-cols-6 gap-1">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((attr) => (
          <StatBox key={attr} label={attr.toUpperCase()} value={stats![attr]} />
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

      {isPending && (
        <div className="flex gap-2 border-t border-white/10 pt-3">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
          >
            {isLoading ? "..." : "Confirm"}
          </button>
          <button
            onClick={onDeny}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-blue-100/70 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {isLoading ? "..." : "Deny"}
          </button>
        </div>
      )}
    </div>
  );
}
