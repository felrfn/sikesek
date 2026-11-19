import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PublicContactWidget } from "@/components/layout/PublicContactWidget";
import { getPublicContact } from "@/features/users/publicContact";
import { StepHeader } from "./StepHeader";
import { cn } from "@/lib/utils/cn";

/**
 * Shared chrome for every booking step: Navbar, the (optional) step header in
 * the same max-w-6xl container as the page content, and the Footer. Keeping the
 * container width in one place stops the step header and the cards below it
 * from drifting to different widths between steps.
 */
export async function BookingShell({
  children,
  showSteps = true,
  contentClassName,
  reserveBottomBar = false,
}: {
  children: ReactNode;
  showSteps?: boolean;
  contentClassName?: string;
  /** Leaves scroll room after the footer so a fixed mobile action bar never
   *  covers the last lines of the page. */
  reserveBottomBar?: boolean;
}) {
  const contact = await getPublicContact();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      {showSteps ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-6">
          <StepHeader />
        </div>
      ) : null}
      <main className={cn("flex-1", contentClassName)}>{children}</main>
      <Footer contact={contact} />
      <PublicContactWidget contact={contact} raised={reserveBottomBar} />
      {reserveBottomBar ? (
        <div aria-hidden="true" className="h-32 shrink-0 lg:hidden" />
      ) : null}
    </div>
  );
}
