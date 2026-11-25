"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
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
  AlertTriangle
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

const LLM_PROVIDER_CONFIGS = [
  {
    value: "gemini",
    label: "Google Gemini 3.5 Flash-Lite (Recommended)",
    description: "Fast multimodal reasoning & structured JSON scoring",
    keyName: "google_api_key",
    keyLabel: "Gemini API Key",
    placeholder: "AIzaSy...",
    helper: "Active for Google Gemini 3.5 Flash-Lite. Leave blank to keep Heuristic Sandbox ($0 fallback).",
  },
  {
    value: "openai",
    label: "OpenAI GPT-4o mini",
    description: "Strict JSON schema scoring & concise outreach drafting",
    keyName: "openai_api_key",
    keyLabel: "OpenAI API Key",
    placeholder: "sk-...",
    helper: "Active for OpenAI GPT-4o mini. Leave blank to keep Heuristic Sandbox ($0 fallback).",
  },
  {
    value: "anthropic",
    label: "Anthropic Claude Sonnet 4",
    description: "High-nuance personalized founder outreach & tone control",
    keyName: "anthropic_api_key",
    keyLabel: "Anthropic API Key",
    placeholder: "sk-ant-...",
    helper: "Active for Anthropic Claude Sonnet 4. Leave blank to keep Heuristic Sandbox ($0 fallback).",
  },
] as const;

const COUNTRY_FILTER_OPTIONS = [
  { value: "ALL", label: "All SEA Countries" },
  { value: "SG", label: "🇸🇬 Singapore" },
  { value: "VN", label: "🇻🇳 Vietnam" },
  { value: "ID", label: "🇮🇩 Indonesia" },
  { value: "TH", label: "🇹🇭 Thailand" },
  { value: "MY", label: "🇲🇾 Malaysia" },
  { value: "PH", label: "🇵🇭 Philippines" },
] as const;

const SCORE_FILTER_OPTIONS = [
  { value: "0", label: "All Scores" },
  { value: "0.7", label: "High Fit Only (≥ 70%)" },
  { value: "0.4", label: "Relevant (≥ 40%)" },
] as const;

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
  const [savedSettingHints, setSavedSettingHints] = useState<Record<string, string>>({});
  const [xLiveVerified, setXLiveVerified] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);

  // Review state
  const [reviewIndex, setReviewIndex] = useState(0);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);

  // Discovery inspection modal
  const [inspectProspect, setInspectProspect] = useState<Prospect | null>(null);

  // Discovery filters
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);

  // Tracker selected thread
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const list = (await res.json()) as { key: string; value: string; hasValue: boolean }[];
      const hints: Record<string, string> = {};
      let providerValue = "gemini";
      let verifiedFlag = false;
      for (const item of list) {
        if (item.key === "llm_provider" && item.value) {
          providerValue = item.value;
        } else if (item.key === "x_live_verified") {
          verifiedFlag = item.value === "true";
        } else if (item.hasValue) {
          hints[item.key] = item.value;
        }
      }
      setSavedSettingHints(hints);
      setXLiveVerified(verifiedFlag);
      setSettingsValues((prev) => ({ ...prev, llm_provider: prev.llm_provider || providerValue }));
    } catch (e) {
      console.error(e);
    }
  }, []);

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
    fetchSettings();
  }, [fetchCampaigns, fetchSettings]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchProspects(selectedCampaign.id);
    }
  }, [selectedCampaign, fetchProspects]);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 4500);
  };

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
      if (!res.ok) {
        showMsg(created.error || "Failed to create campaign");
        return;
      }
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
    if (targetMode === "live" && !xLiveVerified) {
      showMsg("Live X API is locked until both X tokens pass Test Connection in Settings.");
      setView("settings");
      return;
    }
    try {
      const res = await fetch(`/api/campaigns?id=${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: targetMode }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showMsg(errData.error || "Failed to switch campaign mode");
        return;
      }
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
      setXLiveVerified(Boolean(data.liveVerified));
      await fetchSettings();
      if (data.liveVerified) {
        showMsg("X API verified ✓ Live mode unlocked");
      } else if (data.mode === "sandbox") {
        showMsg("Safe Sandbox Active ($0) ✓");
      } else {
        showMsg(data.error || "X API verification failed");
      }
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
      if (!res.ok) {
        showMsg(data.error || "Discovery failed");
        return;
      }
      await fetchProspects(selectedCampaign.id);
      const added = data.discovered ?? data.added ?? 0;
      const skipped = data.skipped ?? 0;
      showMsg(`Discovered ${added} new candidates (${skipped} skipped by UNIQUE lock) ✓`);
    } catch {
      showMsg("Discovery failed");
    } finally {
      setLoading(false);
    }
  };

  const runScoring = async (prospectIds?: string[]) => {
    if (!selectedCampaign) return;
    setLoading(true);
    setLoadingText("Evaluating candidate fitness & extracting evidence...");
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selectedCampaign.id,
          ...(prospectIds?.length ? { prospectIds } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(data.error || "Scoring failed");
        return;
      }
      await fetchProspects(selectedCampaign.id);
      showMsg(`Qualified & scored ${data.scored ?? 0} profiles ✓`);
    } catch {
      showMsg("Scoring failed");
    } finally {
      setLoading(false);
    }
  };

  const runDrafting = async (minScore: number = 0.4, prospectIds?: string[]) => {
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
          ...(prospectIds?.length ? { prospectIds } : {}),
          sender: { fund_name: "GenAI Fund", sender_name: "GenAI Fund Team" },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(data.error || "Drafting failed");
        return;
      }
      await fetchProspects(selectedCampaign.id);
      showMsg(`Drafted ${data.drafted ?? 0} personalized DMs for review ✓`);
      if ((data.drafted ?? 0) > 0) {
        setView("review");
        setReviewIndex(0);
        setEditingDraft(null);
      }
    } catch {
      showMsg("Drafting failed");
    } finally {
      setLoading(false);
    }
  };

  const scoreAndDraftSingle = async (prospect: Prospect) => {
    if (!selectedCampaign) return;
    setLoading(true);
    setLoadingText(`Preparing draft DM for @${prospect.xUsername}...`);
    try {
      let currentStatus = prospect.status;
      if (currentStatus === "DISCOVERED") {
        const sRes = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: selectedCampaign.id, prospectIds: [prospect.id] }),
        });
        const sData = await sRes.json();
        if (!sRes.ok) {
          showMsg(sData.error || "Scoring failed");
          return;
        }
        const sItem = sData.results?.[0];
        if (sItem?.status === "error") {
          showMsg(sItem.error || "Scoring failed");
          return;
        }
        currentStatus = "SCORED";
      }

      if (currentStatus === "SCORED") {
        const dRes = await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: selectedCampaign.id,
            minScore: 0,
            prospectIds: [prospect.id],
            sender: { fund_name: "GenAI Fund", sender_name: "GenAI Fund Team" },
          }),
        });
        const dData = await dRes.json();
        if (!dRes.ok) {
          showMsg(dData.error || "Drafting failed");
          return;
        }
        const dItem = dData.results?.[0];
        if (dItem?.status === "error") {
          showMsg(dItem.errors?.[0] || "Drafting failed");
          return;
        }
      }

      const refreshedRes = await fetch(`/api/prospects?campaignId=${selectedCampaign.id}`);
      const refreshed = (await refreshedRes.json()) as Prospect[];
      setProspects(refreshed);
      const draftedList = refreshed.filter((p) => p.status === "DRAFTED");
      const targetIdx = draftedList.findIndex((p) => p.id === prospect.id);
      if (targetIdx >= 0) {
        setInspectProspect(null);
        setReviewIndex(targetIdx);
        setEditingDraft(null);
        setView("review");
        showMsg(`Draft ready for @${prospect.xUsername} ✓`);
      } else {
        const updatedSelf = refreshed.find((p) => p.id === prospect.id) || null;
        setInspectProspect(updatedSelf);
        showMsg(`Could not draft DM for @${prospect.xUsername} (status: ${updatedSelf?.status || "unknown"})`);
      }
    } catch {
      showMsg("Failed to prepare draft");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = useCallback(
    async (prospectId: string, action: "approve" | "reject") => {
      if (!selectedCampaign) return;
      try {
        if (action === "approve" && editingDraft !== null) {
          const editRes = await fetch("/api/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prospectId, action: "edit", editedMessage: editingDraft }),
          });
          if (!editRes.ok) {
            const err = await editRes.json();
            showMsg(err.error || "Failed to save draft edit");
            return;
          }
        }
        const res = await fetch("/api/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prospectId, action }),
        });
        if (!res.ok) {
          const err = await res.json();
          showMsg(err.error || "Approval action failed");
          return;
        }
        await fetchProspects(selectedCampaign.id);
        setEditingDraft(null);
        showMsg(action === "approve" ? "Approved & queued for safe send ✓" : "Candidate rejected ✗");
      } catch {
        showMsg("Request failed");
      }
    },
    [selectedCampaign, editingDraft, fetchProspects]
  );

  // ── Keyboard shortcuts for Review Queue ───────────────────
  useEffect(() => {
    if (view !== "review") return;
    const drafted = prospects.filter((p) => p.status === "DRAFTED");
    const safeIdx = Math.min(reviewIndex, Math.max(0, drafted.length - 1));
    const current = drafted[safeIdx];
    if (!current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["TEXTAREA", "INPUT", "SELECT"].includes((e.target as HTMLElement).tagName)) {
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
        setEditingDraft(null);
        setReviewIndex((prev) => Math.min(prev + 1, Math.max(0, drafted.length - 1)));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setEditingDraft(null);
        setReviewIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, reviewIndex, prospects, handleApproval]);

  const sendApproved = async () => {
    if (!selectedCampaign) return;
    const approvedCount = prospects.filter((p) => ["APPROVED", "FAILED_RETRYABLE"].includes(p.status)).length;
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
      if (!res.ok) {
        showMsg(data.error || "Send execution failed");
        return;
      }
      await fetchProspects(selectedCampaign.id);
      const sentCount = data.results?.filter((r: { status: string }) => r.status.startsWith("SENT")).length || 0;
      const blockedCount = data.results?.filter((r: { status: string }) => r.status === "BLOCKED_DM_CLOSED").length || 0;
      showMsg(
        `Sent ${sentCount} / ${data.total} DMs` +
          (blockedCount > 0 ? ` (${blockedCount} DMs closed)` : " (Zero duplicates)") +
          " ✓"
      );
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
      if (!res.ok) {
        showMsg(data.error || "Failed to sync replies");
        return;
      }
      await fetchProspects(selectedCampaign.id);
      showMsg(data.message || `Synced ${data.updated ?? 0} inbound replies ✓`);
    } catch {
      showMsg("Failed to sync replies");
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        showMsg("Failed to save setting");
        return;
      }
      await fetchSettings();
      showMsg(`${key} saved securely ✓`);
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
    const approved = prospects.filter((p) => ["APPROVED", "FAILED_RETRYABLE"].includes(p.status)).length;
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
  const safeReviewIndex = Math.min(reviewIndex, Math.max(0, draftedProspects.length - 1));
  const currentReview = draftedProspects[safeReviewIndex] || null;

  const activeDraftText = currentReview
    ? editingDraft ?? currentReview.draftMessage ?? ""
    : "";

  const liveGuardrails = useMemo(() => {
    if (!currentReview) {
      return {
        hasEvidence: false,
        noFamiliarity: true,
        noCliches: true,
        withinLimit: true,
        needsReviewFlag: false,
      };
    }
    const lower = activeDraftText.toLowerCase();
    const banned = [
      "pick your brain",
      "stumbled upon",
      "came across your amazing",
      "thought leader",
      "synergy",
      "circle back",
      "low-hanging fruit",
      "touch base",
      "deep dive into",
      "leverage your expertise",
      "paradigm shift",
      "move the needle",
      "i'm a huge fan",
      "i've been following your work",
    ];
    const fam = [
      /we met at/i,
      /great meeting you/i,
      /as we discussed/i,
      /as per our conversation/i,
      /following up on our/i,
      /nice to meet you at/i,
      /remember when we/i,
    ];
    const hasEvidence =
      Boolean(currentReview.evidenceSources && currentReview.evidenceSources.length > 0) &&
      activeDraftText.trim().length > 20 &&
      lower.includes("genai");
    const noCliches = !banned.some((b) => lower.includes(b));
    const noFamiliarity = !fam.some((rx) => rx.test(activeDraftText));
    const withinLimit = activeDraftText.trim().length > 0 && activeDraftText.length <= 500;
    const needsReviewFlag = activeDraftText.startsWith("[NEEDS REVIEW]");
    return { hasEvidence, noFamiliarity, noCliches, withinLimit, needsReviewFlag };
  }, [currentReview, activeDraftText]);

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
        (countryFilter === "VN" && (p.xLocation?.includes("Vietnam") || p.xLocation?.includes("VN") || p.xLocation?.includes("Hanoi") || p.xLocation?.includes("Saigon") || p.xLocation?.includes("Ho Chi Minh"))) ||
        (countryFilter === "ID" && (p.xLocation?.includes("Indonesia") || p.xLocation?.includes("Jakarta") || p.xLocation?.includes("Bandung"))) ||
        (countryFilter === "TH" && (p.xLocation?.includes("Thailand") || p.xLocation?.includes("Bangkok"))) ||
        (countryFilter === "MY" && (p.xLocation?.includes("Malaysia") || p.xLocation?.includes("Kuala Lumpur"))) ||
        (countryFilter === "PH" && (p.xLocation?.includes("Philippines") || p.xLocation?.includes("Manila") || p.xLocation?.includes("BGC") || p.xLocation?.includes("PH")));

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
    return null;
  }

  return (
    <div className="min-h-screen text-slate-900 flex flex-col font-sans relative" suppressHydrationWarning>
      {/* Apple Liquid Glass Ambient Glow Orbs */}
      <div className="fixed -top-40 -left-40 w-[550px] h-[550px] bg-gradient-to-br from-blue-300/20 via-sky-200/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/4 -right-40 w-[600px] h-[600px] bg-gradient-to-bl from-indigo-200/20 via-purple-100/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed -bottom-40 left-1/4 w-[700px] h-[700px] bg-gradient-to-tr from-sky-200/20 via-blue-100/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      {/* ── Toast Notification ────────────────────────────── */}
      {message && (
        <div className="fixed top-5 right-6 z-[70] bg-white/95 border border-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.12)] rounded-2xl px-4 py-3 text-sm flex items-center gap-2.5 animate-in slide-in-from-top-4 backdrop-blur-2xl ring-1 ring-black/[0.06]">
          <div className="h-2 w-2 rounded-full bg-[#0071e3] animate-ping" />
          <span className="font-medium text-slate-800">{message}</span>
        </div>
      )}

      {/* ── Apple Liquid Glass Top Navigation ────────────── */}
      <header className="border-b border-white/60 bg-white/70 backdrop-blur-2xl sticky top-0 z-40 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 xl:py-0 xl:h-16 flex flex-wrap xl:flex-nowrap items-center justify-between gap-x-4 gap-y-2.5">
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

          {/* Segmented Pill Navigation - wraps cleanly below xl, scrollable on narrow viewports */}
          <nav className="order-3 xl:order-2 w-full xl:w-auto flex items-center overflow-x-auto max-w-full">
            <div className="flex items-center gap-1 bg-slate-200/50 backdrop-blur-xl p-1 rounded-2xl border border-white/80 shadow-inner mx-auto flex-nowrap">
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
                  className={`flex items-center gap-1.5 px-3 xl:px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
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
            </div>
          </nav>

          {/* Active Campaign / Mode Indicator */}
          <div className="order-2 xl:order-3 flex items-center gap-3 shrink-0">
            {selectedCampaign && (
              <div className="flex items-center gap-2 border border-white/80 rounded-2xl px-2.5 sm:px-3 py-1.5 bg-white/70 backdrop-blur-md shadow-2xs text-xs whitespace-nowrap shrink-0">
                <span className="hidden sm:inline text-slate-500 whitespace-nowrap">Radar:</span>
                <span className="hidden sm:inline font-semibold text-slate-900 truncate max-w-[110px] xl:max-w-[130px] whitespace-nowrap">
                  {selectedCampaign.name}
                </span>
                <button
                  onClick={(e) => toggleCampaignMode(selectedCampaign, e)}
                  title={
                    selectedCampaign.mode === "sandbox"
                      ? xLiveVerified
                        ? "Click to switch to Live X API"
                        : "Live X API locked — verify X tokens in Settings first"
                      : "Click to switch back to Safe Sandbox ($0)"
                  }
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
              <Button onClick={() => setShowCreate(!showCreate)} className="shadow-md">
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
                        onClick={() => {
                          if (!xLiveVerified) {
                            showMsg("Verify both X tokens in Settings first to unlock Live X API mode.");
                          }
                        }}
                        className={`flex items-start gap-3 p-3.5 border rounded-2xl transition-all ${
                          !xLiveVerified
                            ? "border-slate-200/70 bg-slate-50/70 opacity-80 cursor-not-allowed"
                            : newMode === "live"
                            ? "border-[#0071e3] bg-blue-50/60 ring-2 ring-blue-500/20 cursor-pointer"
                            : "border-slate-200/80 bg-white/70 hover:bg-white cursor-pointer"
                        }`}
                      >
                        <input
                          type="radio"
                          name="campaign_mode"
                          value="live"
                          checked={newMode === "live"}
                          disabled={!xLiveVerified}
                          onChange={() => {
                            if (xLiveVerified) setNewMode("live");
                          }}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <Zap className="w-4 h-4 text-amber-600" />
                            Live X API v2 (BYOK Mode)
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                xLiveVerified
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {xLiveVerified ? "Verified ✓" : "Locked — Verify X in Settings"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Connects directly to X API v2 endpoints with Token-Bucket rate limiting (15 DMs/15 min). Requires passing Test Connection with both X tokens in Settings.
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
                          title={
                            c.mode === "sandbox"
                              ? xLiveVerified
                                ? "Click to switch to Live X API"
                                : "Live X API locked — verify X tokens in Settings first"
                              : "Click to switch back to Sandbox"
                          }
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
                >
                  Index Candidates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runScoring()}
                  disabled={!selectedCampaign || loading || stats.discovered === 0}
                  className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                >
                  Run Fit Scoring
                </Button>
                <Button
                  size="sm"
                  onClick={() => runDrafting(0.4)}
                  disabled={!selectedCampaign || loading || stats.scored === 0}
                  className="shadow-md"
                >
                  Draft DMs (Fit ≥ 40%)
                </Button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="relative z-20 flex flex-col sm:flex-row items-center gap-3 bg-white/70 p-3 rounded-2xl border border-white/80 shadow-2xs backdrop-blur-xl">
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
                <Select
                  ariaLabel="Filter by country"
                  value={countryFilter}
                  onChange={setCountryFilter}
                  options={COUNTRY_FILTER_OPTIONS}
                  className="flex-1 sm:w-[175px]"
                  menuClassName="min-w-[190px] right-0 left-auto sm:left-0 sm:right-auto"
                />

                <Select
                  ariaLabel="Filter by fit score"
                  value={String(minScoreFilter)}
                  onChange={(val) => setMinScoreFilter(parseFloat(val))}
                  options={SCORE_FILTER_OPTIONS}
                  className="flex-1 sm:w-[195px]"
                  menuClassName="min-w-[210px] right-0 left-auto"
                />
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
                    <div className="flex items-center gap-2">
                      {(inspectProspect.status === "DISCOVERED" || inspectProspect.status === "SCORED") && (
                        <Button
                          size="sm"
                          onClick={() => scoreAndDraftSingle(inspectProspect)}
                          disabled={loading}
                        >
                          {inspectProspect.status === "DISCOVERED" ? "Score & Draft DM" : "Draft DM"}
                        </Button>
                      )}
                      {inspectProspect.status === "DRAFTED" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            const idx = draftedProspects.findIndex((p) => p.id === inspectProspect.id);
                            setReviewIndex(idx >= 0 ? idx : 0);
                            setEditingDraft(null);
                            setInspectProspect(null);
                            setView("review");
                          }}
                        >
                          Open in Review Queue
                        </Button>
                      )}
                      {["SENT", "SENT_SANDBOX", "REPLIED", "BLOCKED_DM_CLOSED", "APPROVED"].includes(inspectProspect.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedThreadId(inspectProspect.id);
                            setInspectProspect(null);
                            setView("tracker");
                          }}
                        >
                          View in Tracker
                        </Button>
                      )}
                    </div>
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
                className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
              >
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
                            Reviewing {safeReviewIndex + 1} of {draftedProspects.length} in queue
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
                        <span
                          className={`font-mono font-medium ${
                            activeDraftText.length > 500
                              ? "text-rose-600"
                              : activeDraftText.length > 280
                              ? "text-amber-600"
                              : "text-slate-500"
                          }`}
                        >
                          {activeDraftText.length} / 280 chars (max 500)
                        </span>
                      </div>

                      {liveGuardrails.needsReviewFlag && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                          <span>Flagged <strong>[NEEDS REVIEW]</strong> by post-LLM guardrail. Please verify before approving.</span>
                        </div>
                      )}

                      {/* Textarea */}
                      <Textarea
                        rows={7}
                        value={activeDraftText}
                        onChange={(e) => setEditingDraft(e.target.value)}
                        className="font-sans text-sm leading-relaxed bg-slate-50/70 border-slate-200/90 focus:bg-white text-slate-900"
                        placeholder="Draft message will appear here..."
                      />

                      {/* Live Guardrail Checklist */}
                      <div
                        className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                          liveGuardrails.hasEvidence &&
                          liveGuardrails.noFamiliarity &&
                          liveGuardrails.noCliches &&
                          liveGuardrails.withinLimit &&
                          !liveGuardrails.needsReviewFlag
                            ? "border-emerald-200/70 bg-emerald-50/40"
                            : "border-amber-200/80 bg-amber-50/40"
                        }`}
                      >
                        <div className="font-semibold text-slate-700 text-[10px] uppercase tracking-wider mb-1">
                          Automated FDE Guardrail Verification
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <span className={`flex items-center gap-1.5 font-medium ${liveGuardrails.hasEvidence ? "text-emerald-700" : "text-amber-700"}`}>
                            {liveGuardrails.hasEvidence ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                            Verbatim evidence cited
                          </span>
                          <span className={`flex items-center gap-1.5 font-medium ${liveGuardrails.noFamiliarity ? "text-emerald-700" : "text-rose-700"}`}>
                            {liveGuardrails.noFamiliarity ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            Zero invented familiarity
                          </span>
                          <span className={`flex items-center gap-1.5 font-medium ${liveGuardrails.noCliches ? "text-emerald-700" : "text-rose-700"}`}>
                            {liveGuardrails.noCliches ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            No recruiter/sales clichés
                          </span>
                          <span className={`flex items-center gap-1.5 font-medium ${liveGuardrails.withinLimit ? "text-emerald-700" : "text-rose-700"}`}>
                            {liveGuardrails.withinLimit ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            Length & anti-duplicate OK
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
                        setEditingDraft(null);
                        setReviewIndex(Math.min(safeReviewIndex + 1, Math.max(0, draftedProspects.length - 1)));
                      }}
                      className="gap-1.5"
                    >
                      Skip [Space]
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleApproval(currentReview.id, "reject")}
                      >
                        Reject [R]
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproval(currentReview.id, "approve")}
                        className="bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-sm shadow-blue-500/25"
                      >
                        Approve & Queue [A]
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
              <Button variant="outline" size="sm" onClick={syncReplies} disabled={!selectedCampaign || loading}>
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
          <div className="max-w-3xl space-y-6 pb-20">
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
                <Button variant="outline" size="sm" onClick={testConnection} disabled={loading}>
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
                      <span
                        className={
                          healthData.connected
                            ? "text-emerald-700 font-semibold"
                            : "text-amber-700 font-medium"
                        }
                      >
                        {healthData.mode === "sandbox"
                          ? "Safe Sandbox Active ✓"
                          : healthData.connected
                          ? "Verified & Authenticated ✓"
                          : "Live Credentials Failed / Incomplete"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Live X Mode Gate:</span>
                      <span
                        className={
                          xLiveVerified
                            ? "text-emerald-700 font-semibold"
                            : "text-amber-700 font-medium"
                        }
                      >
                        {xLiveVerified ? "Unlocked ✓" : "Locked (Requires verified X tokens)"}
                      </span>
                    </div>
                    {healthData.username && (
                      <div className="flex justify-between items-center font-mono">
                        <span className="text-slate-500">Connected X Account:</span>
                        <span className="text-slate-900 font-semibold">@{healthData.username}</span>
                      </div>
                    )}
                    {(healthData.rate_limit_remaining !== undefined || healthData.endpoints?.dm_send?.remaining !== undefined) && (
                      <div className="flex justify-between items-center font-mono">
                        <span className="text-slate-500">Token Bucket Available:</span>
                        <span className="text-emerald-700 font-semibold">
                          {healthData.rate_limit_remaining ?? healthData.endpoints?.dm_send?.remaining} / 15 slots
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center font-mono">
                      <span className="text-slate-500">LLM Intelligence Engine:</span>
                      <span className="text-slate-900 font-semibold">
                        {healthData.hasLLMKey ? `Live (${healthData.llmProvider || "gemini"})` : "Heuristic Sandbox ($0 fallback)"}
                      </span>
                    </div>
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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                    <Zap className="w-4 h-4 text-amber-600" />
                    X (Twitter) API v2 Configuration
                  </CardTitle>
                  <Badge variant={xLiveVerified ? "success" : "secondary"}>
                    {xLiveVerified ? "Live Mode Unlocked ✓" : "Live Mode Locked"}
                  </Badge>
                </div>
                <CardDescription>
                  Required only for Live mode. Save both tokens below, then pass Run Diagnostics &amp; Test Connection above to unlock Live X API.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "x_bearer_token", label: "Bearer Token", placeholder: "AAAAAAAAAAAAAAAAAAAAA..." },
                  { key: "x_access_token", label: "User OAuth 2.0 Access Token", placeholder: "User context token for DM sending" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold uppercase text-slate-600">
                        {label}
                      </label>
                      {savedSettingHints[key] && (
                        <span className="text-[11px] font-mono text-emerald-700 font-medium">
                          Configured ({savedSettingHints[key]}) ✓
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={savedSettingHints[key] ? `Saved (${savedSettingHints[key]}) — enter new value to update` : placeholder}
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
            <Card className="border-white/90 bg-white/80 shadow-sm relative z-10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                  <Cpu className="w-4 h-4 text-[#0071e3]" />
                  LLM Intelligence Engine
                </CardTitle>
                <CardDescription>Choose the AI model used for evidence evaluation and DM drafting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const selectedProviderId = settingsValues.llm_provider || "gemini";
                  const activeProvider =
                    LLM_PROVIDER_CONFIGS.find((p) => p.value === selectedProviderId) || LLM_PROVIDER_CONFIGS[0];
                  const providerOptions = LLM_PROVIDER_CONFIGS.map((p) => ({
                    value: p.value,
                    label: p.label,
                    description: p.description,
                    badge: savedSettingHints[p.keyName] ? "Saved ✓" : undefined,
                  }));
                  const savedHint = savedSettingHints[activeProvider.keyName];

                  return (
                    <>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 block mb-1.5">
                          AI Provider
                        </label>
                        <Select
                          ariaLabel="Select AI Provider"
                          value={activeProvider.value}
                          onChange={(val) => {
                            setSettingsValues((prev) => ({ ...prev, llm_provider: val }));
                            saveSetting("llm_provider", val);
                          }}
                          options={providerOptions}
                        />
                      </div>

                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4 space-y-2.5 shadow-2xs transition-all">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                            {activeProvider.keyLabel}
                          </label>
                          {savedHint ? (
                            <span className="text-[11px] font-mono text-emerald-700 font-medium px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70">
                              Configured ({savedHint}) ✓
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-500 px-2 py-0.5 rounded-full bg-white border border-slate-200/80">
                              Sandbox Fallback ($0)
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder={
                              savedHint
                                ? `Saved (${savedHint}) — enter new value to update`
                                : activeProvider.placeholder
                            }
                            value={settingsValues[activeProvider.keyName] || ""}
                            onChange={(e) =>
                              setSettingsValues((prev) => ({
                                ...prev,
                                [activeProvider.keyName]: e.target.value,
                              }))
                            }
                            className="font-mono text-xs bg-white"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              saveSetting(
                                activeProvider.keyName,
                                settingsValues[activeProvider.keyName] || ""
                              )
                            }
                          >
                            Save
                          </Button>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {activeProvider.helper}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* ── Global Loading Overlay (Apple Liquid Glass) ───── */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-md flex items-center justify-center z-[60] animate-in fade-in">
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
