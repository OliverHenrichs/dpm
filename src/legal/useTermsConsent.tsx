import React, { useState } from "react";
import TermsDialog from "@/src/legal/components/TermsDialog";
import { acceptTerms, hasAcceptedTerms } from "@/src/legal/TermsStorage";

interface Pending {
  action: () => void;
  onDecline?: () => void;
}

/**
 * Runs a share (publishing, suggesting) only once this phone has agreed to the current terms of
 * use, asking first if it has not. Render `termsDialog` wherever the hook is used.
 */
export function useTermsConsent() {
  const [pending, setPending] = useState<Pending | null>(null);

  const withTerms = (action: () => void, onDecline?: () => void) => {
    void hasAcceptedTerms().then((accepted) =>
      accepted ? action() : setPending({ action, onDecline }),
    );
  };

  const agree = async () => {
    const current = pending;
    setPending(null);
    await acceptTerms();
    current?.action();
  };

  const decline = () => {
    const current = pending;
    setPending(null);
    current?.onDecline?.();
  };

  const termsDialog = (
    <TermsDialog
      visible={pending !== null}
      onAgree={() => void agree()}
      onCancel={decline}
    />
  );

  return { withTerms, termsDialog };
}
