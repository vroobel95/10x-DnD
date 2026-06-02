import React, { useState } from "react";
import type { Campaign } from "@/types";

export type CampaignWithCount = Campaign & { battleCount: number };

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
        setActionError(data.error ?? "Could not rename campaign");
        return;
      }
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      setEditingId(null);
    } catch {
      setActionError("Could not rename campaign");
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
        setActionError(data.error ?? "Could not delete campaign");
        return;
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      setDeletingId(null);
    } catch {
      setActionError("Could not delete campaign");
    } finally {
      setLoadingId(null);
    }
  }

  function handleDeleteCancel() {
    setDeletingId(null);
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
        <p className="mb-2 text-lg font-semibold text-white">No campaigns yet</p>
        <p className="text-sm text-blue-100/60">Create your first campaign above to get started.</p>
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
      {campaigns.map((campaign) => {
        const isEditing = editingId === campaign.id;
        const isDeleting = deletingId === campaign.id;
        const isLoading = loadingId === campaign.id;
        const createdDate = new Date(campaign.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        return (
          <div key={campaign.id} className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            {isEditing ? (
              <div className="mb-3 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-blue-100/40 focus:border-purple-400/60 focus:outline-none"
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
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={handleRenameCancel}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <a
                href={`/campaigns/${campaign.id}`}
                className="mb-2 block text-base font-semibold text-white hover:text-purple-300"
              >
                {campaign.name}
              </a>
            )}

            {campaign.description && !isEditing && (
              <p className="mb-2 text-sm text-blue-100/60">{campaign.description}</p>
            )}

            <div className="mb-4 flex flex-wrap gap-3 text-sm text-blue-100/60">
              <span>
                {campaign.battleCount} battle{campaign.battleCount !== 1 ? "s" : ""}
              </span>
              <span>·</span>
              <span>{createdDate}</span>
            </div>

            {isDeleting ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-red-300">
                  Delete &ldquo;{campaign.name}&rdquo; and its {campaign.battleCount} battle
                  {campaign.battleCount !== 1 ? "s" : ""}?
                </span>
                <button
                  onClick={() => handleDeleteConfirm(campaign.id)}
                  disabled={isLoading}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  {isLoading ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={handleDeleteCancel}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleRenameStart(campaign.id, campaign.name);
                  }}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    handleDeleteStart(campaign.id);
                  }}
                  className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
