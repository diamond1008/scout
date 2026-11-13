"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  keywords: string[] | null;
  seedHandles: string[] | null;
  mode: string;
  status: string;
  created_at: string;
}

interface Prospect {
  id: string;
  xUsername: string;
  xDisplayName: string | null;
  xBio: string | null;
  xLocation: string | null;
  xFollowerCount: number | null;
  xProfileImageUrl: string | null;
  fitScore: number | null;
  fitReasoning: string | null;
  evidenceSources: { type: string; quote: string; relevance: string; tweet_id?: string }[] | null;
  draftMessage: string | null;
  status: string;
  recentTweets: { tweet_id: string; text: string; created_at: string; metrics: { likes: number; retweets: number; replies: number } }[] | null;
  sentAt: string | null;
  lastError: string | null;
  replyPreview: string | null;
}

type View = "campaigns" | "discovery" | "review" | "tracker" | "settings";

export default function HomePage() {
  const [view, setView] = useState<View>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Create campaign form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newSeeds, setNewSeeds] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Settings
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>({});

  // Review state
  const [reviewIndex, setReviewIndex] = useState(0);
  const [editingDraft, setEditingDraft] = useState("");

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    setCampaigns(data);
  }, []);

  const fetchProspects = useCallback(async (campaignId: string) => {
    const res = await fetch(`/api/prospects?campaignId=${campaignId}`);
    const data = await res.json();
    setProspects(data);
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (selectedCampaign) fetchProspects(selectedCampaign.id);
  }, [selectedCampaign, fetchProspects]);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 4000);
  };

  // ── Campaign actions ────────────────────────────────────
  const createCampaign = async () => {
    setLoading(true);
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        description: newDesc,
        keywords: newKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        seedHandles: newSeeds.split(",").map((s) => s.trim()).filter(Boolean),
        mode: "sandbox",
      }),
    });
    setNewName(""); setNewDesc(""); setNewKeywords(""); setNewSeeds("");
    setShowCreate(false);
    await fetchCampaigns();
    setLoading(false);
    showMsg("Campaign created ✓");
  };

  const runDiscovery = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    showMsg("Running discovery...");
    const res = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: selectedCampaign.id }),
    });
    const data = await res.json();
    await fetchProspects(selectedCampaign.id);
    setLoading(false);
    showMsg(`Discovery: ${data.discovered} found, ${data.skipped} skipped`);
  };

  const runScoring = async () => {
    if (!selectedCampaign) return;
    const discovered = prospects.filter((p) => p.status === "DISCOVERED");
    if (discovered.length === 0) { showMsg("No discovered prospects to score"); return; }
    setLoading(true);
    showMsg("Scoring profiles with AI...");
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectIds: discovered.map((p) => p.id),
        segment: {
          keywords: selectedCampaign.keywords || [],
          description: selectedCampaign.description || "AI/robotics founders in SEA",
          fund_focus: "Pre-seed to Series A, AI-native startups in Southeast Asia",
        },
      }),
    });
    await fetchProspects(selectedCampaign.id);
    setLoading(false);
    showMsg("Scoring complete ✓");
  };

  const runDrafting = async (minScore = 0.4) => {
    if (!selectedCampaign) return;
    const scored = prospects.filter((p) => p.status === "SCORED" && (p.fitScore || 0) >= minScore);
    if (scored.length === 0) { showMsg("No scored prospects above threshold"); return; }
    setLoading(true);
    showMsg("Drafting personalised DMs...");
    await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectIds: scored.map((p) => p.id),
        segment: {
          keywords: selectedCampaign.keywords || [],
          description: selectedCampaign.description || "AI/robotics founders in SEA",
          fund_focus: "Pre-seed to Series A, AI-native startups in Southeast Asia",
        },
        sender: { fund_name: "GenAI Fund", sender_name: "GenAI Fund Team" },
      }),
    });
    await fetchProspects(selectedCampaign.id);
    setLoading(false);
    showMsg("Drafting complete ✓");
  };

  const handleApproval = async (prospectId: string, action: "approve" | "reject", editedMessage?: string) => {
    if (action === "approve" && editingDraft) {
      // Save edit first if modified
      await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, action: "edit", editedMessage: editingDraft }),
      });
    }
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId, action }),
    });
    await fetchProspects(selectedCampaign!.id);
    showMsg(action === "approve" ? "Approved ✓" : "Rejected ✗");
    // Move to next in queue
    const drafted = prospects.filter((p) => p.status === "DRAFTED");
    if (reviewIndex < drafted.length - 1) {
      setReviewIndex(reviewIndex + 1);
    }
  };

  const sendApproved = async () => {
    if (!selectedCampaign) return;
    const approvedCount = prospects.filter((p) => p.status === "APPROVED").length;
    if (approvedCount === 0) { showMsg("No approved DMs to send"); return; }
    setLoading(true);
    showMsg(`Sending ${approvedCount} DMs...`);
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: selectedCampaign.id }),
    });
    const data = await res.json();
    await fetchProspects(selectedCampaign.id);
    setLoading(false);
    showMsg(`Sent: ${data.results.filter((r: {status: string}) => r.status.startsWith("SENT")).length} / ${data.total}`);
  };

  const syncReplies = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    showMsg("Checking inbox for replies...");
    try {
      const res = await fetch("/api/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaign.id }),
      });
      const data = await res.json();
      await fetchProspects(selectedCampaign.id);
      showMsg(data.message || `Synced ${data.updated} replies`);
    } catch {
      showMsg("Failed to sync replies");
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    showMsg(`${key} saved ✓`);
  };

  // ── Computed values ─────────────────────────────────────
  const stats = {
    discovered: prospects.filter((p) => p.status === "DISCOVERED").length,
    scored: prospects.filter((p) => p.status === "SCORED").length,
    drafted: prospects.filter((p) => p.status === "DRAFTED").length,
    approved: prospects.filter((p) => p.status === "APPROVED").length,
    sent: prospects.filter((p) => ["SENT", "SENT_SANDBOX"].includes(p.status)).length,
    replied: prospects.filter((p) => p.status === "REPLIED").length,
    blocked: prospects.filter((p) => p.status === "BLOCKED_DM_CLOSED").length,
    failed: prospects.filter((p) => ["FAILED_RETRYABLE", "FAILED_PERMANENT"].includes(p.status)).length,
  };

  const draftedProspects = prospects.filter((p) => p.status === "DRAFTED");
  const currentReview = draftedProspects[reviewIndex] || null;

  const scoreColor = (score: number | null) => {
    if (!score) return "bg-gray-200";
    if (score >= 0.7) return "bg-emerald-500";
    if (score >= 0.4) return "bg-amber-500";
    return "bg-red-400";
  };

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
      DISCOVERED: "secondary", SCORED: "outline", DRAFTED: "warning",
      APPROVED: "success", REJECTED: "destructive", SENDING: "warning",
      SENT: "success", SENT_SANDBOX: "success", REPLIED: "success",
      BLOCKED_DM_CLOSED: "destructive", FAILED_RETRYABLE: "warning", FAILED_PERMANENT: "destructive",
    };
    return <Badge variant={map[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Toast message */}
      {message && (
        <div className="fixed top-16 right-6 z-50 bg-foreground text-background px-4 py-2 rounded-lg shadow-lg text-sm animate-in slide-in-from-top-2">
          {message}
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {(["campaigns", "discovery", "review", "tracker", "settings"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              view === v
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {v}
            {v === "review" && stats.drafted > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-white text-xs">
                {stats.drafted}
              </span>
            )}
            {v === "tracker" && stats.replied > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 text-white text-xs">
                {stats.replied}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          SCREEN 1: CAMPAIGNS
          ═══════════════════════════════════════════════════════ */}
      {view === "campaigns" && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Campaigns</h1>
            <Button onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? "Cancel" : "+ New Campaign"}
            </Button>
          </div>

          {showCreate && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Create Campaign</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., SEA Robotics Founders Q4" />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Target segment description..." />
                </div>
                <div>
                  <label className="text-sm font-medium">Keywords (comma-separated)</label>
                  <Input value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="embodied AI, LLM infra, robotics" />
                </div>
                <div>
                  <label className="text-sm font-medium">Seed Handles (comma-separated, optional)</label>
                  <Input value={newSeeds} onChange={(e) => setNewSeeds(e.target.value)} placeholder="@jane_robotics, @robo_builder" />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={createCampaign} disabled={!newName || loading}>Create</Button>
              </CardFooter>
            </Card>
          )}

          <div className="grid gap-4">
            {campaigns.map((c) => (
              <Card
                key={c.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${selectedCampaign?.id === c.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => { setSelectedCampaign(c); setView("discovery"); }}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{c.name}</CardTitle>
                      <CardDescription className="mt-1">{c.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={c.mode === "sandbox" ? "success" : "destructive"}>
                        {c.mode === "sandbox" ? "🟢 Sandbox" : "🔴 Live"}
                      </Badge>
                      <Badge variant="outline">{c.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {(c.keywords || []).map((kw) => (
                      <Badge key={kw} variant="secondary">{kw}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            {campaigns.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No campaigns yet. Create one to get started.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SCREEN 2: DISCOVERY & SCORING
          ═══════════════════════════════════════════════════════ */}
      {view === "discovery" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold">Discovery & Scoring</h1>
              <p className="text-sm text-muted-foreground">
                {selectedCampaign ? selectedCampaign.name : "Select a campaign first"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={runDiscovery} disabled={!selectedCampaign || loading}>
                🔍 Discover
              </Button>
              <Button variant="outline" onClick={runScoring} disabled={!selectedCampaign || loading || stats.discovered === 0}>
                🧠 Score All
              </Button>
              <Button onClick={() => runDrafting(0.4)} disabled={!selectedCampaign || loading || stats.scored === 0}>
                ✏️ Draft DMs (≥0.4)
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex gap-4 mb-4 text-sm">
            <span>📊 Discovered: <strong>{stats.discovered}</strong></span>
            <span>🧠 Scored: <strong>{stats.scored}</strong></span>
            <span>✏️ Drafted: <strong>{stats.drafted}</strong></span>
            <span>✅ Approved: <strong>{stats.approved}</strong></span>
            <span>📤 Sent: <strong>{stats.sent}</strong></span>
          </div>

          {/* Prospect table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Profile</th>
                  <th className="text-left p-3 font-medium">Location</th>
                  <th className="text-left p-3 font-medium">Followers</th>
                  <th className="text-left p-3 font-medium">Fit Score</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {prospects.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 group">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {p.xProfileImageUrl && (
                          <img
                            src={p.xProfileImageUrl}
                            alt=""
                            className="h-8 w-8 rounded-full bg-muted"
                          />
                        )}
                        <div>
                          <div className="font-medium">{p.xDisplayName || p.xUsername}</div>
                          <div className="text-muted-foreground">@{p.xUsername}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.xLocation || "—"}</td>
                    <td className="p-3">{p.xFollowerCount?.toLocaleString() || "—"}</td>
                    <td className="p-3">
                      {p.fitScore !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${scoreColor(p.fitScore)}`}
                              style={{ width: `${(p.fitScore || 0) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs">{((p.fitScore || 0) * 100).toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">{statusBadge(p.status)}</td>
                  </tr>
                ))}
                {prospects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No prospects yet. Click "Discover" to find profiles.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Expandable detail for selected prospect */}
          {prospects.filter((p) => p.fitReasoning).length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Scored Profiles — Details</h3>
              {prospects
                .filter((p) => p.fitReasoning)
                .sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0))
                .slice(0, 5)
                .map((p) => (
                  <Card key={p.id} className="text-sm">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <strong>{p.xDisplayName}</strong> <span className="text-muted-foreground">@{p.xUsername}</span>
                          <p className="text-muted-foreground mt-1">{p.xBio}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${scoreColor(p.fitScore)}`} />
                          <span className="font-mono">{((p.fitScore || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs space-y-1">
                        <p className="font-medium">Reasoning:</p>
                        {p.fitReasoning?.split("\n").map((r, i) => (
                          <p key={i} className="text-muted-foreground">• {r}</p>
                        ))}
                      </div>
                      {p.recentTweets && p.recentTweets.length > 0 && (
                        <div className="mt-2 text-xs">
                          <p className="font-medium">Recent tweets:</p>
                          {p.recentTweets.slice(0, 3).map((t, i) => (
                            <p key={i} className="text-muted-foreground truncate">💬 {t.text}</p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SCREEN 3: REVIEW & APPROVAL
          ═══════════════════════════════════════════════════════ */}
      {view === "review" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold">Review & Approve DMs</h1>
              <p className="text-sm text-muted-foreground">
                {stats.drafted} drafts awaiting review · {stats.approved} approved
              </p>
            </div>
            <Button onClick={sendApproved} disabled={stats.approved === 0 || loading}>
              📤 Send {stats.approved} Approved DMs
            </Button>
          </div>

          {currentReview ? (
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Prospect info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {currentReview.xProfileImageUrl && (
                      <img src={currentReview.xProfileImageUrl} alt="" className="h-12 w-12 rounded-full bg-muted" />
                    )}
                    <div>
                      <CardTitle className="text-base">{currentReview.xDisplayName}</CardTitle>
                      <CardDescription>@{currentReview.xUsername} · {currentReview.xLocation}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium mb-1">Bio</p>
                    <p className="text-muted-foreground">{currentReview.xBio}</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Fit Score</p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreColor(currentReview.fitScore)}`}
                          style={{ width: `${(currentReview.fitScore || 0) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono">{((currentReview.fitScore || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  {currentReview.fitReasoning && (
                    <div>
                      <p className="font-medium mb-1">Why they fit</p>
                      {currentReview.fitReasoning.split("\n").map((r, i) => (
                        <p key={i} className="text-muted-foreground text-xs">• {r}</p>
                      ))}
                    </div>
                  )}
                  {currentReview.recentTweets && currentReview.recentTweets.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Recent Tweets</p>
                      {currentReview.recentTweets.slice(0, 3).map((t, i) => (
                        <div key={i} className="mb-2 p-2 rounded bg-muted/50 text-xs">
                          <p>{t.text}</p>
                          <p className="text-muted-foreground mt-1">
                            ❤️ {t.metrics.likes} · 🔁 {t.metrics.retweets} · 💬 {t.metrics.replies}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {currentReview.evidenceSources && (
                    <div>
                      <p className="font-medium mb-1">Evidence Citations</p>
                      {currentReview.evidenceSources.map((e, i) => (
                        <div key={i} className="text-xs p-2 rounded bg-amber-50 border border-amber-200 mb-1">
                          <span className="font-medium">[{e.type}]</span> &ldquo;{e.quote}&rdquo;
                          <p className="text-muted-foreground mt-0.5">{e.relevance}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Right: Draft editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Draft Message</CardTitle>
                  <CardDescription>
                    Review, edit, then approve or reject. ({reviewIndex + 1}/{draftedProspects.length})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    className="min-h-[200px] text-sm"
                    value={editingDraft || currentReview.draftMessage || ""}
                    onChange={(e) => setEditingDraft(e.target.value)}
                    onFocus={() => {
                      if (!editingDraft) setEditingDraft(currentReview.draftMessage || "");
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {(editingDraft || currentReview.draftMessage || "").length} characters
                    {currentReview.draftMessage?.startsWith("[NEEDS REVIEW]") && (
                      <span className="text-amber-600 ml-2">⚠️ Guardrail flagged — please review carefully</span>
                    )}
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    variant="default"
                    onClick={() => { handleApproval(currentReview.id, "approve"); setEditingDraft(""); }}
                  >
                    ✅ Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => { handleApproval(currentReview.id, "reject"); setEditingDraft(""); }}
                  >
                    ❌ Reject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingDraft("");
                      setReviewIndex(Math.min(reviewIndex + 1, draftedProspects.length - 1));
                    }}
                  >
                    ⏭️ Skip
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {stats.approved > 0
                ? `No more drafts to review. ${stats.approved} approved — ready to send.`
                : "No drafted DMs to review. Run scoring and drafting first."}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SCREEN 4: OUTREACH TRACKER
          ═══════════════════════════════════════════════════════ */}
      {view === "tracker" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold">Outreach Tracker & Inbox</h1>
              <p className="text-sm text-muted-foreground">
                Track sent conversations, responses, and blocked messages
              </p>
            </div>
            <Button
              variant="outline"
              onClick={syncReplies}
              disabled={!selectedCampaign || loading}
            >
              🔄 Check Replies & Sync Inbox
            </Button>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mb-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              Sent: <strong>{stats.sent}</strong>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              Replied: <strong>{stats.replied}</strong>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              Blocked: <strong>{stats.blocked}</strong>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              Failed: <strong>{stats.failed}</strong>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              Pending: <strong>{stats.approved}</strong>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Profile</th>
                  <th className="text-left p-3 font-medium">DM Preview</th>
                  <th className="text-left p-3 font-medium">Sent</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Reply</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {prospects
                  .filter((p) =>
                    ["SENT", "SENT_SANDBOX", "REPLIED", "BLOCKED_DM_CLOSED", "FAILED_RETRYABLE", "FAILED_PERMANENT", "SENDING", "APPROVED"].includes(p.status)
                  )
                  .map((p) => (
                    <tr key={p.id} className={`hover:bg-muted/30 ${p.status === "REPLIED" ? "bg-emerald-50/50" : ""}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">{p.xDisplayName}</div>
                            <div className="text-muted-foreground text-xs">@{p.xUsername}</div>
                          </div>
                          {p.status === "REPLIED" && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-semibold">
                              🔔 New Reply
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 max-w-xs truncate text-muted-foreground">
                        {p.draftMessage?.slice(0, 80)}...
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {p.sentAt ? new Date(p.sentAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-3">{statusBadge(p.status)}</td>
                      <td className="p-3 text-xs">
                        {p.replyPreview ? (
                          <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-950 font-medium max-w-md">
                            💬 &ldquo;{p.replyPreview}&rdquo;
                          </div>
                        ) : p.lastError ? (
                          <span className="text-red-500">{p.lastError}</span>
                        ) : (
                          <span className="text-muted-foreground">Awaiting reply...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                {prospects.filter((p) =>
                  ["SENT", "SENT_SANDBOX", "REPLIED", "BLOCKED_DM_CLOSED", "FAILED_RETRYABLE", "FAILED_PERMANENT", "SENDING", "APPROVED"].includes(p.status)
                ).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No outreach activity yet. Approve and send DMs first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SETTINGS
          ═══════════════════════════════════════════════════════ */}
      {view === "settings" && (
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold mb-6">Settings</h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">X API Configuration</CardTitle>
              <CardDescription>Bring Your Own Keys — required for Live mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "x_bearer_token", label: "Bearer Token", placeholder: "AAAAAAAAAAAAAAAAAAAAAxxxxxxxxxx" },
                { key: "x_access_token", label: "OAuth 2.0 Access Token", placeholder: "User access token for DM sending" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium">{label}</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="password"
                      placeholder={placeholder}
                      value={settingsValues[key] || ""}
                      onChange={(e) => setSettingsValues({ ...settingsValues, [key]: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveSetting(key, settingsValues[key] || "")}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">LLM Provider</CardTitle>
              <CardDescription>Configure which AI model scores profiles and drafts DMs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Provider</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
                  value={settingsValues.llm_provider || "gemini"}
                  onChange={(e) => {
                    setSettingsValues({ ...settingsValues, llm_provider: e.target.value });
                    saveSetting("llm_provider", e.target.value);
                  }}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              {[
                { key: "google_api_key", label: "Gemini API Key", placeholder: "AIza..." },
                { key: "openai_api_key", label: "OpenAI API Key", placeholder: "sk-..." },
                { key: "anthropic_api_key", label: "Anthropic API Key", placeholder: "sk-ant-..." },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium">{label}</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="password"
                      placeholder={placeholder}
                      value={settingsValues[key] || ""}
                      onChange={(e) => setSettingsValues({ ...settingsValues, [key]: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveSetting(key, settingsValues[key] || "")}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">About</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Scout</strong> — AI-powered founder discovery & outreach for GenAI Fund</p>
              <p>Mode: <Badge variant="success">🟢 Sandbox</Badge> (safe testing, no real DMs sent)</p>
              <p>Built with Next.js, Drizzle ORM, SQLite, Vercel AI SDK</p>
              <p className="text-xs mt-4">
                ⚠️ Sandbox mode uses curated seed data. Switch to Live mode in campaign settings 
                to use real X API v2 (pay-per-use). Estimated cost per campaign: ~$8.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-40">
          <div className="bg-background border rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
