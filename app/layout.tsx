import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AI CookBook",
  description: "Personal AI Cooking Place",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Dark mode only -- the class is hardcoded, no theme switching.
    <html lang="en" className="dark">
      <head>
        {/* Clicking Stop on a streaming chat response aborts an in-flight
            fetch deep inside the AI SDK's own stream-reading code -- a
            promise we never get a reference to, so we can't attach a
            .catch to it ourselves. This must run via beforeInteractive
            (a real <script>, not a React effect) so it attaches before
            Next's dev-overlay listener does; stopImmediatePropagation on
            an earlier-registered listener keeps later ones (Next's) from
            firing for this one, known-expected event. Only silences
            AbortError specifically -- every other rejection still reaches
            the overlay normally. Dev-only cosmetic; production has no
            overlay to trigger in the first place. */}
        <Script id="silence-abort-overlay" strategy="beforeInteractive">
          {`window.addEventListener("unhandledrejection", function (event) {
            if (event.reason && event.reason.name === "AbortError") {
              event.preventDefault();
              event.stopImmediatePropagation();
            }
          });`}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
