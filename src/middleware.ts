import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { SPACE_ACCESS, defaultSpaceFor, type Space } from "@/lib/spaces";

// README §"Rôles et contrôle d'accès" (CRITIQUE): "Masquer les onglets non
// autorisés ET protéger chaque route/API par rôle." This middleware is the
// route half; src/lib/access.ts's requireApiSpace() covers the API half.
export async function middleware(req: NextRequest) {
  const token = await getToken({ req });
  const space = req.nextUrl.pathname.split("/")[1] as Space;

  if (!token || !token.role) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!SPACE_ACCESS[token.role].includes(space)) {
    return NextResponse.redirect(new URL(`/${defaultSpaceFor(token.role)}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/employe/:path*", "/equipe/:path*", "/questionnaire/:path*", "/employes/:path*"],
};
