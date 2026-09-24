"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getEligibleWorkersWithAvailability } from "./service";

export async function getEligibleWorkers() {
  await requireAdmin();
  return getEligibleWorkersWithAvailability();
}
