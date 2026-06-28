import { useState } from "react";
import { Swords, MapPin, Calendar, Trash2 } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { Battle } from "@/types";

interface Props {
  battles: Battle[];
  campaignId: string;
}

export default function CampaignBattleList({ battles: initial, campaignId }: Props) {
  const [battles, setBattles] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleDeleteStart(id: string) {
    setDeletingId(id);
    setActionError(null);
  }

  async function handleDeleteConfirm(id: string) {
    setLoadingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/battles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setActionError(data.error ?? m.err_delete_battle());
        return;
      }
      setBattles((prev) => prev.filter((b) => b.id !== id));
      setDeletingId(null);
    } catch {
      setActionError(m.err_delete_battle());
    } finally {
      setLoadingId(null);
    }
  }

  function handleDeleteCancel() {
    setDeletingId(null);
  }

  if (battles.length === 0) {
    return (
      <div className="ink-card mx-auto max-w-md p-10 text-center">
        <Swords className="text-blood-bright mx-auto h-8 w-8" strokeWidth={1.5} />
        <p className="text-ivory font-display mt-4 text-2xl">{m.battles_empty_title()}</p>
        <p className="text-ivory-dim mt-2 font-serif italic">{m.battles_empty_desc()}</p>
        <a
          href={`/battles/new?campaignId=${campaignId}`}
          className="blood-button mt-5 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
        >
          {m.battles_create_first()}
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {actionError && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
          {actionError}
        </div>
      )}
      {battles.map((battle) => {
        const isDeleting = deletingId === battle.id;
        const isLoading = loadingId === battle.id;
        const isNavigating = navigatingId === battle.id;
        const partyLevel =
          battle.party_level != null ? m.battle_level({ level: battle.party_level }) : m.battle_level_unknown();
        const createdDate = new Date(battle.created_at).toLocaleDateString(getLocale(), {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        return (
          <div
            key={battle.id}
            className={`ink-card group p-5 ${isNavigating ? "pointer-events-none cursor-wait opacity-60" : ""}`}
          >
            <a
              href={`/battles/${battle.id}`}
              onClick={() => {
                setNavigatingId(battle.id);
              }}
              className="text-ivory font-display group-hover:text-blood-bright block text-2xl transition"
            >
              {battle.name}
            </a>
            <div className="text-ivory-dim mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>{m.battle_party({ level: partyLevel })}</span>
              {battle.location && (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="text-blood-bright h-3.5 w-3.5" /> {battle.location}
                  </span>
                </>
              )}
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {createdDate}
              </span>
            </div>

            {isDeleting ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-destructive text-sm">{m.battle_delete_confirm({ name: battle.name })}</span>
                <button
                  onClick={() => handleDeleteConfirm(battle.id)}
                  disabled={isLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {isLoading ? m.common_deleting() : m.common_yes_delete()}
                </button>
                <button
                  onClick={handleDeleteCancel}
                  className="border-border bg-ink-soft/60 text-ivory hover:border-blood/60 rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  {m.common_cancel()}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  handleDeleteStart(battle.id);
                }}
                className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" /> {m.common_delete()}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
