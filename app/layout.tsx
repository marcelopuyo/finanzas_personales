import type { Metadata } from "next";
import ThemeProvider from "@/components/layout/theme-provider";
import AppLayout from "@/components/layout/app-layout";
import { ToasterProvider } from "@/components/layout/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas Personales",
  description: "Gestión de finanzas personales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-gray-50 dark:bg-[#0a0a0a]">
        <ThemeProvider>
          <AppLayout>{children}</AppLayout>
          <ToasterProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
