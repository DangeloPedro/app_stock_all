import { NextRequest, NextResponse } from "next/server";

// Proteção simples por senha — app de uso pessoal, um usuário só, sem
// necessidade de sistema de contas. O navegador (desktop e mobile) mostra o
// prompt nativo de HTTP Basic Auth e guarda a credencial depois da primeira
// vez. Usuário pode ser qualquer texto; só a senha é checada.
function unauthorized() {
  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Lista de Compras"' },
  });
}

export function proxy(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;

  // Sem senha configurada: não bloqueia (ex. ambiente de dev local), mas
  // avisa no console do servidor pra não ir parar em produção sem proteção.
  if (!appPassword) {
    console.warn(
      "APP_PASSWORD não configurada — middleware não está protegendo o app.",
    );
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorized();
  }

  const decoded = atob(authHeader.slice("Basic ".length));
  const separatorIndex = decoded.indexOf(":");
  const password = separatorIndex === -1 ? "" : decoded.slice(separatorIndex + 1);

  if (password !== appPassword) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protege tudo, exceto assets estáticos internos do Next.js.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
