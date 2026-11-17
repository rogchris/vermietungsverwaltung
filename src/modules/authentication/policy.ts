type SessionAccess = {
  user: { twoFactorEnabled?: boolean | null; role?: string | null };
  session: { mfaVerified?: boolean };
};

export function allowsAccess(session: SessionAccess | null, adminOnly = false) {
  return Boolean(session?.user.twoFactorEnabled && session.session.mfaVerified &&
    (session.user.role === "ADMIN" || (!adminOnly && session.user.role === "VIEWER")));
}
