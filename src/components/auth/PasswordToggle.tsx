import { Eye, EyeOff } from "lucide-react";
import { m } from "@/paraglide/messages.js";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-ivory-dim/60 hover:text-ivory absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
      aria-label={visible ? m.password_hide() : m.password_show()}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}
