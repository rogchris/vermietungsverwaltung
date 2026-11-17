export const privateHeaders = { "Cache-Control": "private, no-store" };

export function problem(status: number, code: string) {
  return Response.json({ error: code }, { status, headers: privateHeaders });
}
