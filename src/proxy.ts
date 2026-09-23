import { auth as proxy } from "@/lib/auth/auth";

export { proxy };

export const config = {
  matcher: ["/admin/:path*"],
};
