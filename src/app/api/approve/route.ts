import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { prospects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { transitionStatus } from "@/lib/state-machine";
import type { ProspectStatus } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { prospectId, action, editedMessage } = body as {
    prospectId: string;
    action: "approve" | "reject" | "edit";
    editedMessage?: string;
  };

  if (!prospectId || !action) {
    return NextResponse.json({ error: "Missing prospectId or action" }, { status: 400 });
  }

  const prospect = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .get();

  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  }

  try {
    switch (action) {
      case "approve": {
        transitionStatus(prospect.status as ProspectStatus, "APPROVED");
        await db
          .update(prospects)
          .set({ status: "APPROVED", updatedAt: new Date().toISOString() })
          .where(eq(prospects.id, prospectId))
          .run();
        break;
      }
      case "reject": {
        transitionStatus(prospect.status as ProspectStatus, "REJECTED");
        await db
          .update(prospects)
          .set({ status: "REJECTED", updatedAt: new Date().toISOString() })
          .where(eq(prospects.id, prospectId))
          .run();
        break;
      }
      case "edit": {
        if (!editedMessage || !editedMessage.trim()) {
          return NextResponse.json({ error: "Draft message cannot be empty" }, { status: 400 });
        }
        if (editedMessage.length > 500) {
          return NextResponse.json({ error: `Draft exceeds 500 character limit (${editedMessage.length} chars)` }, { status: 400 });
        }
        // Edit stays in DRAFTED state
        await db
          .update(prospects)
          .set({
            draftMessage: editedMessage.trim(),
            draftEditedBy: "human",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(prospects.id, prospectId))
          .run();
        break;
      }
    }

    const updated = await db
      .select()
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .get();

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
