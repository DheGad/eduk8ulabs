import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";

export const metadata: Metadata = {
  title: "StreetMP OS | The Universal Meta-OS & Secure AI Proxy",
  description: "Enterprise-grade AI security. Route, monitor, and secure your LLM API calls with zero-latency proxying and immutable audit logs. PDPA and MAS TRM compliant.",
  openGraph: {
    type: "website",
    url: "https://os.streetmp.com",
    siteName: "StreetMP OS",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@streetmp",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NEXT_PUBLIC_ANALYTICS_ID && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_ANALYTICS_ID}`}
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_ANALYTICS_ID}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body className="antialiased text-zinc-900 dark:text-white bg-white dark:bg-[#0A0A0A] transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          {process.env.NEXT_PUBLIC_CHAT_ID && (
            <Script
              id="crisp-chat"
              strategy="lazyOnload"
              dangerouslySetInnerHTML={{
                __html: `window.$crisp=[];window.CRISP_WEBSITE_ID="${process.env.NEXT_PUBLIC_CHAT_ID}";(function(){d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`
              }}
            />
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
