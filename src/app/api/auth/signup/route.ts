import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/auth/validation";
import { hashPassword } from "@/lib/auth/passwords";
import { getDb, schema } from "@/lib/db";

// Drizzle wraps driver errors (the PostgresError ends up on `cause`), so
// walk the cause chain looking for Postgres' unique_violation code.
function isUniqueViolation(err: unknown): boolean {
  for (let e = err, depth = 0; e && depth < 5; depth++) {
    if (typeof e === "object" && (e as { code?: unknown }).code === "23505") {
      return true;
    }
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email, password, displayName } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const db = getDb();
    const [user] = await db
      .insert(schema.users)
      .values({ email, passwordHash, displayName })
      .returning({ id: schema.users.id, email: schema.users.email });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    console.error("signup failed:", err);
    return NextResponse.json(
      { error: "Could not create account" },
      { status: 500 }
    );
  }
}
