import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { upsertSetting } from "@/lib/db/settings-helper";

const X_TOKEN_KEYS = new Set(["x_bearer_token", "x_access_token"]);

export async function GET() {
  const db = getDb();
  const allSettings = await db.select().from(settings).all();

  // Mask sensitive values for display
  const masked = (allSettings as { key: string; value: string; updatedAt: string }[]).map((s) => ({
    key: s.key,
    value:
      s.key.includes("key") || s.key.includes("token") || s.key.includes("secret")
        ? s.value
          ? `****${s.value.slice(-4)}`
          : ""
        : s.value,
    hasValue: !!s.value,
    updatedAt: s.updatedAt,
  }));

  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, value } = body as { key: string; value: string };

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  if (key === "x_live_verified") {
    return NextResponse.json(
      { error: "x_live_verified is managed automatically by API Health Diagnostics" },
      { status: 400 }
    );
  }

  await upsertSetting(key, value);

  // Any edit to X credentials invalidates prior Live verification until re-tested
  if (X_TOKEN_KEYS.has(key)) {
    await upsertSetting("x_live_verified", "");
  }

  return NextResponse.json({ success: true });
}
