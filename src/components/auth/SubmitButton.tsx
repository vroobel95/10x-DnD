import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

// Callers using native method="POST" forms must pass isLoading explicitly —
// useFormStatus only works with React 19 form actions, not native form submissions.
interface SubmitButtonProps {
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
  isLoading?: boolean;
}

export function SubmitButton({ pendingText, icon, children, isLoading = false }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={isLoading} className="w-full px-4 py-2">
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="border-ivory/30 border-t-ivory size-4 animate-spin rounded-full border-2" />
          {pendingText}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {icon}
          {children}
        </span>
      )}
    </Button>
  );
}
