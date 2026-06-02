import React, { useState } from "react";

export default function CreateCampaignForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpen() {
    setOpen(true);
    setError(null);
  }

  function handleCancel() {
    setOpen(false);
    setName("");
    setDescription("");
    setError(null);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Campaign name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, description: description.trim() || undefined }),
      });
      const data = (await res.json()) as { campaign?: { id: string }; error?: string };
      if (!res.ok || !data.campaign) {
        setError(data.error ?? "Could not create campaign. Please try again.");
        return;
      }
      window.location.href = `/campaigns/${data.campaign.id}`;
    } catch {
      setError("Could not create campaign. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500"
      >
        + Create Campaign
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <h2 className="mb-4 text-sm font-semibold tracking-wider text-blue-100/60 uppercase">New Campaign</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="campaign-name" className="mb-1 block text-sm font-medium text-white">
            Name
          </label>
          <input
            id="campaign-name"
            type="text"
            required
            maxLength={200}
            placeholder="e.g. Curse of Strahd"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-blue-100/40 focus:border-purple-400/60 focus:outline-none"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="campaign-description" className="mb-1 block text-sm font-medium text-white">
            Description <span className="text-blue-100/40">(optional)</span>
          </label>
          <input
            id="campaign-description"
            type="text"
            maxLength={500}
            placeholder="A brief note about this campaign"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-blue-100/40 focus:border-purple-400/60 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Campaign"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
