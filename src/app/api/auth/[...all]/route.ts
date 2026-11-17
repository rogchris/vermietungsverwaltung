import { allowsAccess } from "@/modules/authentication/policy";
import { getAuth } from "@/modules/authentication/auth";
import { privateHeaders, problem } from "@/lib/http";

const endpoints = {
  GET: new Set(["/get-session"]),
  POST: new Set([
    "/sign-in/email", "/sign-out", "/two-factor/enable",
    "/two-factor/verify-totp", "/two-factor/verify-backup-code",
    "/change-password", "/revoke-other-sessions", "/two-factor/generate-backup-codes",
  ]),
};
const accountActions = new Set(["/change-password", "/revoke-other-sessions", "/two-factor/generate-backup-codes"]);

async function handle(request: Request, method: keyof typeof endpoints) {
  const path = new URL(request.url).pathname.slice("/api/auth".length);
  if (!endpoints[method].has(path)) return problem(404, "NOT_FOUND");

  const auth = getAuth();
  if (accountActions.has(path)) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!allowsAccess(session)) return problem(session ? 403 : 401, "ACCESS_DENIED");
  }
  if (path === "/two-factor/enable") {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.twoFactorEnabled) return problem(session ? 403 : 401, "ACCESS_DENIED");
  }

  const response = await auth.handler(request);
  response.headers.set("Cache-Control", privateHeaders["Cache-Control"]);
  return response;
}

export function GET(request: Request) {
  return handle(request, "GET");
}

export function POST(request: Request) {
  return handle(request, "POST");
}
