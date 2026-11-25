import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getLiveXStatus, getSettingsMap } from "@/lib/db/settings-helper";

async function checkLiveGateError(): Promise<string | null> {
  const settingsMap = await getSettingsMap();
  const status = getLiveXStatus(settingsMap);
  return status.liveVerified ? null : status.gateReason;
}

export async function GET() {
  const db = getDb();
  const allCampaigns = await db.select().from(campaigns).all();
  return NextResponse.json(allCampaigns);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const targetMode = body.mode || "sandbox";

  if (targetMode === "live") {
    const gateError = await checkLiveGateError();
    if (gateError) {
      return NextResponse.json({ error: gateError }, { status: 400 });
    }
  }

  const newCampaign = await db
    .insert(campaigns)
    .values({
      name: body.name,
      description: body.description || null,
      keywords: body.keywords || [],
      seedHandles: body.seedHandles || [],
      mode: targetMode,
      status: "active",
    })
    .returning()
    .get();

  return NextResponse.json(newCampaign, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = await req.json();
  if (body.mode === "live") {
    const gateError = await checkLiveGateError();
    if (gateError) {
      return NextResponse.json({ error: gateError }, { status: 400 });
    }
  }

  const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
  if (body.mode) updates.mode = body.mode;
  if (body.status) updates.status = body.status;
  if (body.name) updates.name = body.name;

  await db.update(campaigns).set(updates).where(eq(campaigns.id, id)).run();
  const updated = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db.delete(campaigns).where(eq(campaigns.id, id)).run();
  return NextResponse.json({ success: true });
}
