import React, { useState } from "react";
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
      <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
        <p className="mb-2 text-lg font-semibold text-white">{m.battles_empty_title()}</p>
        <p className="mb-6 text-sm text-blue-100/60">{m.battles_empty_desc()}</p>
        <a
          href={`/battles/new?campaignId=${campaignId}`}
          className="inline-flex items-center justify-center rounded-lg bg-[#701c3b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#9f1239]"
        >
          {m.battles_create_first()}
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {actionError && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
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
            className={`rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-colors hover:border-rose-400/30 ${isNavigating ? "pointer-events-none cursor-wait opacity-60" : ""}`}
          >
            <a
              href={`/battles/${battle.id}`}
              onClick={() => {
                setNavigatingId(battle.id);
              }}
              className="mb-2 block text-base font-semibold text-white hover:text-rose-300"
            >
              {battle.name}
            </a>
            <div className="mb-4 flex flex-wrap gap-3 text-sm text-blue-100/60">
              <span>{m.battle_party({ level: partyLevel })}</span>
              {battle.location && (
                <>
                  <span>·</span>
                  <span>{battle.location}</span>
                </>
              )}
              <span>·</span>
              <span>{createdDate}</span>
            </div>

            {isDeleting ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-red-300">{m.battle_delete_confirm({ name: battle.name })}</span>
                <button
                  onClick={() => handleDeleteConfirm(battle.id)}
                  disabled={isLoading}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  {isLoading ? m.common_deleting() : m.common_yes_delete()}
                </button>
                <button
                  onClick={handleDeleteCancel}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
                >
                  {m.common_cancel()}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  handleDeleteStart(battle.id);
                }}
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20"
              >
                {m.common_delete()}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
