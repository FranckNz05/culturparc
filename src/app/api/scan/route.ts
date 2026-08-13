import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/auth";
import { scanTicket } from "@/lib/scan";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().min(1).max(500),
  showtimeId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await requireRole("STAFF");

  if (!session) {
    return NextResponse.json(
      { error: "Acces reserve au personnel." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Code manquant." }, { status: 400 });
  }

  const outcome = await scanTicket({
    code: parsed.data.code,
    scannedById: session.user.id,
    expectedShowtimeId: parsed.data.showtimeId,
    device: request.headers.get("user-agent")?.slice(0, 120) ?? undefined,
  });

  return NextResponse.json(outcome);
}
