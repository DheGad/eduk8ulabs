import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify STP Certificate | StreetMP Trust Protocol",
  description:
    "Paste any StreetMP execution ID or Merkle leaf hash to instantly verify it is a genuine, untampered STP governance certificate. Available to any auditor, regulator, or legal team — no account required.",
  openGraph: {
    title: "STP Certificate Verifier | StreetMP OS",
    description:
      "Cryptographic proof that an AI execution was governed. Verify any STP certificate in seconds.",
    url: "https://os.streetmp.com/verify",
  },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
