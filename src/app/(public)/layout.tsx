import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PublicContactWidget } from "@/components/layout/PublicContactWidget";
import { getPublicContact } from "@/features/users/publicContact";

export const metadata: Metadata = {
  title: {
    default: "Arenan Kalikesek",
    template: "%s · Arenan Kalikesek",
  },
};

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const contact = await getPublicContact();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer contact={contact} />
      <PublicContactWidget contact={contact} />
    </div>
  );
}
