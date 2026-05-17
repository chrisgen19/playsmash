import type { Metadata } from "next";
import { Roboto_Flex } from "next/font/google";

import { Providers } from "@/components/shared/providers";

import "./globals.css";

const robotoFlex = Roboto_Flex({
  variable: "--font-roboto-flex",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "GRAD"],
});

export const metadata: Metadata = {
  title: "Playsmash — Pickleball stacking & scoring",
  description:
    "Manage pickleball groups, sessions, court rotations, and scores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${robotoFlex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
