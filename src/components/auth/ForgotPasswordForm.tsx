import React, { useState } from "react";
import { Mail, Send } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { m } from "@/paraglide/messages.js";

interface Props {
  serverError?: string | null;
}

export default function ForgotPasswordForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ email?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = m.validation_email_required();
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = m.validation_email_invalid();
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/auth/forgot-password" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label={m.field_email()}
        value={email}
        onChange={(v) => {
          setEmail(v);
          if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
        }}
        placeholder={m.placeholder_email()}
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText={m.btn_send_reset_pending()} icon={<Send className="size-4" />}>
        {m.btn_send_reset()}
      </SubmitButton>
    </form>
  );
}
