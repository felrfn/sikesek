import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { assets } from "@/lib/assets";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Public-facing default. The admin and auth areas override this with the
// internal SIKESEK branding in their own layouts/pages. No title template
// here on purpose: a root template would also wrap the admin/booking titles.
export const metadata: Metadata = {
  title: "Arenan Kalikesek",
  description:
    "Destination management dan pengelolaan wisata Arenan Kalikesek.",
  icons: {
    icon: [{ url: assets.logo, type: "image/png" }],
    shortcut: assets.logo,
    apple: assets.logo,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
