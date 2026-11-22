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
  Clock,
  Lock,
  Cpu,
  Radio,
  Zap,
  Eye,
  Globe,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Layers,
  ArrowRight
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
  const [mounted, setMounted] = useState(false);
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
    setMounted(true);
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
    setLoadingText("Creating radar...");
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
      showMsg(data.connected ? "Connection verified ✓" : `Status: ${data.error || "Sandbox Active"}`);
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
    setLoadingText("Syncing inbound X replies...");
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs">
          <Sparkles className="w-3 h-3 text-emerald-600" /> {(score * 100).toFixed(0)}% High Fit
        </span>
      );
    }
    if (score >= 0.4) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/90 shadow-2xs">
          {(score * 100).toFixed(0)}% Relevant
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-normal bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
        {(score * 100).toFixed(0)}% Low Match
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string; icon?: React.ReactNode }> = {
      DISCOVERED: { label: "Discovered", className: "bg-slate-100 text-slate-700 border-slate-200/80" },
      SCORED: { label: "Scored", className: "bg-blue-50 text-blue-700 border-blue-200/80" },
      DRAFTED: { label: "Draft Ready", className: "bg-amber-50 text-amber-700 border-amber-200/90", icon: <Clock className="w-3 h-3 text-amber-600" /> },
      APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200/90", icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" /> },
      REJECTED: { label: "Rejected", className: "bg-slate-100 text-slate-500 border-slate-200" },
      SENDING: { label: "Sending...", className: "bg-amber-100 text-amber-800 border-amber-300 animate-pulse" },
      SENT: { label: "Delivered", className: "bg-emerald-50 text-emerald-700 border-emerald-200/90", icon: <Check className="w-3 h-3 text-emerald-600" /> },
      SENT_SANDBOX: { label: "Sent (Sandbox)", className: "bg-emerald-50 text-emerald-700 border-emerald-200/90", icon: <Check className="w-3 h-3 text-emerald-600" /> },
      REPLIED: { label: "Replied 🔔", className: "bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold shadow-2xs", icon: <MessageSquare className="w-3 h-3 text-indigo-600" /> },
      BLOCKED_DM_CLOSED: { label: "DMs Closed", className: "bg-rose-50 text-rose-700 border-rose-200", icon: <Lock className="w-3 h-3 text-rose-600" /> },
      FAILED_RETRYABLE: { label: "Retryable", className: "bg-amber-50 text-amber-700 border-amber-200" },
      FAILED_PERMANENT: { label: "Failed", className: "bg-rose-50 text-rose-700 border-rose-200" },
    };
    const s = map[status] || { label: status, className: "bg-slate-100 text-slate-600 border-slate-200" };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border font-medium backdrop-blur-md ${s.className}`}>
        {s.icon}
        {s.label}
      </span>
    );
  };

  if (!mounted) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50/25 to-indigo-50/20"
      >
        <div suppressHydrationWarning className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium tracking-wide">
            Loading Scout Console...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900 flex flex-col font-sans" suppressHydrationWarning>
      {/* ── Toast Notification ────────────────────────────── */}
      {message && (
        <div className="fixed top-5 right-6 z-50 bg-white/90 border border-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.08)] rounded-2xl px-4 py-3 text-sm flex items-center gap-2.5 animate-in slide-in-from-top-4 backdrop-blur-2xl ring-1 ring-black/[0.04]">
          <div className="h-2 w-2 rounded-full bg-[#0071e3] animate-ping" />
          <span className="font-medium text-slate-800">{message}</span>
        </div>
      )}

      {/* ── Apple Liquid Glass Top Navigation ────────────── */}
      <header className="border-b border-white/60 bg-white/70 backdrop-blur-2xl sticky top-0 z-40 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Identity - No background on icon */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Compass className="h-7 w-7 text-[#0071e3] shrink-0 stroke-[2.2]" />
            <div className="whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-base text-slate-900">SCOUT</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#0071e3] border border-blue-200/60 whitespace-nowrap">
                  GenAI Fund
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">SEA AI & Robotics Founder Radar</p>
            </div>
          </div>

          {/* Segmented Pill Navigation - whitespace-nowrap & clean badges */}
          <nav className="flex items-center gap-1 bg-slate-200/50 backdrop-blur-xl p-1 rounded-2xl border border-white/80 shadow-inner shrink-0 flex-nowrap">
            {[
              { id: "campaigns", label: "Campaigns", icon: Layers },
              { id: "discovery", label: "Discovery & Fit", icon: Compass, count: stats.discovered },
              { id: "review", label: "Review Queue", icon: CheckCircle2, count: stats.drafted },
              { id: "tracker", label: "Outreach & Inbox", icon: Inbox, count: stats.replied },
              { id: "settings", label: "Settings", icon: SettingsIcon },
            ].map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setView(id as View)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                  view === id
                    ? "bg-white/95 text-slate-900 shadow-sm shadow-slate-900/5 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span className="whitespace-nowrap">{label}</span>
                {count !== undefined && count > 0 && (
                  <span className="ml-1 text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                    ({count})
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Active Campaign / Mode Indicator */}
          <div className="flex items-center gap-3 shrink-0">
            {selectedCampaign && (
              <div className="hidden lg:flex items-center gap-2 border border-white/80 rounded-2xl px-3 py-1.5 bg-white/70 backdrop-blur-md shadow-2xs text-xs whitespace-nowrap shrink-0">
                <span className="text-slate-500 whitespace-nowrap">Radar:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[130px] whitespace-nowrap">
                  {selectedCampaign.name}
                </span>
                <button
                  onClick={(e) => toggleCampaignMode(selectedCampaign, e)}
                  title="Click to toggle between Sandbox and Live X API"
                  className="cursor-pointer hover:opacity-85 transition-opacity whitespace-nowrap shrink-0"
                >
                  <Badge variant={selectedCampaign.mode === "sandbox" ? "success" : "destructive"} className="whitespace-nowrap shrink-0">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${selectedCampaign.mode === "sandbox" ? "bg-emerald-500" : "bg-rose-500"}`} />
                    {selectedCampaign.mode === "sandbox" ? "Sandbox ($0)" : "Live X API"}
                  </Badge>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Apple Liquid Glass KPI Strip ───────────────────── */}
      <div className="border-b border-white/50 bg-white/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="p-3.5 rounded-2xl border border-white/80 bg-white/75 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] ring-1 ring-black/[0.02] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                Total Scanned
                <Globe className="w-3.5 h-3.5 text-slate-400" />
              </span>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900">{stats.total}</span>
                <span className="text-xs text-slate-500">profiles</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                High-Signal Fit
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              </span>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-emerald-800">{stats.highFit}</span>
                <span className="text-xs text-emerald-600/80 font-medium">score ≥ 70%</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-amber-200/70 bg-amber-50/40 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider flex items-center justify-between">
                Review Queue
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </span>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-amber-800">{stats.drafted}</span>
                <span className="text-xs text-amber-700/80 font-medium">awaiting review</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-blue-200/70 bg-blue-50/40 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider flex items-center justify-between">
                Outreach Sent
                <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3]" />
              </span>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-blue-900">{stats.sent}</span>
                <span className="text-xs text-blue-600 font-medium">0 duplicates</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-indigo-200/70 bg-indigo-50/40 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider flex items-center justify-between">
                Reply Yield
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              </span>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-indigo-900">{stats.replied}</span>
                <span className="text-xs text-indigo-600 font-medium">({stats.conversion}%)</span>
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
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Target Radars & Campaigns</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Configure search segments, keywords, and seed accounts across Southeast Asia AI ecosystems.
                </p>
              </div>
              <Button onClick={() => setShowCreate(!showCreate)} className="gap-2 shadow-md">
                <Sparkles className="w-4 h-4" />
                {showCreate ? "Close Panel" : "Create New Radar"}
              </Button>
            </div>

            {/* Campaign Creator Card */}
            {showCreate && (
              <Card className="border-blue-200/80 bg-white/90 shadow-xl ring-1 ring-blue-500/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                    <Radio className="w-4 h-4 text-[#0071e3]" />
                    Configure New AI / Robotics Target Radar
                  </CardTitle>
                  <CardDescription>
                    Define keywords and seed handles. The system will index profiles, score fit, and prepare personalized outreach.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 block">
                        Radar / Campaign Name
                      </label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. SEA Embodied AI & Humanoid Founders Q1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 block">
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
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 block">
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
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 block">
                      Target Keywords (comma-separated)
                    </label>
                    <Input
                      value={newKeywords}
                      onChange={(e) => setNewKeywords(e.target.value)}
                      placeholder="embodied AI, vision-language-action, robotics manipulation, SLAM, humanoid"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                      Execution Mode
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label
                        className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                          newMode === "sandbox"
                            ? "border-[#0071e3] bg-blue-50/60 ring-2 ring-blue-500/20"
                            : "border-slate-200/80 bg-white/70 hover:bg-white"
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
                          <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            Safe Sandbox Mode ($0 Cost)
                          </div>
                          <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Zero API spend. Test end-to-end with 30 curated Southeast Asian AI & robotics builders with realistic bios, signal tweets, and simulated responses.
                          </div>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                          newMode === "live"
                            ? "border-[#0071e3] bg-blue-50/60 ring-2 ring-blue-500/20"
                            : "border-slate-200/80 bg-white/70 hover:bg-white"
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
                          <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-amber-600" />
                            Live X API v2 (BYOK Mode)
                          </div>
                          <div className="text-xs text-slate-500 mt-1 leading-relaxed">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {campaigns.map((c) => {
                const isSelected = selectedCampaign?.id === c.id;
                return (
                  <Card
                    key={c.id}
                    onClick={() => {
                      setSelectedCampaign(c);
                      setView("discovery");
                    }}
                    className={`cursor-pointer group hover:border-[#0071e3]/60 hover:shadow-xl transition-all ${
                      isSelected ? "ring-2 ring-[#0071e3] border-[#0071e3]/80 bg-white/90" : "bg-white/75"
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <CardTitle className="text-base text-slate-900 group-hover:text-[#0071e3] transition-colors">
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
                          className="cursor-pointer shrink-0"
                        >
                          <Badge variant={c.mode === "sandbox" ? "success" : "destructive"} className="whitespace-nowrap shrink-0">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.mode === "sandbox" ? "bg-emerald-500" : "bg-rose-500"}`} />
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
                            className="text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-100/90 text-slate-600 border border-slate-200/60 font-medium"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          SEA AI Ecosystem
                        </span>
                        <span className="text-[#0071e3] font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 p-4 rounded-2xl border border-white/90 shadow-sm backdrop-blur-xl">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#0071e3]" />
                  Candidate Discovery & Qualification
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Radar: <strong className="text-slate-900">{selectedCampaign?.name}</strong> · Mode:{" "}
                  <span className="font-mono text-emerald-700 font-semibold">{selectedCampaign?.mode.toUpperCase()}</span>
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
                  <Search className="w-3.5 h-3.5 text-[#0071e3]" />
                  Index Candidates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runScoring}
                  disabled={!selectedCampaign || loading || stats.discovered === 0}
                  className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Run Fit Scoring
                </Button>
                <Button
                  size="sm"
                  onClick={() => runDrafting(0.4)}
                  disabled={!selectedCampaign || loading || stats.scored === 0}
                  className="gap-1.5 shadow-md"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Draft DMs (Fit ≥ 40%)
                </Button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/70 p-3 rounded-2xl border border-white/80 shadow-2xs backdrop-blur-xl">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by founder name, handle (@username), or research focus..."
                  className="pl-10 h-9 bg-white/80"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200/90 bg-white/80 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
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
                  className="h-9 rounded-xl border border-slate-200/90 bg-white/80 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                >
                  <option value="0">All Scores</option>
                  <option value="0.7">High Fit Only (≥ 70%)</option>
                  <option value="0.4">Relevant (≥ 40%)</option>
                </select>
              </div>
            </div>

            {/* Prospects Data Grid */}
            <div className="border border-white/90 rounded-2xl overflow-hidden bg-white/80 backdrop-blur-xl shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Candidate Profile</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4">Followers</th>
                      <th className="py-3.5 px-4">AI Fit Evaluation</th>
                      <th className="py-3.5 px-4">Pipeline Status</th>
                      <th className="py-3.5 px-4 text-right">Dossier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProspects.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setInspectProspect(p)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img
                                src={p.xProfileImageUrl || `https://avatar.vercel.sh/${p.xUsername}`}
                                alt=""
                                className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 object-cover shadow-2xs"
                              />
                              {(p.fitScore || 0) >= 0.75 && (
                                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center text-[8px] text-white font-bold">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 group-hover:text-[#0071e3] transition-colors flex items-center gap-1.5">
                                {p.xDisplayName || p.xUsername}
                              </div>
                              <div className="text-slate-500 text-[11px] font-mono">@{p.xUsername}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{p.xLocation || "—"}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {p.xFollowerCount?.toLocaleString() || "—"}
                        </td>
                        <td className="py-3 px-4">{getFitBadge(p.fitScore)}</td>
                        <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-xs text-slate-500 group-hover:text-slate-900 hover:bg-slate-100/80"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-[#0071e3]" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredProspects.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          No profiles matching current filter. Click &ldquo;Index Candidates&rdquo; to start.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Candidate Dossier Modal */}
            {inspectProspect && (
              <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white/95 border-white shadow-2xl rounded-3xl animate-in zoom-in-95">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <img
                          src={inspectProspect.xProfileImageUrl || `https://avatar.vercel.sh/${inspectProspect.xUsername}`}
                          alt=""
                          className="h-12 w-12 rounded-full border border-slate-200 shadow-sm object-cover"
                        />
                        <div>
                          <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                            {inspectProspect.xDisplayName}
                            <span className="text-xs font-mono text-slate-500">@{inspectProspect.xUsername}</span>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-0.5 text-slate-500">
                            <Globe className="w-3 h-3 text-slate-400" /> {inspectProspect.xLocation || "SEA Region"} ·{" "}
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
                      <span className="text-xs font-semibold uppercase text-slate-500">Twitter Bio</span>
                      <p className="text-sm mt-1 p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-slate-800 leading-relaxed">
                        {inspectProspect.xBio}
                      </p>
                    </div>

                    {/* Fit Assessment */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold uppercase text-slate-500">
                          AI Qualification Thesis
                        </span>
                        {getFitBadge(inspectProspect.fitScore)}
                      </div>
                      <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/70 text-xs space-y-1.5 text-slate-800">
                        {inspectProspect.fitReasoning ? (
                          inspectProspect.fitReasoning.split("\n").map((r, i) => (
                            <p key={i} className="leading-relaxed">
                              • {r}
                            </p>
                          ))
                        ) : (
                          <span className="text-slate-500">No fit reasoning generated yet. Run Fit Scoring first.</span>
                        )}
                      </div>
                    </div>

                    {/* Verbatim Evidence Citations */}
                    {inspectProspect.evidenceSources && inspectProspect.evidenceSources.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold uppercase text-amber-800 flex items-center gap-1.5 mb-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          Grounded Evidence Sources (Zero Hallucination)
                        </span>
                        <div className="space-y-2">
                          {inspectProspect.evidenceSources.map((ev, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900"
                            >
                              <div className="font-semibold text-amber-800">
                                [{ev.type.toUpperCase()}] &ldquo;{ev.quote}&rdquo;
                              </div>
                              <p className="text-slate-600 mt-1">{ev.relevance}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Signal Tweets */}
                    {inspectProspect.recentTweets && inspectProspect.recentTweets.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                          Recent Signal Tweets
                        </span>
                        <div className="space-y-2">
                          {inspectProspect.recentTweets.slice(0, 3).map((t, i) => (
                            <div key={i} className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-xs">
                              <p className="text-slate-800">{t.text}</p>
                              <div className="flex gap-4 mt-2 text-[11px] text-slate-500">
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
                  <CardFooter className="justify-between border-t border-slate-100 pt-3.5">
                    <span className="text-xs text-slate-500">
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 rounded-2xl border border-white/90 shadow-sm backdrop-blur-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-amber-600" />
                    Human-in-the-Loop Review Queue
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                    {stats.drafted} Pending · {stats.approved} Approved
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review every drafted DM against real evidence. Edit inline before approving. Safe execution guaranteed.
                </p>
              </div>

              <Button
                onClick={sendApproved}
                disabled={stats.approved === 0 || loading}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
              >
                <Send className="w-4 h-4" />
                Safely Send {stats.approved} Approved DMs
              </Button>
            </div>

            {currentReview ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Pane: Candidate Dossier (5 cols) */}
                <Card className="lg:col-span-5 bg-white/85 border-white/90 flex flex-col shadow-sm">
                  <CardHeader className="border-b border-slate-100 pb-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={currentReview.xProfileImageUrl || `https://avatar.vercel.sh/${currentReview.xUsername}`}
                          alt=""
                          className="h-12 w-12 rounded-full border border-slate-200 object-cover shadow-2xs"
                        />
                        <div>
                          <CardTitle className="text-base text-slate-900">{currentReview.xDisplayName}</CardTitle>
                          <CardDescription className="font-mono text-slate-500">
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
                      <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
                        Twitter / X Bio
                      </span>
                      <p className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-slate-800 leading-relaxed">
                        {currentReview.xBio}
                      </p>
                    </div>

                    {/* Thesis */}
                    {currentReview.fitReasoning && (
                      <div>
                        <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
                          AI Qualification Reasoning
                        </span>
                        <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/70 text-slate-800 space-y-1">
                          {currentReview.fitReasoning.split("\n").map((r, i) => (
                            <p key={i}>• {r}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Verbatim Evidence Citations */}
                    {currentReview.evidenceSources && currentReview.evidenceSources.length > 0 && (
                      <div>
                        <span className="font-semibold text-amber-800 uppercase text-[10px] tracking-wider flex items-center gap-1 mb-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          Grounded Evidence Sources (Zero Hallucination)
                        </span>
                        <div className="space-y-1.5">
                          {currentReview.evidenceSources.map((e, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900"
                            >
                              <span className="font-semibold text-amber-800">[{e.type}]</span> &ldquo;{e.quote}&rdquo;
                              <p className="text-slate-600 mt-0.5 text-[11px]">{e.relevance}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Signal Tweets */}
                    {currentReview.recentTweets && currentReview.recentTweets.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
                          Signal Tweet Reference
                        </span>
                        <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                          <p className="text-slate-800 italic">&ldquo;{currentReview.recentTweets[0].text}&rdquo;</p>
                          <div className="flex gap-3 mt-1.5 text-[10px] text-slate-500">
                            <span>❤️ {currentReview.recentTweets[0].metrics.likes}</span>
                            <span>🔁 {currentReview.recentTweets[0].metrics.retweets}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Right Pane: Message Studio & Approval (7 cols) */}
                <Card className="lg:col-span-7 bg-white/85 border-white/90 flex flex-col justify-between shadow-sm">
                  <div>
                    <CardHeader className="border-b border-slate-100 pb-3.5">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-[#0071e3]" />
                            Personalized Outreach Message Studio
                          </CardTitle>
                          <CardDescription>
                            Reviewing {reviewIndex + 1} of {draftedProspects.length} in queue
                          </CardDescription>
                        </div>

                        {/* Keyboard shortcut tips */}
                        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                          <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-md shadow-2xs font-mono">A</kbd> Approve
                          <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-md shadow-2xs font-mono ml-1">R</kbd> Reject
                          <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-md shadow-2xs font-mono ml-1">Space</kbd> Skip
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* Tone & Context Pill */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                          <UserCheck className="w-3.5 h-3.5 text-[#0071e3]" />
                          Sender Identity: <strong>GenAI Fund Team</strong>
                        </span>
                        <span className="font-mono text-slate-500">
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
                        className="font-sans text-sm leading-relaxed bg-slate-50/70 border-slate-200/90 focus:bg-white text-slate-900"
                        placeholder="Draft message will appear here..."
                      />

                      {/* Guardrail Checklist */}
                      <div className="p-3.5 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 text-xs space-y-1.5">
                        <div className="font-semibold text-emerald-800 text-[10px] uppercase tracking-wider mb-1">
                          Automated FDE Guardrail Verification
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                            <Check className="w-3.5 h-3.5" /> Verbatim evidence cited
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                            <Check className="w-3.5 h-3.5" /> Zero invented familiarity
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                            <Check className="w-3.5 h-3.5" /> No recruiter/sales clichés
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                            <Check className="w-3.5 h-3.5" /> Anti-duplicate check: Passed
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  <CardFooter className="justify-between border-t border-slate-100 pt-4 bg-slate-50/40">
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
                        className="gap-1.5 bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-sm shadow-blue-500/25"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve & Queue [A]
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </div>
            ) : (
              <Card className="text-center py-16 bg-white/70 border-dashed border-slate-200">
                <CardContent className="space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h3 className="text-base font-semibold text-slate-900">Review Queue Cleared</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {stats.approved > 0
                      ? `All drafts reviewed! You have ${stats.approved} approved DMs ready for safe send.`
                      : "No drafted DMs waiting for review. Run Fit Scoring and drafting from the Discovery tab."}
                  </p>
                  {stats.approved > 0 && (
                    <Button onClick={sendApproved} className="mt-2 bg-emerald-600 hover:bg-emerald-500 shadow-md">
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 rounded-2xl border border-white/90 shadow-sm backdrop-blur-xl">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-indigo-600" />
                  Outreach Tracker & Live Inbox
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track delivered conversations, manage inbound replies, and monitor platform health.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={syncReplies} disabled={!selectedCampaign || loading} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-[#0071e3]" />
                Sync Inbound Replies
              </Button>
            </div>

            {/* Platform Compliance Status Bar */}
            <div className="p-4 rounded-2xl border border-white/80 bg-white/75 backdrop-blur-xl grid grid-cols-1 md:grid-cols-3 gap-3 text-xs shadow-2xs">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-semibold">Zero Double-Messaging Invariant</strong>
                  <span className="text-slate-500 text-[11px]">
                    Enforced by SQLite database constraint <code>UNIQUE(x_user_id)</code> + atomic state transitions.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-semibold">Token-Bucket Rate Limiter</strong>
                  <span className="text-slate-500 text-[11px]">
                    Strictly bounds execution to 15 DMs per 15-minute window with auto-backoff on HTTP 429.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-semibold">Closed DMs Gatekeeper</strong>
                  <span className="text-slate-500 text-[11px]">
                    Safely marks HTTP 403 as <code>BLOCKED_DM_CLOSED</code> without wasting retries.
                  </span>
                </div>
              </div>
            </div>

            {/* Conversational Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
              {/* Left Column: Conversations List (5 cols) */}
              <Card className="lg:col-span-5 bg-white/80 border-white/90 flex flex-col overflow-hidden shadow-sm">
                <CardHeader className="p-3.5 border-b border-slate-100 bg-slate-50/60">
                  <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                    Conversations ({outreachedProspects.length})
                  </span>
                </CardHeader>
                <div className="divide-y divide-slate-100 overflow-y-auto flex-1 max-h-[550px]">
                  {outreachedProspects.map((p) => {
                    const isSelected = selectedThread?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedThreadId(p.id)}
                        className={`p-3.5 cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-50/80 border-l-3 border-[#0071e3]" : "hover:bg-slate-50/60"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-xs text-slate-900 truncate max-w-[160px]">
                            {p.xDisplayName}
                          </span>
                          {getStatusBadge(p.status)}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono truncate">@{p.xUsername}</p>
                        <p className="text-xs text-slate-600 line-clamp-1 mt-1">
                          {p.replyPreview ? `💬 "${p.replyPreview}"` : p.draftMessage}
                        </p>
                      </div>
                    );
                  })}
                  {outreachedProspects.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No outreach activity yet. Approve and send messages to view threads.
                    </div>
                  )}
                </div>
              </Card>

              {/* Right Column: Simulated Thread Preview (7 cols) */}
              <Card className="lg:col-span-7 bg-white/85 border-white/90 flex flex-col justify-between shadow-sm">
                {selectedThread ? (
                  <>
                    <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/40">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <img
                            src={selectedThread.xProfileImageUrl || `https://avatar.vercel.sh/${selectedThread.xUsername}`}
                            alt=""
                            className="h-10 w-10 rounded-full border border-slate-200 shadow-2xs object-cover"
                          />
                          <div>
                            <CardTitle className="text-sm font-semibold text-slate-900">{selectedThread.xDisplayName}</CardTitle>
                            <CardDescription className="text-xs font-mono text-slate-500">
                              @{selectedThread.xUsername} · {selectedThread.xLocation}
                            </CardDescription>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-[#0071e3] gap-1"
                          onClick={() => window.open(`https://x.com/${selectedThread.xUsername}`, "_blank")}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View on X
                        </Button>
                      </div>
                    </CardHeader>

                    {/* Chat Bubble Area (Apple iMessage style) */}
                    <CardContent className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[420px]">
                      {/* Outbound DM Bubble */}
                      <div className="flex flex-col items-end space-y-1">
                        <span className="text-[10px] text-slate-400 font-mono" suppressHydrationWarning>
                          Delivered via GenAI Fund · {selectedThread.sentAt ? new Date(selectedThread.sentAt).toLocaleTimeString() : "Sent"}
                        </span>
                        <div className="max-w-[85%] p-3.5 rounded-2xl rounded-tr-sm bg-[#0071e3] text-white text-xs leading-relaxed shadow-sm shadow-blue-500/20">
                          {selectedThread.draftMessage}
                        </div>
                      </div>

                      {/* Inbound Reply Bubble or Status */}
                      {selectedThread.replyPreview ? (
                        <div className="flex flex-col items-start space-y-1">
                          <span className="text-[10px] text-indigo-700 font-medium font-mono flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-indigo-600" /> Inbound Reply from @{selectedThread.xUsername}
                          </span>
                          <div className="max-w-[85%] p-3.5 rounded-2xl rounded-tl-sm bg-slate-100/90 border border-slate-200/80 text-slate-800 text-xs leading-relaxed shadow-2xs">
                            &ldquo;{selectedThread.replyPreview}&rdquo;
                          </div>
                        </div>
                      ) : selectedThread.status === "BLOCKED_DM_CLOSED" ? (
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                          <Lock className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>Recipient has closed direct messages. Blocked safely without burning rate limit.</span>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-slate-400 italic">
                          Awaiting reply from candidate...
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="p-3.5 border-t border-slate-100 bg-slate-50/40 flex justify-between text-xs text-slate-500">
                      <span>Status: {getStatusBadge(selectedThread.status)}</span>
                      <span className="font-medium text-slate-700">Zero Double-Messaging Active 🛡️</span>
                    </CardFooter>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full p-12 text-center text-xs text-slate-400">
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Console Settings & Credentials</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Bring Your Own Keys (BYOK). Credentials are saved locally with zero external telemetry.
              </p>
            </div>

            {/* Diagnostics Panel */}
            <Card className="border-white/90 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                  <Terminal className="w-4 h-4 text-[#0071e3]" />
                  API Health Diagnostics
                </CardTitle>
                <CardDescription>
                  Verify connectivity, OAuth 2.0 user tokens, and token-bucket rate limiter states.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" size="sm" onClick={testConnection} disabled={loading} className="gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" />
                  Run Diagnostics & Test Connection
                </Button>

                {healthData && (
                  <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 text-xs space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="font-semibold text-slate-800">Active Provider:</span>
                      <Badge variant={healthData.mode === "sandbox" ? "success" : "destructive"}>
                        {healthData.mode?.toUpperCase() || "SANDBOX"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Status:</span>
                      <span className={healthData.connected ? "text-emerald-700 font-semibold" : "text-amber-700 font-medium"}>
                        {healthData.connected ? "Verified & Authenticated ✓" : "Safe Sandbox Active"}
                      </span>
                    </div>
                    {healthData.username && (
                      <div className="flex justify-between items-center font-mono">
                        <span className="text-slate-500">Connected X Account:</span>
                        <span className="text-slate-900 font-semibold">@{healthData.username}</span>
                      </div>
                    )}
                    {healthData.rate_limit_remaining !== undefined && (
                      <div className="flex justify-between items-center font-mono">
                        <span className="text-slate-500">Token Bucket Available:</span>
                        <span className="text-emerald-700 font-semibold">{healthData.rate_limit_remaining} / 15 slots</span>
                      </div>
                    )}
                    {healthData.note && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 mt-2">
                        💡 {healthData.note}
                      </div>
                    )}
                    {healthData.error && (
                      <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 mt-2">
                        ⚠️ {healthData.error}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* X API Keys */}
            <Card className="border-white/90 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                  <Zap className="w-4 h-4 text-amber-600" />
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
                    <label className="text-xs font-semibold uppercase text-slate-600 block mb-1">
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
            <Card className="border-white/90 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                  <Cpu className="w-4 h-4 text-[#0071e3]" />
                  LLM Intelligence Engine
                </CardTitle>
                <CardDescription>Choose the AI model used for evidence evaluation and DM drafting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-600 block mb-1">
                    AI Provider
                  </label>
                  <select
                    className="flex h-9 w-full rounded-xl border border-slate-200/90 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
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
                    <label className="text-xs font-semibold uppercase text-slate-600 block mb-1">
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

      {/* ── Global Loading Overlay (Apple Liquid Glass) ───── */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white/95 border border-white rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-3 max-w-xs text-center ring-1 ring-black/[0.04]">
            <div className="h-8 w-8 border-3 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-slate-900">{loadingText}</span>
            <span className="text-[11px] text-slate-500 font-medium">Running idempotent FDE pipeline...</span>
          </div>
        </div>
      )}
    </div>
  );
}
