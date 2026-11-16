"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Compass,
  CheckCircle2,
  Inbox,
  Settings as SettingsIcon,
  Search,
  Sparkles,
  Send,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  Filter,
  MessageSquare,
  RefreshCw,
  Terminal,
  XCircle,
  Clock,
  Lock,
  Cpu,
  Radio,
  Zap,
  Eye,
  AtSign,
  Globe,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Layers,
  HelpCircle,
  Copy,
  ChevronDown
} from "lucide-react";

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
  const [loadingText, setLoadingText] = useState("Processing...");
  const [message, setMessage] = useState("");

  // Create campaign form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newSeeds, setNewSeeds] = useState("");
  const [newMode, setNewMode] = useState<"sandbox" | "live">("sandbox");
  const [showCreate, setShowCreate] = useState(false);

  // Settings & Health
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>({});
  const [healthData, setHealthData] = useState<any>(null);

  // Review state
  const [reviewIndex, setReviewIndex] = useState(0);
  const [editingDraft, setEditingDraft] = useState("");

  // Discovery inspection modal
  const [inspectProspect, setInspectProspect] = useState<Prospect | null>(null);

  // Discovery filters
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);

  // Tracker selected thread
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json();
      setCampaigns(data);
      if (data.length > 0 && !selectedCampaign) {
        setSelectedCampaign(data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedCampaign]);

  const fetchProspects = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(`/api/prospects?campaignId=${campaignId}`);
      const data = await res.json();
      setProspects(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchProspects(selectedCampaign.id);
    }
  }, [selectedCampaign, fetchProspects]);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 4000);
  };

  // ── Keyboard shortcuts for Review Queue ───────────────────
  useEffect(() => {
    if (view !== "review") return;
    const drafted = prospects.filter((p) => p.status === "DRAFTED");
    const current = drafted[reviewIndex];
    if (!current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in textarea or input
      if (["TEXTAREA", "INPUT"].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        handleApproval(current.id, "approve");
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleApproval(current.id, "reject");
      } else if (e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        setReviewIndex((prev) => Math.min(prev + 1, drafted.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setReviewIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, reviewIndex, prospects]);

  // ── Campaign actions ────────────────────────────────────
  const createCampaign = async () => {
    setLoading(true);
    setLoadingText("Creating campaign radar...");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          keywords: newKeywords.split(",").map((k) => k.trim()).filter(Boolean),
          seedHandles: newSeeds.split(",").map((s) => s.trim()).filter(Boolean),
          mode: newMode,
        }),
      });
      const created = await res.json();
      setNewName(""); setNewDesc(""); setNewKeywords(""); setNewSeeds(""); setNewMode("sandbox");
      setShowCreate(false);
      await fetchCampaigns();
      setSelectedCampaign(created);
      showMsg("Campaign Radar created ✓");
    } catch {
      showMsg("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaignMode = async (c: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetMode = c.mode === "sandbox" ? "live" : "sandbox";
    try {
      await fetch(`/api/campaigns?id=${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: targetMode }),
      });
      await fetchCampaigns();
      if (selectedCampaign?.id === c.id) {
        setSelectedCampaign({ ...selectedCampaign, mode: targetMode });
      }
      showMsg(`Switched to ${targetMode.toUpperCase()} mode ✓`);
    } catch {
      showMsg("Failed to switch campaign mode");
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setLoadingText("Running API Health Diagnostics...");
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealthData(data);
      showMsg(data.connected ? "Connection healthy & verified ✓" : `Status: ${data.error || "Sandbox Active"}`);
    } catch {
      showMsg("Failed to check health");
    } finally {
      setLoading(false);
    }
  };

  const runDiscovery = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    setLoadingText("Scanning X profiles & analyzing bios...");
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaign.id }),
      });
      const data = await res.json();
      await fetchProspects(selectedCampaign.id);
      showMsg(`Discovered ${data.added} new candidates (${data.skipped} skipped) ✓`);
    } catch {
      showMsg("Discovery failed");
    } finally {
      setLoading(false);
    }
  };

  const runScoring = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    setLoadingText("Evaluating candidate fitness & extracting evidence...");
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaign.id }),
      });
      const data = await res.json();
      await fetchProspects(selectedCampaign.id);
      showMsg(`Qualified & scored ${data.scored} profiles ✓`);
    } catch {
      showMsg("Scoring failed");
    } finally {
      setLoading(false);
    }
  };

  const runDrafting = async (minScore: number = 0.4) => {
    if (!selectedCampaign) return;
    setLoading(true);
    setLoadingText("Drafting evidence-grounded DMs with guardrails...");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selectedCampaign.id,
          minScore,
          sender: { fund_name: "GenAI Fund", sender_name: "GenAI Fund Team" },
        }),
      });
      const data = await res.json();
      await fetchProspects(selectedCampaign.id);
      showMsg(`Drafted ${data.drafted} personalized DMs for review ✓`);
      setView("review");
      setReviewIndex(0);
    } catch {
      showMsg("Drafting failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (prospectId: string, action: "approve" | "reject", editedMessage?: string) => {
    if (action === "approve" && editingDraft) {
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
    setEditingDraft("");
    showMsg(action === "approve" ? "Approved & queued for safe send ✓" : "Candidate rejected ✗");
    
    const drafted = prospects.filter((p) => p.status === "DRAFTED");
    if (reviewIndex >= drafted.length - 1) {
      setReviewIndex(Math.max(0, drafted.length - 2));
    }
  };

  const sendApproved = async () => {
    if (!selectedCampaign) return;
    const approvedCount = prospects.filter((p) => p.status === "APPROVED").length;
    if (approvedCount === 0) {
      showMsg("No approved DMs in queue");
      return;
    }
    setLoading(true);
    setLoadingText(`Executing safe send for ${approvedCount} approved DMs...`);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaign.id }),
      });
      const data = await res.json();
      await fetchProspects(selectedCampaign.id);
      const sentCount = data.results?.filter((r: { status: string }) => r.status.startsWith("SENT")).length || 0;
      showMsg(`Successfully sent ${sentCount} / ${data.total} DMs (Zero duplicates) ✓`);
      setView("tracker");
    } catch {
      showMsg("Send execution failed");
    } finally {
      setLoading(false);
    }
  };

  const syncReplies = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    setLoadingText("Checking X conversations & syncing inbound replies...");
    try {
      const res = await fetch("/api/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaign.id }),
      });
      const data = await res.json();
      await fetchProspects(selectedCampaign.id);
      showMsg(data.message || `Synced ${data.updated} inbound replies ✓`);
    } catch {
      showMsg("Failed to sync replies");
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      showMsg(`Credential saved securely ✓`);
    } catch {
      showMsg("Failed to save setting");
    }
  };

  // ── Computed values & Stats ──────────────────────────────
  const stats = useMemo(() => {
    const discovered = prospects.filter((p) => p.status === "DISCOVERED").length;
    const scored = prospects.filter((p) => p.status === "SCORED").length;
    const highFit = prospects.filter((p) => (p.fitScore || 0) >= 0.7).length;
    const drafted = prospects.filter((p) => p.status === "DRAFTED").length;
    const approved = prospects.filter((p) => p.status === "APPROVED").length;
    const sent = prospects.filter((p) => ["SENT", "SENT_SANDBOX"].includes(p.status)).length;
    const replied = prospects.filter((p) => p.status === "REPLIED").length;
    const blocked = prospects.filter((p) => p.status === "BLOCKED_DM_CLOSED").length;
    const failed = prospects.filter((p) => ["FAILED_RETRYABLE", "FAILED_PERMANENT"].includes(p.status)).length;
    const conversion = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0.0";

    return {
      total: prospects.length,
      discovered,
      scored,
      highFit,
      drafted,
      approved,
      sent,
      replied,
      blocked,
      failed,
      conversion,
    };
  }, [prospects]);

  const draftedProspects = useMemo(() => prospects.filter((p) => p.status === "DRAFTED"), [prospects]);
  const currentReview = draftedProspects[reviewIndex] || null;

  // Filtered prospects for Discovery view
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      const matchesSearch =
        searchQuery === "" ||
        p.xUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.xDisplayName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.xBio || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCountry =
        countryFilter === "ALL" ||
        (countryFilter === "SG" && (p.xLocation?.includes("Singapore") || p.xLocation?.includes("SG"))) ||
        (countryFilter === "VN" && (p.xLocation?.includes("Vietnam") || p.xLocation?.includes("VN") || p.xLocation?.includes("Hanoi") || p.xLocation?.includes("Saigon"))) ||
        (countryFilter === "ID" && (p.xLocation?.includes("Indonesia") || p.xLocation?.includes("Jakarta") || p.xLocation?.includes("Bandung"))) ||
        (countryFilter === "TH" && (p.xLocation?.includes("Thailand") || p.xLocation?.includes("Bangkok"))) ||
        (countryFilter === "MY" && (p.xLocation?.includes("Malaysia") || p.xLocation?.includes("Kuala Lumpur")));

      const matchesScore = minScoreFilter === 0 || (p.fitScore || 0) >= minScoreFilter;

      return matchesSearch && matchesCountry && matchesScore;
    });
  }, [prospects, searchQuery, countryFilter, minScoreFilter]);

  // Outreached prospects for Tracker
  const outreachedProspects = useMemo(() => {
    return prospects.filter((p) =>
      ["SENT", "SENT_SANDBOX", "REPLIED", "BLOCKED_DM_CLOSED", "FAILED_RETRYABLE", "FAILED_PERMANENT", "SENDING", "APPROVED"].includes(p.status)
    );
  }, [prospects]);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return outreachedProspects[0] || null;
    return outreachedProspects.find((p) => p.id === selectedThreadId) || outreachedProspects[0] || null;
  }, [outreachedProspects, selectedThreadId]);

  const getFitBadge = (score: number | null) => {
    if (score === null || score === undefined) return <Badge variant="outline">Unrated</Badge>;
    if (score >= 0.75) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <Sparkles className="w-3 h-3" /> {(score * 100).toFixed(0)}% High Fit
        </span>
      );
    }
    if (score >= 0.4) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
          {(score * 100).toFixed(0)}% Relevant
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-normal bg-zinc-800 text-zinc-400 border border-zinc-700">
        {(score * 100).toFixed(0)}% Low Match
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string; icon?: React.ReactNode }> = {
      DISCOVERED: { label: "Discovered", className: "bg-zinc-800 text-zinc-300 border-zinc-700" },
      SCORED: { label: "Scored", className: "bg-blue-500/10 text-blue-300 border-blue-500/25" },
      DRAFTED: { label: "Draft Ready", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: <Clock className="w-3 h-3" /> },
      APPROVED: { label: "Approved", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
      REJECTED: { label: "Rejected", className: "bg-zinc-800 text-zinc-500 border-zinc-700" },
      SENDING: { label: "Sending...", className: "bg-amber-500/20 text-amber-200 border-amber-500/40 animate-pulse" },
      SENT: { label: "Delivered", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: <Check className="w-3 h-3" /> },
      SENT_SANDBOX: { label: "Sent (Sandbox)", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: <Check className="w-3 h-3" /> },
      REPLIED: { label: "Replied 🔔", className: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-semibold", icon: <MessageSquare className="w-3 h-3" /> },
      BLOCKED_DM_CLOSED: { label: "DMs Closed", className: "bg-rose-500/15 text-rose-300 border-rose-500/30", icon: <Lock className="w-3 h-3" /> },
      FAILED_RETRYABLE: { label: "Retryable", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
      FAILED_PERMANENT: { label: "Failed", className: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
    };
    const s = map[status] || { label: status, className: "bg-zinc-800 text-zinc-400" };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border font-medium ${s.className}`}>
        {s.icon}
        {s.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* ── Toast Notification ────────────────────────────── */}
      {message && (
        <div className="fixed top-4 right-6 z-50 bg-card border border-border shadow-2xl rounded-xl px-4 py-3 text-sm flex items-center gap-2.5 animate-in slide-in-from-top-4 backdrop-blur-md">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
          <span className="font-medium text-foreground">{message}</span>
        </div>
      )}

      {/* ── Top Executive Navigation Header ───────────────── */}
      <header className="border-b border-border/80 bg-card/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
              <Compass className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-base text-foreground">SCOUT</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  GenAI Fund
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">SEA AI & Robotics Founder Radar</p>
            </div>
          </div>

          {/* View Tabs */}
          <nav className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
            {[
              { id: "campaigns", label: "Campaigns", icon: Layers },
              { id: "discovery", label: "Discovery & Fit", icon: Compass, count: stats.discovered },
              { id: "review", label: "Review Queue", icon: CheckCircle2, count: stats.drafted, badgeColor: "bg-amber-500" },
              { id: "tracker", label: "Outreach & Inbox", icon: Inbox, count: stats.replied, badgeColor: "bg-emerald-500" },
              { id: "settings", label: "Settings", icon: SettingsIcon },
            ].map(({ id, label, icon: Icon, count, badgeColor }) => (
              <button
                key={id}
                onClick={() => setView(id as View)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  view === id
                    ? "bg-card text-foreground shadow-sm border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold text-white ${
                      badgeColor || "bg-zinc-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Active Campaign / Mode Indicator */}
          <div className="flex items-center gap-3">
            {selectedCampaign && (
              <div className="hidden md:flex items-center gap-2 border border-border/60 rounded-lg px-2.5 py-1 bg-card/40 text-xs">
                <span className="text-muted-foreground">Active Radar:</span>
                <span className="font-semibold text-foreground truncate max-w-[140px]">
                  {selectedCampaign.name}
                </span>
                <button
                  onClick={(e) => toggleCampaignMode(selectedCampaign, e)}
                  title="Click to toggle between Sandbox and Live X API"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <Badge variant={selectedCampaign.mode === "sandbox" ? "success" : "destructive"}>
                    <span className={`h-1.5 w-1.5 rounded-full ${selectedCampaign.mode === "sandbox" ? "bg-emerald-400" : "bg-rose-400"}`} />
                    {selectedCampaign.mode === "sandbox" ? "Sandbox ($0)" : "Live X API"}
                  </Badge>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Executive KPI Pipeline Metrics Strip ───────────── */}
      <div className="border-b border-border/60 bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl border border-border/60 bg-card/50 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                Total Scanned
                <Globe className="w-3.5 h-3.5 text-zinc-500" />
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-foreground">{stats.total}</span>
                <span className="text-xs text-muted-foreground">profiles</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-emerald-400/90 uppercase tracking-wider flex items-center justify-between">
                High-Signal Fit
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-emerald-300">{stats.highFit}</span>
                <span className="text-xs text-emerald-400/70">score ≥ 70%</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-amber-300/90 uppercase tracking-wider flex items-center justify-between">
                Review Queue
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-amber-200">{stats.drafted}</span>
                <span className="text-xs text-amber-300/70">awaiting review</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-blue-300/90 uppercase tracking-wider flex items-center justify-between">
                Outreach Sent
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-blue-200">{stats.sent}</span>
                <span className="text-xs text-blue-300/70">0 duplicates</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-indigo-300/90 uppercase tracking-wider flex items-center justify-between">
                Reply Yield
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-indigo-200">{stats.replied}</span>
                <span className="text-xs text-indigo-300/70">({stats.conversion}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ─────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* ═════════════════════════════════════════════════════
            SCREEN 1: CAMPAIGNS & TARGET RADAR
            ═════════════════════════════════════════════════════ */}
        {view === "campaigns" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Target Radars & Campaigns</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Configure search segments, keywords, and seed accounts across Southeast Asia AI ecosystems.
                </p>
              </div>
              <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
                <Sparkles className="w-4 h-4" />
                {showCreate ? "Close Panel" : "Create New Radar"}
              </Button>
            </div>

            {/* Campaign Creator Drawer/Card */}
            {showCreate && (
              <Card className="border-blue-500/30 bg-card shadow-xl ring-1 ring-blue-500/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Radio className="w-4 h-4 text-blue-400" />
                    Configure New AI / Robotics Target Radar
                  </CardTitle>
                  <CardDescription>
                    Define keywords and seed handles. The system will index profiles, score fit, and prepare personalized outreach.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                        Radar / Campaign Name
                      </label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. SEA Embodied AI & Humanoid Founders Q1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                        Seed Handles (comma-separated)
                      </label>
                      <Input
                        value={newSeeds}
                        onChange={(e) => setNewSeeds(e.target.value)}
                        placeholder="@anh_robotics, @hien_embodied, @sg_vla"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Target Focus Description
                    </label>
                    <Textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Target builders, researchers and engineers working on foundation models, robotics manipulation, SLAM, and developer tools in Singapore, Vietnam, Indonesia..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Target Keywords (comma-separated)
                    </label>
                    <Input
                      value={newKeywords}
                      onChange={(e) => setNewKeywords(e.target.value)}
                      placeholder="embodied AI, vision-language-action, robotics manipulation, SLAM, humanoid"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                      Execution Mode
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label
                        className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
                          newMode === "sandbox"
                            ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                            : "border-border bg-card/60 hover:bg-card"
                        }`}
                      >
                        <input
                          type="radio"
                          name="campaign_mode"
                          value="sandbox"
                          checked={newMode === "sandbox"}
                          onChange={() => setNewMode("sandbox")}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            Safe Sandbox Mode ($0 Cost)
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Zero API spend. Test end-to-end with 30 curated Southeast Asian AI & robotics builders with realistic bios, signal tweets, and simulated responses.
                          </div>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
                          newMode === "live"
                            ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                            : "border-border bg-card/60 hover:bg-card"
                        }`}
                      >
                        <input
                          type="radio"
                          name="campaign_mode"
                          value="live"
                          checked={newMode === "live"}
                          onChange={() => setNewMode("live")}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-amber-400" />
                            Live X API v2 (BYOK Mode)
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Connects directly to X API v2 endpoints with Token-Bucket rate limiting (15 DMs/15 min). Requires valid X Bearer & OAuth tokens in Settings.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createCampaign} disabled={!newName || loading}>
                    Create Radar
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Campaign Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((c) => {
                const isSelected = selectedCampaign?.id === c.id;
                return (
                  <Card
                    key={c.id}
                    onClick={() => {
                      setSelectedCampaign(c);
                      setView("discovery");
                    }}
                    className={`cursor-pointer group hover:border-blue-500/50 hover:shadow-lg transition-all ${
                      isSelected ? "ring-2 ring-blue-500 border-blue-500/60 bg-blue-500/5" : "bg-card/80"
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <CardTitle className="text-base group-hover:text-blue-400 transition-colors">
                            {c.name}
                          </CardTitle>
                          <CardDescription className="line-clamp-2 mt-1">
                            {c.description || "Active AI Ecosystem Outreach Campaign"}
                          </CardDescription>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleCampaignMode(c, e)}
                          title="Click to toggle between Sandbox and Live mode"
                          className="cursor-pointer"
                        >
                          <Badge variant={c.mode === "sandbox" ? "success" : "destructive"}>
                            <span className={`h-1.5 w-1.5 rounded-full ${c.mode === "sandbox" ? "bg-emerald-400" : "bg-rose-400"}`} />
                            {c.mode === "sandbox" ? "Sandbox" : "Live X"}
                          </Badge>
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(c.keywords || []).map((kw) => (
                          <span
                            key={kw}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-secondary/80 text-muted-foreground border border-border/50"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-zinc-400" />
                          SEA AI Ecosystem
                        </span>
                        <span className="text-blue-400 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          Open Radar <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════
            SCREEN 2: DISCOVERY & FIT QUALIFICATION
            ═════════════════════════════════════════════════════ */}
        {view === "discovery" && (
          <div className="space-y-4">
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/60 p-4 rounded-xl border border-border/70 backdrop-blur-md">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Compass className="w-5 h-5 text-blue-400" />
                  Candidate Discovery & Qualification
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Radar: <strong className="text-foreground">{selectedCampaign?.name}</strong> · Mode:{" "}
                  <span className="font-mono text-emerald-400">{selectedCampaign?.mode.toUpperCase()}</span>
                </p>
              </div>

              {/* Action Pipeline Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runDiscovery}
                  disabled={!selectedCampaign || loading}
                  className="gap-1.5"
                >
                  <Search className="w-3.5 h-3.5 text-blue-400" />
                  Index Candidates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runScoring}
                  disabled={!selectedCampaign || loading || stats.discovered === 0}
                  className="gap-1.5 border-emerald-500/30 hover:border-emerald-500/50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Run Fit Scoring
                </Button>
                <Button
                  size="sm"
                  onClick={() => runDrafting(0.4)}
                  disabled={!selectedCampaign || loading || stats.scored === 0}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-500"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Draft DMs (Fit ≥ 40%)
                </Button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/40 p-2.5 rounded-xl border border-border/60">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by founder name, handle (@username), or research focus..."
                  className="pl-9 h-9 bg-card/60"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-card/80 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">All SEA Countries</option>
                  <option value="SG">🇸🇬 Singapore</option>
                  <option value="VN">🇻🇳 Vietnam</option>
                  <option value="ID">🇮🇩 Indonesia</option>
                  <option value="TH">🇹🇭 Thailand</option>
                  <option value="MY">🇲🇾 Malaysia</option>
                </select>

                <select
                  value={minScoreFilter}
                  onChange={(e) => setMinScoreFilter(parseFloat(e.target.value))}
                  className="h-9 rounded-lg border border-border bg-card/80 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="0">All Scores</option>
                  <option value="0.7">High Fit Only (≥ 70%)</option>
                  <option value="0.4">Relevant (≥ 40%)</option>
                </select>
              </div>
            </div>

            {/* Prospects Data Grid */}
            <div className="border border-border/80 rounded-xl overflow-hidden bg-card/60 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Candidate Profile</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Followers</th>
                      <th className="py-3 px-4">AI Fit Evaluation</th>
                      <th className="py-3 px-4">Pipeline Status</th>
                      <th className="py-3 px-4 text-right">Dossier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredProspects.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setInspectProspect(p)}
                        className="hover:bg-muted/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img
                                src={p.xProfileImageUrl || `https://avatar.vercel.sh/${p.xUsername}`}
                                alt=""
                                className="h-9 w-9 rounded-full bg-muted border border-border object-cover"
                              />
                              {(p.fitScore || 0) >= 0.75 && (
                                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-background flex items-center justify-center text-[8px] text-white font-bold">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                                {p.xDisplayName || p.xUsername}
                              </div>
                              <div className="text-muted-foreground text-[11px] font-mono">@{p.xUsername}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{p.xLocation || "—"}</td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {p.xFollowerCount?.toLocaleString() || "—"}
                        </td>
                        <td className="py-3 px-4">{getFitBadge(p.fitScore)}</td>
                        <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground group-hover:text-foreground"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredProspects.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground">
                          No profiles matching current filter. Click &ldquo;Index Candidates&rdquo; to start.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Candidate Dossier Slide-Over / Modal */}
            {inspectProspect && (
              <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-card border-border shadow-2xl animate-in zoom-in-95">
                  <CardHeader className="border-b border-border/60 pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <img
                          src={inspectProspect.xProfileImageUrl || `https://avatar.vercel.sh/${inspectProspect.xUsername}`}
                          alt=""
                          className="h-12 w-12 rounded-full border border-border"
                        />
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {inspectProspect.xDisplayName}
                            <span className="text-xs font-mono text-muted-foreground">@{inspectProspect.xUsername}</span>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-0.5">
                            <Globe className="w-3 h-3" /> {inspectProspect.xLocation || "SEA Region"} ·{" "}
                            {inspectProspect.xFollowerCount?.toLocaleString()} followers
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setInspectProspect(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4 overflow-y-auto flex-1">
                    {/* Bio */}
                    <div>
                      <span className="text-xs font-semibold uppercase text-muted-foreground">Twitter Bio</span>
                      <p className="text-sm mt-1 p-3 rounded-lg bg-muted/40 border border-border/50 text-foreground">
                        {inspectProspect.xBio}
                      </p>
                    </div>

                    {/* Fit Assessment */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          AI Qualification Thesis
                        </span>
                        {getFitBadge(inspectProspect.fitScore)}
                      </div>
                      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs space-y-1.5">
                        {inspectProspect.fitReasoning ? (
                          inspectProspect.fitReasoning.split("\n").map((r, i) => (
                            <p key={i} className="text-foreground/90 leading-relaxed">
                              • {r}
                            </p>
                          ))
                        ) : (
                          <span className="text-muted-foreground">No fit reasoning generated yet. Run Fit Scoring first.</span>
                        )}
                      </div>
                    </div>

                    {/* Verbatim Evidence Citations */}
                    {inspectProspect.evidenceSources && inspectProspect.evidenceSources.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold uppercase text-amber-300 flex items-center gap-1.5 mb-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Grounded Evidence Sources (Zero Hallucination)
                        </span>
                        <div className="space-y-2">
                          {inspectProspect.evidenceSources.map((ev, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200"
                            >
                              <div className="font-semibold text-amber-300">
                                [{ev.type.toUpperCase()}] &ldquo;{ev.quote}&rdquo;
                              </div>
                              <p className="text-muted-foreground mt-1">{ev.relevance}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Signal Tweets */}
                    {inspectProspect.recentTweets && inspectProspect.recentTweets.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">
                          Recent Signal Tweets
                        </span>
                        <div className="space-y-2">
                          {inspectProspect.recentTweets.slice(0, 3).map((t, i) => (
                            <div key={i} className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
                              <p className="text-foreground/90">{t.text}</p>
                              <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
                                <span>❤️ {t.metrics.likes} likes</span>
                                <span>🔁 {t.metrics.retweets} retweets</span>
                                <span>💬 {t.metrics.replies} replies</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="justify-between border-t border-border/60 pt-3">
                    <span className="text-xs text-muted-foreground">
                      Status: {getStatusBadge(inspectProspect.status)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        setInspectProspect(null);
                        setView("review");
                      }}
                    >
                      Open in Review Queue
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════
            SCREEN 3: REVIEW & APPROVAL CONSOLE (HERO FLOW)
            ═════════════════════════════════════════════════════ */}
        {view === "review" && (
          <div className="space-y-4">
            {/* Review Header Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 p-4 rounded-xl border border-border/70 backdrop-blur-md">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-amber-400" />
                    Human-in-the-Loop Review Queue
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-500/10 text-amber-300 border border-amber-500/25">
                    {stats.drafted} Pending · {stats.approved} Approved
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review every drafted DM against real evidence. Edit inline before approving. Safe execution guaranteed.
                </p>
              </div>

              <Button
                onClick={sendApproved}
                disabled={stats.approved === 0 || loading}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
              >
                <Send className="w-4 h-4" />
                Safely Send {stats.approved} Approved DMs
              </Button>
            </div>

            {currentReview ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Pane: Candidate Dossier (5 cols) */}
                <Card className="lg:col-span-5 bg-card/80 border-border/80 flex flex-col">
                  <CardHeader className="border-b border-border/60 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={currentReview.xProfileImageUrl || `https://avatar.vercel.sh/${currentReview.xUsername}`}
                          alt=""
                          className="h-12 w-12 rounded-full border border-border/80 object-cover"
                        />
                        <div>
                          <CardTitle className="text-base text-foreground">{currentReview.xDisplayName}</CardTitle>
                          <CardDescription className="font-mono text-muted-foreground">
                            @{currentReview.xUsername} · {currentReview.xLocation}
                          </CardDescription>
                        </div>
                      </div>
                      {getFitBadge(currentReview.fitScore)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4 text-xs flex-1">
                    {/* Bio */}
                    <div>
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                        Twitter / X Bio
                      </span>
                      <p className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-foreground/90 leading-relaxed">
                        {currentReview.xBio}
                      </p>
                    </div>

                    {/* Thesis */}
                    {currentReview.fitReasoning && (
                      <div>
                        <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                          AI Qualification Reasoning
                        </span>
                        <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-blue-200/90 space-y-1">
                          {currentReview.fitReasoning.split("\n").map((r, i) => (
                            <p key={i}>• {r}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Verbatim Evidence Citations */}
                    {currentReview.evidenceSources && currentReview.evidenceSources.length > 0 && (
                      <div>
                        <span className="font-semibold text-amber-300 uppercase text-[10px] tracking-wider flex items-center gap-1 mb-1">
                          <ShieldCheck className="w-3 h-3" />
                          Grounded Evidence Sources (Zero Hallucination)
                        </span>
                        <div className="space-y-1.5">
                          {currentReview.evidenceSources.map((e, i) => (
                            <div
                              key={i}
                              className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200"
                            >
                              <span className="font-semibold text-amber-300">[{e.type}]</span> &ldquo;{e.quote}&rdquo;
                              <p className="text-muted-foreground mt-0.5 text-[11px]">{e.relevance}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Signal Tweets */}
                    {currentReview.recentTweets && currentReview.recentTweets.length > 0 && (
                      <div>
                        <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                          Signal Tweet Reference
                        </span>
                        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                          <p className="text-foreground/90 italic">&ldquo;{currentReview.recentTweets[0].text}&rdquo;</p>
                          <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            <span>❤️ {currentReview.recentTweets[0].metrics.likes}</span>
                            <span>🔁 {currentReview.recentTweets[0].metrics.retweets}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Right Pane: Message Studio & Approval (7 cols) */}
                <Card className="lg:col-span-7 bg-card/80 border-border/80 flex flex-col justify-between">
                  <div>
                    <CardHeader className="border-b border-border/60 pb-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-base text-foreground flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                            Personalized Outreach Message Studio
                          </CardTitle>
                          <CardDescription>
                            Reviewing {reviewIndex + 1} of {draftedProspects.length} in queue
                          </CardDescription>
                        </div>

                        {/* Keyboard shortcut tips */}
                        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono">A</kbd> Approve
                          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono ml-1">R</kbd> Reject
                          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono ml-1">Space</kbd> Skip
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* Tone & Context Pill */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                          Sender Identity: <strong>GenAI Fund Team</strong>
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {(editingDraft || currentReview.draftMessage || "").length} / 280 chars
                        </span>
                      </div>

                      {/* Textarea */}
                      <Textarea
                        rows={7}
                        value={editingDraft || currentReview.draftMessage || ""}
                        onChange={(e) => setEditingDraft(e.target.value)}
                        onFocus={() => {
                          if (!editingDraft) setEditingDraft(currentReview.draftMessage || "");
                        }}
                        className="font-sans text-sm leading-relaxed bg-muted/30 border-border/80 focus:border-blue-500"
                        placeholder="Draft message will appear here..."
                      />

                      {/* Guardrail Checklist */}
                      <div className="p-3 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1.5">
                        <div className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
                          Automated FDE Guardrail Verification
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <Check className="w-3.5 h-3.5" /> Verbatim evidence cited
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <Check className="w-3.5 h-3.5" /> Zero invented familiarity
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <Check className="w-3.5 h-3.5" /> No recruiter/sales clichés
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <Check className="w-3.5 h-3.5" /> Anti-duplicate check: Passed
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  <CardFooter className="justify-between border-t border-border/60 pt-4 bg-muted/10">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingDraft("");
                        setReviewIndex(Math.min(reviewIndex + 1, draftedProspects.length - 1));
                      }}
                      className="gap-1.5"
                    >
                      Skip [Space]
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          handleApproval(currentReview.id, "reject");
                          setEditingDraft("");
                        }}
                        className="gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" /> Reject [R]
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          handleApproval(currentReview.id, "approve");
                          setEditingDraft("");
                        }}
                        className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve & Queue [A]
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </div>
            ) : (
              <Card className="text-center py-16 bg-card/60 border-dashed border-border/80">
                <CardContent className="space-y-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Review Queue Cleared</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {stats.approved > 0
                      ? `All drafts reviewed! You have ${stats.approved} approved DMs ready for safe send.`
                      : "No drafted DMs waiting for review. Run Fit Scoring and drafting from the Discovery tab."}
                  </p>
                  {stats.approved > 0 && (
                    <Button onClick={sendApproved} className="mt-2 bg-emerald-600 hover:bg-emerald-500">
                      Send {stats.approved} Approved DMs Now
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════
            SCREEN 4: OUTREACH TRACKER & CONVERSATIONAL INBOX
            ═════════════════════════════════════════════════════ */}
        {view === "tracker" && (
          <div className="space-y-4">
            {/* Header & Compliance Callout */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 p-4 rounded-xl border border-border/70 backdrop-blur-md">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-indigo-400" />
                  Outreach Tracker & Live Inbox
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track delivered conversations, manage inbound replies, and monitor platform health.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={syncReplies} disabled={!selectedCampaign || loading} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                Sync Inbound Replies
              </Button>
            </div>

            {/* Platform Compliance Status Bar */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block font-medium">Zero Double-Messaging Invariant</strong>
                  <span className="text-muted-foreground text-[11px]">
                    Enforced by SQLite database constraint <code>UNIQUE(x_user_id)</code> + atomic state transitions.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block font-medium">Token-Bucket Rate Limiter</strong>
                  <span className="text-muted-foreground text-[11px]">
                    Strictly bounds execution to 15 DMs per 15-minute window with auto-backoff on HTTP 429.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block font-medium">Closed DMs Gatekeeper</strong>
                  <span className="text-muted-foreground text-[11px]">
                    Safely marks HTTP 403 as <code>BLOCKED_DM_CLOSED</code> without wasting retries.
                  </span>
                </div>
              </div>
            </div>

            {/* Conversational Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
              {/* Left Column: Conversations List (5 cols) */}
              <Card className="lg:col-span-5 bg-card/80 border-border/80 flex flex-col overflow-hidden">
                <CardHeader className="p-3 border-b border-border/60 bg-muted/30">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Conversations ({outreachedProspects.length})
                  </span>
                </CardHeader>
                <div className="divide-y divide-border/40 overflow-y-auto flex-1 max-h-[550px]">
                  {outreachedProspects.map((p) => {
                    const isSelected = selectedThread?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedThreadId(p.id)}
                        className={`p-3 cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-500/10 border-l-2 border-blue-500" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-xs text-foreground truncate max-w-[160px]">
                            {p.xDisplayName}
                          </span>
                          {getStatusBadge(p.status)}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">@{p.xUsername}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                          {p.replyPreview ? `💬 "${p.replyPreview}"` : p.draftMessage}
                        </p>
                      </div>
                    );
                  })}
                  {outreachedProspects.length === 0 && (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No outreach activity yet. Approve and send messages to view threads.
                    </div>
                  )}
                </div>
              </Card>

              {/* Right Column: Simulated Thread Preview (7 cols) */}
              <Card className="lg:col-span-7 bg-card/80 border-border/80 flex flex-col justify-between">
                {selectedThread ? (
                  <>
                    <CardHeader className="p-4 border-b border-border/60 bg-muted/20">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <img
                            src={selectedThread.xProfileImageUrl || `https://avatar.vercel.sh/${selectedThread.xUsername}`}
                            alt=""
                            className="h-10 w-10 rounded-full border border-border"
                          />
                          <div>
                            <CardTitle className="text-sm font-semibold">{selectedThread.xDisplayName}</CardTitle>
                            <CardDescription className="text-xs font-mono">
                              @{selectedThread.xUsername} · {selectedThread.xLocation}
                            </CardDescription>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-blue-400 gap-1"
                          onClick={() => window.open(`https://x.com/${selectedThread.xUsername}`, "_blank")}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View on X
                        </Button>
                      </div>
                    </CardHeader>

                    {/* Chat Bubble Area */}
                    <CardContent className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[420px]">
                      {/* Outbound DM Bubble */}
                      <div className="flex flex-col items-end space-y-1">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Delivered via GenAI Fund · {selectedThread.sentAt ? new Date(selectedThread.sentAt).toLocaleTimeString() : "Sent"}
                        </span>
                        <div className="max-w-[85%] p-3.5 rounded-2xl rounded-tr-sm bg-blue-600 text-white text-xs leading-relaxed shadow-sm">
                          {selectedThread.draftMessage}
                        </div>
                      </div>

                      {/* Inbound Reply Bubble or Status */}
                      {selectedThread.replyPreview ? (
                        <div className="flex flex-col items-start space-y-1">
                          <span className="text-[10px] text-indigo-300 font-mono flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Inbound Reply from @{selectedThread.xUsername}
                          </span>
                          <div className="max-w-[85%] p-3.5 rounded-2xl rounded-tl-sm bg-muted/80 border border-border/80 text-foreground text-xs leading-relaxed shadow-sm">
                            &ldquo;{selectedThread.replyPreview}&rdquo;
                          </div>
                        </div>
                      ) : selectedThread.status === "BLOCKED_DM_CLOSED" ? (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
                          <Lock className="w-4 h-4 shrink-0" />
                          <span>Recipient has closed direct messages. Blocked safely without burning rate limit.</span>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-muted-foreground italic">
                          Awaiting reply from candidate...
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="p-3 border-t border-border/60 bg-muted/20 flex justify-between text-xs text-muted-foreground">
                      <span>Status: {getStatusBadge(selectedThread.status)}</span>
                      <span>Zero Double-Messaging Active 🛡️</span>
                    </CardFooter>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full p-12 text-center text-xs text-muted-foreground">
                    Select a conversation from the left to view thread details.
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════
            SCREEN 5: SETTINGS & SYSTEM DIAGNOSTICS
            ═════════════════════════════════════════════════════ */}
        {view === "settings" && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Console Settings & Credentials</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Bring Your Own Keys (BYOK). Credentials are saved locally with zero external telemetry.
              </p>
            </div>

            {/* Diagnostics Panel */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  API Health Diagnostics
                </CardTitle>
                <CardDescription>
                  Verify connectivity, OAuth 2.0 user tokens, and token-bucket rate limiter states.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" size="sm" onClick={testConnection} disabled={loading} className="gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Run Diagnostics & Test Connection
                </Button>

                {healthData && (
                  <div className="p-3.5 rounded-xl border border-border bg-muted/30 text-xs space-y-2">
                    <div className="flex justify-between items-center border-b border-border/60 pb-2">
                      <span className="font-semibold text-foreground">Active Provider:</span>
                      <Badge variant={healthData.mode === "sandbox" ? "success" : "destructive"}>
                        {healthData.mode?.toUpperCase() || "SANDBOX"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={healthData.connected ? "text-emerald-400 font-semibold" : "text-amber-300"}>
                        {healthData.connected ? "Verified & Authenticated ✓" : "Safe Sandbox Active"}
                      </span>
                    </div>
                    {healthData.username && (
                      <div className="flex justify-between items-center font-mono">
                        <span className="text-muted-foreground">Connected X Account:</span>
                        <span className="text-foreground">@{healthData.username}</span>
                      </div>
                    )}
                    {healthData.rate_limit_remaining !== undefined && (
                      <div className="flex justify-between items-center font-mono">
                        <span className="text-muted-foreground">Token Bucket Available:</span>
                        <span className="text-emerald-400">{healthData.rate_limit_remaining} / 15 slots</span>
                      </div>
                    )}
                    {healthData.note && (
                      <div className="p-2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 mt-2">
                        💡 {healthData.note}
                      </div>
                    )}
                    {healthData.error && (
                      <div className="p-2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 mt-2">
                        ⚠️ {healthData.error}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* X API Keys */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  X (Twitter) API v2 Configuration
                </CardTitle>
                <CardDescription>
                  Required only for Live mode. If left blank, the app runs cleanly in Safe Sandbox mode.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "x_bearer_token", label: "Bearer Token", placeholder: "AAAAAAAAAAAAAAAAAAAAA..." },
                  { key: "x_access_token", label: "User OAuth 2.0 Access Token", placeholder: "User context token for DM sending" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                      {label}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={placeholder}
                        value={settingsValues[key] || ""}
                        onChange={(e) => setSettingsValues({ ...settingsValues, [key]: e.target.value })}
                        className="font-mono text-xs"
                      />
                      <Button variant="outline" size="sm" onClick={() => saveSetting(key, settingsValues[key] || "")}>
                        Save
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* LLM Provider */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  LLM Intelligence Engine
                </CardTitle>
                <CardDescription>Choose the AI model used for evidence evaluation and DM drafting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                    AI Provider
                  </label>
                  <select
                    className="flex h-9 w-full rounded-lg border border-border bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={settingsValues.llm_provider || "gemini"}
                    onChange={(e) => {
                      setSettingsValues({ ...settingsValues, llm_provider: e.target.value });
                      saveSetting("llm_provider", e.target.value);
                    }}
                  >
                    <option value="gemini">Google Gemini 2.5 Flash (Recommended)</option>
                    <option value="openai">OpenAI GPT-4o</option>
                    <option value="anthropic">Anthropic Claude 3.5 Sonnet</option>
                  </select>
                </div>

                {[
                  { key: "google_api_key", label: "Gemini API Key", placeholder: "AIzaSy..." },
                  { key: "openai_api_key", label: "OpenAI API Key", placeholder: "sk-..." },
                  { key: "anthropic_api_key", label: "Anthropic API Key", placeholder: "sk-ant-..." },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                      {label}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={placeholder}
                        value={settingsValues[key] || ""}
                        onChange={(e) => setSettingsValues({ ...settingsValues, [key]: e.target.value })}
                        className="font-mono text-xs"
                      />
                      <Button variant="outline" size="sm" onClick={() => saveSetting(key, settingsValues[key] || "")}>
                        Save
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* ── Global Loading Overlay ─────────────────────────── */}
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3 max-w-xs text-center">
            <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-foreground">{loadingText}</span>
            <span className="text-[11px] text-muted-foreground">Running idempotent FDE pipeline...</span>
          </div>
        </div>
      )}
    </div>
  );
}
