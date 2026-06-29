import React, { useState } from "react";
import { Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { m } from "@/paraglide/messages.js";

const MIN_PASSWORD_LENGTH = 6;
const PASSWORD_RULES = [
  { re: /[a-z]/, label: () => m.pwrule_lower() },
  { re: /[A-Z]/, label: () => m.pwrule_upper() },
  { re: /[0-9]/, label: () => m.pwrule_number() },
  { re: /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/, label: () => m.pwrule_special() },
];

interface Props {
  serverError?: string | null;
}

export default function SignUpForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  function validate() {
    const next: typeof errors = {};

    if (!email.trim()) {
      next.email = m.validation_email_required();
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = m.validation_email_invalid();
    }

    if (!password) {
      next.password = m.validation_password_required();
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = m.validation_password_min({ min: MIN_PASSWORD_LENGTH });
    } else {
      const failing = PASSWORD_RULES.filter((r) => !r.re.test(password));
      if (failing.length > 0) {
        next.password = m.validation_password_contain({ rules: failing.map((r) => r.label()).join(", ") });
      }
    }

    if (!confirmPassword) {
      next.confirmPassword = m.validation_confirm_required();
    } else if (password !== confirmPassword) {
      next.confirmPassword = m.validation_passwords_mismatch();
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  const passwordHint =
    !errors.password && password.length > 0 ? (
      <p className="text-ivory-dim/70 mt-1 text-xs">{m.signup_password_hint()}</p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label={m.field_email()}
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder={m.placeholder_email()}
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id="password"
        label={m.field_password()}
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder={m.placeholder_password_min()}
        error={errors.password}
        hint={passwordHint}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label={m.field_confirm_password()}
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder={m.placeholder_reenter_password()}
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText={m.btn_create_account_pending()} icon={<UserPlus className="size-4" />}>
        {m.btn_create_account()}
      </SubmitButton>
    </form>
  );
}
