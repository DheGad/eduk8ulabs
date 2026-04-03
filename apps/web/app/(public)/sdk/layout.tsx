import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SDK Developer Portal — Build Governed AI in 60 Seconds | StreetMP OS",
  description:
    "Install @streetmp/sdk and add enterprise-grade AI governance to any Node.js or browser application with a one-line code change. Zero runtime dependencies. Drop-in OpenAI compatible.",
  openGraph: {
    title: "StreetMP OS SDK — Governed AI for Developers",
    description:
      "npm install @streetmp/sdk. One import. Full compliance. STP certificate on every call.",
    url: "https://os.streetmp.com/sdk",
  },
};

export default function SdkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
