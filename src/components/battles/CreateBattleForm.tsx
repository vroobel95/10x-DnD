import React, { useState } from "react";
import { Swords, Hash, MapPin } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  serverError?: string | null;
}

export default function CreateBattleForm({ serverError }: Props) {
  const [name, setName] = useState("");
  const [partyLevel, setPartyLevel] = useState("");
  const [location, setLocation] = useState("");

  return (
    <form method="POST" action="/api/battles" className="space-y-4">
      <ServerError message={serverError} />

      <FormField
        id="name"
        label="Battle Name"
        value={name}
        onChange={setName}
        placeholder="e.g. Frozen Cave Ambush"
        icon={<Swords className="size-4" />}
      />

      <FormField
        id="party_level"
        type="number"
        label="Party Level (optional)"
        value={partyLevel}
        onChange={setPartyLevel}
        placeholder="e.g. 5"
        icon={<Hash className="size-4" />}
      />

      <FormField
        id="location"
        label="Location (optional)"
        value={location}
        onChange={setLocation}
        placeholder="e.g. Ice Cave"
        icon={<MapPin className="size-4" />}
      />

      <SubmitButton pendingText="Creating..." icon={<Swords className="size-4" />}>
        Create Battle
      </SubmitButton>
    </form>
  );
}
