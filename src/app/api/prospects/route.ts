import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { prospects, campaigns } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");

  if (!campaignId) {
    return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  }

  let query = db
    .select()
    .from(prospects)
    .where(eq(prospects.campaignId, campaignId));

  const allProspects = await query.all();

  // Filter by status if provided
  const filtered = status
    ? (allProspects as any[]).filter((p) => p.status === status)
    : allProspects;

  return NextResponse.json(filtered);
}
