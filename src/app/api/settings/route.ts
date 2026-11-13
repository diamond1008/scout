import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const allSettings = await db.select().from(settings).all();

  // Mask sensitive values for display
  const masked = (allSettings as any[]).map((s) => ({
    key: s.key,
    value: s.key.includes("key") || s.key.includes("token") || s.key.includes("secret")
      ? s.value ? `****${s.value.slice(-4)}` : ""
      : s.value,
    hasValue: !!s.value,
    updatedAt: s.updatedAt,
  }));

  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { key, value } = body as { key: string; value: string };

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  // Upsert setting
  const existing = await db.select().from(settings).where(eq(settings.key, key)).get();

  if (existing) {
    await db
      .update(settings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(settings.key, key))
      .run();
  } else {
    await db
      .insert(settings)
      .values({ key, value, updatedAt: new Date().toISOString() })
      .run();
  }

  return NextResponse.json({ success: true });
}
