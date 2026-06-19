import React, { useState } from "react";
import { Pencil, Swords, Hash, MapPin } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";
import type { Battle } from "@/types";

interface Props {
  battleId: string;
  initialName: string;
  initialPartyLevel: number | null;
  initialLocation: string | null;
  createdDate: string;
}

export default function BattleHeader({
  battleId,
  initialName,
  initialPartyLevel,
  initialLocation,
  createdDate,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // committed = values shown in read mode; updated on successful save
  const [committed, setCommitted] = useState({
    name: initialName,
    partyLevelNum: initialPartyLevel,
    location: initialLocation,
  });

  // form state — reset from committed each time the edit form opens
  const [name, setName] = useState(initialName);
  const [partyLevel, setPartyLevel] = useState(initialPartyLevel != null ? String(initialPartyLevel) : "");
  const [location, setLocation] = useState(initialLocation ?? "");

  function handleEdit() {
    setName(committed.name);
    setPartyLevel(committed.partyLevelNum != null ? String(committed.partyLevelNum) : "");
    setLocation(committed.location ?? "");
    setError(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setError(null);
    setIsEditing(false);
  }

  async function handleSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/battles/${battleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          party_level: partyLevel !== "" ? Number(partyLevel) : null,
          location: location !== "" ? location : null,
        }),
      });
      const data = (await res.json()) as { battle?: Battle; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save changes. Please try again.");
      } else if (data.battle) {
        setCommitted({
          name: data.battle.name,
          partyLevelNum: data.battle.party_level,
          location: data.battle.location,
        });
        setIsEditing(false);
      } else {
        setError("Unexpected response. Please refresh and try again.");
      }
    } catch {
      setError("Could not save changes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isEditing) {
    return (
      <div className="mb-8">
        <ServerError message={error} />
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            void handleSave(e);
          }}
        >
          <FormField
            id="battle-name"
            label="Battle Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Frozen Cave Ambush"
            icon={<Swords className="size-4" />}
          />
          <FormField
            id="battle-party-level"
            type="number"
            label="Party Level (optional)"
            value={partyLevel}
            onChange={setPartyLevel}
            placeholder="e.g. 5"
            icon={<Hash className="size-4" />}
          />
          <FormField
            id="battle-location"
            label="Location (optional)"
            value={location}
            onChange={setLocation}
            placeholder="e.g. Ice Cave"
            icon={<MapPin className="size-4" />}
          />
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-[#701c3b] px-4 py-2 font-medium text-white transition-colors hover:bg-[#9f1239]"
            >
              {isLoading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving...
                </>
              ) : (
                <>
                  <Pencil className="size-4" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="rounded-lg border border-white/20 bg-transparent px-4 py-2 font-medium text-blue-100/80 transition-colors hover:bg-white/10"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="group relative mb-6 flex items-start gap-3">
        <h1 className="bg-linear-to-r from-blue-200 to-rose-200 bg-clip-text text-3xl font-bold text-transparent">
          {committed.name}
        </h1>
        <button
          type="button"
          onClick={handleEdit}
          className="mt-1 rounded-md p-1.5 text-white/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-white/80 focus-visible:opacity-100"
          aria-label="Edit battle"
        >
          <Pencil className="size-4" />
        </button>
      </div>
      <div className="mb-8 flex flex-wrap gap-3">
        {committed.partyLevelNum != null && (
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-blue-100/80">
            Party Level {committed.partyLevelNum}
          </span>
        )}
        {committed.location && (
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-blue-100/80">
            {committed.location}
          </span>
        )}
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-blue-100/80">
          Created {createdDate}
        </span>
      </div>
    </>
  );
}
