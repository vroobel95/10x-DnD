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
  const [errors, setErrors] = useState<{ name?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!name.trim()) {
      next.name = "Battle name is required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/battles" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <ServerError message={serverError} />

      <FormField
        id="name"
        label="Battle Name"
        value={name}
        onChange={(v) => {
          setName(v);
          clearError("name");
        }}
        placeholder="e.g. Frozen Cave Ambush"
        icon={<Swords className="size-4" />}
        error={errors.name}
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
