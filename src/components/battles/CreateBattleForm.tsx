import React, { useState } from "react";
import { Swords, Hash, MapPin } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { m } from "@/paraglide/messages.js";

interface Props {
  campaignId: string;
  serverError?: string | null;
}

export default function CreateBattleForm({ campaignId, serverError }: Props) {
  const [name, setName] = useState("");
  const [partyLevel, setPartyLevel] = useState("");
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    const next: typeof errors = {};
    if (!name.trim()) {
      next.name = m.validation_battle_name_required();
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
      return;
    }
    setIsSubmitting(true);
  }

  return (
    <form method="POST" action="/api/battles" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="campaign_id" value={campaignId} />
      <ServerError message={serverError} />

      <FormField
        id="name"
        label={m.create_battle_name_label()}
        value={name}
        onChange={(v) => {
          setName(v);
          clearError("name");
        }}
        placeholder={m.create_battle_name_placeholder()}
        icon={<Swords className="size-4" />}
        error={errors.name}
      />

      <FormField
        id="party_level"
        type="number"
        label={m.create_battle_level_label()}
        value={partyLevel}
        onChange={setPartyLevel}
        placeholder={m.create_battle_level_placeholder()}
        icon={<Hash className="size-4" />}
      />

      <FormField
        id="location"
        label={m.create_battle_location_label()}
        value={location}
        onChange={setLocation}
        placeholder={m.create_battle_location_placeholder()}
        icon={<MapPin className="size-4" />}
      />

      <SubmitButton
        pendingText={m.create_campaign_pending()}
        icon={<Swords className="size-4" />}
        isLoading={isSubmitting}
      >
        {m.create_battle_submit()}
      </SubmitButton>
    </form>
  );
}
