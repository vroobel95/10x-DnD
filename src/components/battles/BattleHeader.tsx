import React, { useState } from "react";
import { Pencil, Swords, Hash, MapPin } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";
import { m } from "@/paraglide/messages.js";
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
        setError(data.error ?? m.err_save_changes());
      } else if (data.battle) {
        setCommitted({
          name: data.battle.name,
          partyLevelNum: data.battle.party_level,
          location: data.battle.location,
        });
        setIsEditing(false);
      } else {
        setError(m.err_unexpected_response());
      }
    } catch {
      setError(m.err_save_changes());
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
            label={m.create_battle_name_label()}
            value={name}
            onChange={setName}
            placeholder={m.create_battle_name_placeholder()}
            icon={<Swords className="size-4" />}
          />
          <FormField
            id="battle-party-level"
            type="number"
            label={m.create_battle_level_label()}
            value={partyLevel}
            onChange={setPartyLevel}
            placeholder={m.create_battle_level_placeholder()}
            icon={<Hash className="size-4" />}
          />
          <FormField
            id="battle-location"
            label={m.create_battle_location_label()}
            value={location}
            onChange={setLocation}
            placeholder={m.create_battle_location_placeholder()}
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
                  {m.btn_save_changes_pending()}
                </>
              ) : (
                <>
                  <Pencil className="size-4" />
                  {m.btn_save_changes()}
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="rounded-lg border border-white/20 bg-transparent px-4 py-2 font-medium text-blue-100/80 transition-colors hover:bg-white/10"
            >
              {m.common_cancel()}
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
          aria-label={m.battle_edit_aria()}
        >
          <Pencil className="size-4" />
        </button>
      </div>
      <div className="mb-8 flex flex-wrap gap-3">
        {committed.partyLevelNum != null && (
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-blue-100/80">
            {m.battle_party_level_badge({ level: committed.partyLevelNum })}
          </span>
        )}
        {committed.location && (
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-blue-100/80">
            {committed.location}
          </span>
        )}
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-blue-100/80">
          {m.battle_created({ date: createdDate })}
        </span>
      </div>
    </>
  );
}
