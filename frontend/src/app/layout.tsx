import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const editorial = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-instrument-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SupportIQ — AI customer support copilot", template: "%s · SupportIQ" },
  description:
    "SupportIQ reads each ticket, finds the policy that answers it, checks the order against your rules and drafts a cited reply for a human to approve.",
};

export const viewport: Viewport = { themeColor: "#060912", colorScheme: "dark" };

// Runs before first paint. `motion` enables scroll reveals; `intro-skip` hides the
// homepage intro for repeat visits in this session, other entry pages and reduced motion.
const BOOT = `(function(){var d=document.documentElement;try{var r=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!r)d.classList.add('motion');if(r||location.pathname!=='/'||sessionStorage.getItem('siq-intro-seen'))d.classList.add('intro-skip');}catch(e){d.classList.add('intro-skip');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${editorial.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
