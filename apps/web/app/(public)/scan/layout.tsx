import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live AI Risk Scanner — Are You Leaking Data? | StreetMP OS",
  description:
    "Paste your OpenAI API key and discover exactly what sensitive data your employees are leaking to AI today. See your unprotected PII exposure vs. StreetMP OS masked output — in 60 seconds.",
  openGraph: {
    title: "Live AI Risk Scanner | StreetMP OS",
    description:
      "Discover your AI data leaks in 60 seconds. Keys processed in memory. Never stored.",
    url: "https://os.streetmp.com/scan",
    siteName: "StreetMP OS",
  },
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
