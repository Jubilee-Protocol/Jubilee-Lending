"use client";

import { TermsModal, useTermsAccepted } from "./TermsModal";

export function TermsGuard({ children }: { children: React.ReactNode }) {
  const { accepted, accept, ready } = useTermsAccepted();

  if (!ready) return null;
  if (!accepted) return <TermsModal onAccept={accept} />;

  return <>{children}</>;
}
