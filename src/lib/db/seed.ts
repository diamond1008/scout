/**
 * Seed script — run with: npm run db:seed
 *
 * Populates SQLite with a flagship GenAI Fund target campaign
 * and initial discovered / scored prospects from our curated SEA seed dataset.
 */

import { db } from "./index";
import { campaigns, prospects } from "./schema";
import seedProfiles from "../../data/seed-profiles.json";

async function seed() {
  console.log("🌱 Seeding database for GenAI Fund Outreach Console...\n");

  const campaignId = crypto.randomUUID();

  // 1. Create flagship GenAI Fund campaign
  db.insert(campaigns)
    .values({
      id: campaignId,
      name: "SEA AI & Robotics Builders 2026",
      description:
        "Pre-seed to Series A discovery for AI infrastructure, embodied robotics, developer tools, and agentic workflows across Southeast Asia (SG, VN, ID, TH, MY, PH).",
      keywords: ["embodied AI", "robotics", "LLM infra", "developer tools"],
      seedHandles: ["@jane_robotics", "@aditya_llminfra", "@linh_devtools", "@marco_autonomy"],
      mode: "sandbox",
      status: "active",
    })
    .run();

  console.log(`✅ Campaign created: 'SEA AI & Robotics Builders 2026' (${campaignId})`);

  // 2. Insert the curated seed profiles
  let inserted = 0;
  for (let i = 0; i < seedProfiles.length; i++) {
    const p = seedProfiles[i];

    // Seed first 4 as already SCORED/DRAFTED for immediate evaluator demo
    let status: any = "DISCOVERED";
    let fitScore: number | null = null;
    let fitReasoning: string | null = null;
    let evidenceSources: any = null;
    let draftMessage: string | null = null;

    if (i === 0) {
      status = "DRAFTED";
      fitScore = 0.94;
      fitReasoning =
        "Founder of RoboSEA building autonomous manipulation in Singapore.\nStrong technical pedigree (Ex-Google Brain, NUS PhD).\nActively shipping 94% grasping success rates and hiring ML engineers.";
      evidenceSources = [
        {
          type: "bio",
          quote: "Building autonomous manipulation at RoboSEA | Ex-Google Brain | NUS PhD | Singapore 🇸🇬",
          relevance: "Confirms founder role and SEA deeptech hub location.",
        },
        {
          type: "tweet",
          tweet_id: p.recent_tweets[0].tweet_id,
          quote: "Just shipped v2 of our grasping policy — 94% success rate on novel objects.",
          relevance: "Quantifiable progress in foundational robotic manipulation.",
        },
      ];
      draftMessage =
        "Hi Jane — your grasping policy benchmark (94% success on novel objects!) is super impressive. We're GenAI Fund, backing early-stage robotics & AI infra in SEA. Would love to hear where you're taking RoboSEA next — open to a quick intro chat?";
    } else if (i === 1) {
      status = "DRAFTED";
      fitScore = 0.91;
      fitReasoning =
        "Co-founder & CTO at InferenceHQ scaling low-latency GPU serving for SEA startups.\nServes 2B tokens/day; proven operational scale.\nPrior platform engineering leadership at Grab.";
      evidenceSources = [
        {
          type: "tweet",
          tweet_id: p.recent_tweets[0].tweet_id,
          quote: "InferenceHQ now serves 2B tokens/day across 15 SEA startups.",
          relevance: "Validates high regional market traction in AI infra.",
        },
      ];
      draftMessage =
        "Hi Aditya — congratulations on hitting 2B tokens/day at InferenceHQ! Regional latency optimization is a core thesis for us at GenAI Fund. Would love to learn more about your GPU orchestration roadmap over a brief call.";
    } else if (i === 2) {
      status = "SCORED";
      fitScore = 0.88;
      fitReasoning =
        "Founder @CodeForge in YC W26 building localized developer tools for Vietnam and SEA.\nProven customer traction with 5 enterprise teams onboarded.\nStrong engineering background from Shopee.";
      evidenceSources = [
        {
          type: "bio",
          quote: "Founder @CodeForge — AI code review for Vietnamese & SEA dev teams | YC W26",
          relevance: "Direct founder signal backed by top accelerator.",
        },
      ];
    } else if (i === 3) {
      status = "SCORED";
      fitScore = 0.85;
      fitReasoning =
        "Founder of DriveAI_PH pioneering autonomous delivery robots in Manila.\nFormer Tesla Autopilot engineer adapting autonomy to unstructured SEA traffic conditions.";
      evidenceSources = [
        {
          type: "tweet",
          tweet_id: p.recent_tweets[0].tweet_id,
          quote: "DriveAI's autonomous delivery bot completed 1,000 deliveries in BGC with zero human interventions.",
          relevance: "Demonstrated real-world deployment in Philippine urban logistics.",
        },
      ];
    }

    db.insert(prospects)
      .values({
        id: crypto.randomUUID(),
        campaignId,
        xUserId: p.x_user_id,
        xUsername: p.username,
        xDisplayName: p.display_name,
        xBio: p.bio,
        xProfileImageUrl: p.profile_image_url,
        xFollowerCount: p.follower_count,
        xLocation: p.location,
        xVerified: p.verified,
        recentTweets: p.recent_tweets,
        pinnedTweet: p.pinned_tweet,
        discoverySource: p.discovery_source,
        fitScore,
        fitReasoning,
        evidenceSources,
        draftMessage,
        draftEditedBy: draftMessage ? "llm" : null,
        status,
      })
      .run();

    inserted++;
  }

  console.log(`✅ ${inserted} profiles seeded from SEA dataset.`);
  console.log("\n🚀 Seeding finished successfully! Run 'npm run dev' to launch.");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
