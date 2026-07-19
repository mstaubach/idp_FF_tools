import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { profileSchema } from "@/lib/auth/validation";
import { getDb, schema } from "@/lib/db";

/** Read the signed-in user's stored Sleeper profile. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const db = getDb();
  const [row] = await db
    .select({ profile: schema.users.profile })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json({ profile: row.profile ?? null });
}

/** Replace the signed-in user's stored Sleeper profile. */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid profile" },
      { status: 400 }
    );
  }

  const db = getDb();
  const [row] = await db
    .update(schema.users)
    .set({ profile: parsed.data, updatedAt: new Date() })
    .where(eq(schema.users.id, session.user.id))
    .returning({ profile: schema.users.profile });
  if (!row) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json({ profile: row.profile });
}
