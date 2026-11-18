import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ClientProviders } from "./providers";

export const metadata: Metadata = {
  title: "MedAssist AI — Healthcare Decision Support System",
  description: "Cloud-Based Multimodal Generative AI Healthcare Decision Support System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <Script
          id="medassist-theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('medassist_theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (!theme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full font-sans antialiased bg-medical-bg text-medical-text transition-colors duration-200">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
