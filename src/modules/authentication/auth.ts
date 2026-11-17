import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { twoFactor } from "better-auth/plugins/two-factor";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { mfaVerificationPaths, newPasswordSchema } from "./validation";

const authEnv = z.object({
  BETTER_AUTH_URL: z.url().refine((value) => {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || localHttp) && url.href === url.origin + "/";
  }),
  BETTER_AUTH_SECRET: z.string().min(32),
});

const sessionLifetimeSeconds = 8 * 60 * 60;

function createAuth() {
  const env = authEnv.parse(process.env);
  const db = getDb();
  const proxyHeader = process.env.AUTH_CLIENT_IP_HEADER;
  return betterAuth({
    appName: "Vermietungsverwaltung",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 14,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        role: { type: ["ADMIN", "VIEWER"], defaultValue: "VIEWER", input: false },
      },
    },
    session: {
      expiresIn: sessionLifetimeSeconds,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
      additionalFields: {
        mfaVerified: { type: "boolean", defaultValue: false, input: false },
      },
    },
    advanced: {
      useSecureCookies: new URL(env.BETTER_AUTH_URL).protocol === "https:",
      ipAddress: { ipAddressHeaders: proxyHeader ? [proxyHeader] : [] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/two-factor/verify-totp": { window: 60, max: 8 },
        "/two-factor/verify-backup-code": { window: 60, max: 8 },
        "/two-factor/enable": { window: 60, max: 6 },
        "/change-password": { window: 60, max: 6 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (mfaVerificationPaths.has(ctx.path) && (ctx.body?.trustDevice || ctx.body?.disableSession)) {
          throw new APIError("BAD_REQUEST");
        }
        if (ctx.path === "/change-password" &&
            (!newPasswordSchema.safeParse(ctx.body?.newPassword).success || ctx.body?.revokeOtherSessions !== true)) {
          throw new APIError("BAD_REQUEST");
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const current = ctx.context.session;
        const returned = ctx.context.returned;
        if (returned instanceof APIError || returned instanceof Response && !returned.ok) return;

        const actions: Record<string, string> = {
          "/change-password": "auth.password_changed",
          "/revoke-other-sessions": "auth.sessions_revoked",
          "/two-factor/generate-backup-codes": "auth.recovery_codes_rotated",
        };
        const action = actions[ctx.path];
        if (action && current) {
          await db.auditEvent.create({ data: { actorId: current.user.id, action } });
        }
      }),
    },
    databaseHooks: {
      session: {
        delete: {
          after: async (session, ctx) => {
            if (ctx?.path === "/sign-out") {
              await db.auditEvent.create({ data: { actorId: session.userId, action: "auth.signed_out" } });
            }
          },
        },
        create: {
          before: async (session, ctx) => ({
            data: { ...session, expiresAt: new Date(Date.now() + sessionLifetimeSeconds * 1000), mfaVerified: mfaVerificationPaths.has(ctx?.path ?? "") },
          }),
          after: async (session) => {
            if (session.mfaVerified) {
              await db.auditEvent.create({ data: { actorId: session.userId, action: "auth.mfa_verified" } });
            }
          },
        },
      },
    },
    plugins: [twoFactor({ backupCodeOptions: { storeBackupCodes: "encrypted" } })],
    logger: { disabled: true },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return auth ??= createAuth();
}
