import React, { useState } from "react";
import { BookOpen, FileText } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

export default function CreateCampaignForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      const data = (await res.json()) as { campaign?: { id: string }; error?: string };
      if (!res.ok || !data.campaign) {
        setServerError(data.error ?? "Could not create campaign. Please try again.");
        return;
      }
      window.location.href = `/campaigns/${data.campaign.id}`;
    } catch {
      setServerError("Could not create campaign. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

      <SubmitButton pendingText="Creating..." icon={<BookOpen className="size-4" />} isLoading={loading}>
        Create Campaign
      </SubmitButton>
    </form>
  );
}
