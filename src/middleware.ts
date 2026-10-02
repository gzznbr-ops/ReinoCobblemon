import { NextResponse, type NextRequest } from "next/server";

/**
 * Primeira barreira (rápida, sem banco): sem cookie de sessão não entra no
 * painel nem nas APIs administrativas. A validação REAL da sessão acontece no
 * servidor (requireAdminPage / requireAdminApi), que consulta o banco.
 */
const ADMIN_COOKIE = "reino_admin";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(ADMIN_COOKIE)?.value);

  let res: NextResponse;
  if (pathname.startsWith("/api/admin")) {
    if (pathname === "/api/admin/login" || hasSession) res = NextResponse.next();
    else res = NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  } else if (pathname === "/admin/login") {
    res = NextResponse.next();
  } else if (!hasSession) {
    // clone() mantém o basePath (ex.: /torneios) na URL de destino
    const login = req.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    res = NextResponse.redirect(login);
  } else {
    res = NextResponse.next();
  }

  // Área privada: nunca indexar nem guardar em cache compartilhado
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
