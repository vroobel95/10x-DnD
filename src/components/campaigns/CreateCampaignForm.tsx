import React, { useState } from "react";
import { BookOpen, FileText } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

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
      next.name = "Campaign name is required";
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
        label="Campaign Name"
        value={name}
        onChange={(v) => {
          setName(v);
          clearError("name");
        }}
        placeholder="e.g. Curse of Strahd"
        icon={<BookOpen className="size-4" />}
        error={errors.name}
      />

      <FormField
        id="description"
        label="Description (optional)"
        value={description}
        onChange={setDescription}
        placeholder="A brief note about this campaign"
        icon={<FileText className="size-4" />}
      />

      <SubmitButton pendingText="Creating..." icon={<BookOpen className="size-4" />} isLoading={isSubmitting}>
        Create Campaign
      </SubmitButton>
    </form>
  );
}
