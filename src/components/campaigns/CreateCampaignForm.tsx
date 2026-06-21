import React, { useState } from "react";
import { BookOpen, FileText } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { m } from "@/paraglide/messages.js";

interface Props {
  serverError?: string | null;
}

export default function CreateCampaignForm({ serverError }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    const next: typeof errors = {};
    if (!name.trim()) {
      next.name = m.validation_campaign_name_required();
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
    <form method="POST" action="/api/campaigns" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <ServerError message={serverError} />

      <FormField
        id="name"
        label={m.create_campaign_name_label()}
        value={name}
        onChange={(v) => {
          setName(v);
          clearError("name");
        }}
        placeholder={m.create_campaign_name_placeholder()}
        icon={<BookOpen className="size-4" />}
        error={errors.name}
      />

      <FormField
        id="description"
        label={m.create_campaign_desc_label()}
        value={description}
        onChange={setDescription}
        placeholder={m.create_campaign_desc_placeholder()}
        icon={<FileText className="size-4" />}
      />

      <SubmitButton
        pendingText={m.create_campaign_pending()}
        icon={<BookOpen className="size-4" />}
        isLoading={isSubmitting}
      >
        {m.create_campaign_submit()}
      </SubmitButton>
    </form>
  );
}
