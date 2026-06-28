import { useState } from "react";
import { Skull, Crown, Flame, Eye, Moon, Swords, Calendar } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { Campaign } from "@/types";

export type CampaignWithCount = Campaign & { battleCount: number };

// Decorative sigil derived from the campaign id (stable, not persisted).
const SIGILS = [Skull, Crown, Flame, Eye, Moon] as const;
function sigilFor(id: string): (typeof SIGILS)[number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SIGILS[h % SIGILS.length];
}

// Select the correct plural form for the active locale (Polish needs one/few/many/other).
function battleCountLabel(count: number): string {
  switch (new Intl.PluralRules(getLocale()).select(count)) {
    case "one":
      return m.campaigns_battle_count_one({ count });
    case "few":
      return m.campaigns_battle_count_few({ count });
    case "many":
      return m.campaigns_battle_count_many({ count });
    default:
      return m.campaigns_battle_count_other({ count });
  }
}

interface Props {
  campaigns: CampaignWithCount[];
}

export default function CampaignList({ campaigns: initial }: Props) {
  const [campaigns, setCampaigns] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingDraft, setRenamingDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleRenameStart(id: string, currentName: string) {
    setEditingId(id);
    setRenamingDraft(currentName);
    setActionError(null);
  }

  async function handleRenameSave(id: string) {
    const name = renamingDraft.trim();
    if (!name) return;
    setLoadingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setActionError(data.error ?? m.err_rename_campaign());
        return;
      }
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      setEditingId(null);
    } catch {
      setActionError(m.err_rename_campaign());
    } finally {
      setLoadingId(null);
    }
  }

  function handleRenameCancel() {
    setEditingId(null);
    setRenamingDraft("");
  }

  function handleDeleteStart(id: string) {
    setDeletingId(id);
    setActionError(null);
  }

  async function handleDeleteConfirm(id: string) {
    setLoadingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setActionError(data.error ?? m.err_delete_campaign());
        return;
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      setDeletingId(null);
    } catch {
      setActionError(m.err_delete_campaign());
    } finally {
      setLoadingId(null);
    }
  }

  function handleDeleteCancel() {
    setDeletingId(null);
  }

  if (campaigns.length === 0) {
    return (
      <div className="ink-card p-10 text-center">
        <Swords className="text-blood-bright mx-auto h-8 w-8" strokeWidth={1.5} />
        <p className="text-ivory font-display mt-4 text-2xl">{m.campaigns_empty_title()}</p>
        <a href="/campaigns/new" className="text-blood-bright mt-3 inline-block text-sm hover:underline">
          {m.campaigns_create_first()}
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
      {campaigns.map((campaign) => {
        const isEditing = editingId === campaign.id;
        const isDeleting = deletingId === campaign.id;
        const isLoading = loadingId === campaign.id;
        const Sigil = sigilFor(campaign.id);
        const createdDate = new Date(campaign.created_at).toLocaleDateString(getLocale(), {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        return (
          <div key={campaign.id} className="ink-card group p-5">
            <div className="flex items-center gap-4">
              <div className="border-blood/40 bg-blood/10 flex h-12 w-12 shrink-0 items-center justify-center rounded border">
                <Sigil className="text-blood-bright h-5 w-5" strokeWidth={1.5} />
              </div>

              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      className="bg-ink-deep/60 border-border text-ivory placeholder-ivory-dim/50 focus:border-blood flex-1 rounded-md border px-3 py-1.5 text-sm focus:outline-none"
                      value={renamingDraft}
                      onChange={(e) => {
                        setRenamingDraft(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRenameSave(campaign.id);
                        if (e.key === "Escape") handleRenameCancel();
                      }}
                      autoFocus
                      maxLength={200}
                    />
                    <button
                      onClick={() => handleRenameSave(campaign.id)}
                      disabled={isLoading}
                      className="blood-button rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {m.common_save()}
                    </button>
                    <button
                      onClick={handleRenameCancel}
                      className="border-border bg-ink-soft/60 text-ivory hover:border-blood/60 rounded-md border px-3 py-1.5 text-xs font-medium"
                    >
                      {m.common_cancel()}
                    </button>
                  </div>
                ) : (
                  <a
                    href={`/campaigns/${campaign.id}`}
                    className="text-ivory font-display group-hover:text-blood-bright block text-2xl transition"
                  >
                    {campaign.name}
                  </a>
                )}

                {campaign.description && !isEditing && (
                  <p className="text-ivory-dim mt-0.5 line-clamp-1 text-sm">{campaign.description}</p>
                )}

                <div className="text-ivory-dim mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <Swords className="text-blood-bright h-3.5 w-3.5" /> {battleCountLabel(campaign.battleCount)}
                  </span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> {createdDate}
                  </span>
                </div>
              </div>
            </div>

            {isDeleting ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-destructive text-sm">
                  {m.campaigns_delete_confirm({
                    name: campaign.name,
                    battles: battleCountLabel(campaign.battleCount),
                  })}
                </span>
                <button
                  onClick={() => handleDeleteConfirm(campaign.id)}
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
              !isEditing && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      handleRenameStart(campaign.id, campaign.name);
                    }}
                    className="border-border bg-ink-soft/60 text-ivory hover:border-blood/60 rounded-md border px-3 py-1.5 text-xs font-medium"
                  >
                    {m.common_rename()}
                  </button>
                  <button
                    onClick={() => {
                      handleDeleteStart(campaign.id);
                    }}
                    className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md border px-3 py-1.5 text-xs font-medium"
                  >
                    {m.common_delete()}
                  </button>
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
