// api/rewrite.js — Vercel Serverless Function (ES module)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { bullet, acronyms, unit } = req.body;

  if (!bullet || !acronyms) {
    return res.status(400).json({ error: "Missing bullet or acronyms." });
  }

  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();

  // ── Step 1: Fetch FULL Wikipedia article for the unit ────────────────────
  let unitMission = "";
  let unitMissionFull = "";
  if (unit && unit.trim()) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(unit.trim())}&format=json&origin=*`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      const topResult = searchData?.query?.search?.[0];

      if (topResult) {
        const pageTitle = topResult.title;
        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts&explaintext=true&format=json&origin=*`;
        const extractRes = await fetch(extractUrl);
        const extractData = await extractRes.json();
        const pages = extractData?.query?.pages;
        const page = pages ? Object.values(pages)[0] : null;
        const fullText = page?.extract || "";

        unitMissionFull = fullText.length > 4000
          ? fullText.substring(0, 4000) + "..."
          : fullText;

        unitMission = fullText.length > 600
          ? fullText.substring(0, 600) + "..."
          : fullText;
      }
    } catch (e) {
      console.error("Wikipedia fetch error:", e);
      unitMission = "";
      unitMissionFull = "";
    }
  }

  // ── Step 2: Build approved acronym list ──────────────────────────────────
  const acronymList = Object.entries(acronyms)
    .map(([phrase, abbr]) => `"${phrase}" → ${abbr}`)
    .join("\n");

  // ── Step 3: Build system prompt ──────────────────────────────────────────
  const missionContext = unitMissionFull
    ? `UNIT: ${unit}

FULL UNIT WIKIPEDIA ARTICLE:
${unitMissionFull}`
    : unit
    ? `UNIT: ${unit}
No Wikipedia article found. Use general military context for this unit.`
    : "";

  const systemPrompt = `You are an elite US military EPR/OPR (Enlisted/Officer Performance Report) bullet writer with 20 years of experience writing bullets that get Airmen and Guardians promoted.

${missionContext}

YOUR TASK:
Create/Rewrite the given EPR/OPR bullet to be concise, punchy, and packed with specific measurable impact. It should have measurable effects behind each claim. The bullet can be no more than 120 characters. Study the unit's Wikipedia article carefully and tie the result directly to what this unit specifically does — its systems, missions, readiness posture, or strategic role.

BULLET ANATOMY — every great bullet has three parts:
1. ACTION — what did the member DO? (strong past-tense verb, specific scope)
2. RESULT — what was the measurable outcome? (numbers, percentages, rankings, dollar amounts, time saved)
3. IMPACT — why does it matter to Higher Headquarters/Congress what you have done? (not generic — tied to the unit's real role; Has to be relevant to your mission)

FORMATTING STYLE — study these real examples carefully and match their style exactly:
- "Led 13 prsnl in historic, 104-item launch; integrated 3 tactics/6 sites--deliver'd 1st-track orbital data f/8 int'l partners"
- "Created inaugural prog; coord'd w/8 sqs/5 mths/lvl'd social barrier f/569 jr enl--lauded by 9 RW & MSG/awarded BTZ"
- "Eliminated 200 discrepancies f/4 MQT scripts; guaranteed accurate, realistic training--enabled proficiency of 42 mbrs"
- "Led trng f/22 mbrs on C2 sys; zero errors during ORI--validated unit's crit role in ICBM launch authority chain"
- "Spearheaded UCI prep f/45 prsnl; briefed 3 discrepancies/resolved in 24 hrs--sq rated Outstanding/1 of 6 in NAF"
- "Managed $1.2M equip acct; zero losses/100% accountability--enabled uninterrupted MW ops f/USNORTHCOM"
- "Coord'd SATCOM upgrades across 3 sites; eliminated 14-hr outage risk--preserved GPS signal integrity f/2B+ users"
- "Authored 6 SOPs f/OPIR data handling; adopted wing-wide--strengthened 24/7 MW alert posture IAW USSTRATCOM G&I"

KEY STYLE RULES — match these exactly:
- Use "f/" instead of "for"
- Use "w/" instead of "with"
- Use "--" (double dash) before the impact statement
- Slash "/" to chain related items together (e.g. "zero losses/100% accountability")
- Include real numbers wherever possible (people, dollars, percentages, time, rankings)
- Drop all articles ("a", "an", "the") everywhere
- Semicolons to separate action from result
- Exclamation mark "!" at the end only for exceptional results (BTZ, DG, #1 of many)
- Keep it to ONE line

BANNED ENDINGS — never use these generic phrases:
- "for CONUS defense"
- "for national security"  
- "for the mission"
- "ensured unit readiness"
- "supported unit operations"
- "enhanced mission capability"

The impact MUST reference something specific to this unit — a strategic role it fills, or a named higher command it supports.

APPROVED ACRONYM/ABBREVIATION LIST:
${acronymList}`;

  // ── Step 4: Call the LLM ─────────────────────────────────────────────────
  try {
    let rewritten = "";

    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not set." });

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Rewrite this bullet:\n"${bullet}"` },
          ],
          max_tokens: 256,
          temperature: 0.7,
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        return res.status(500).json({ error: e.error?.message || "OpenAI request failed." });
      }
      const d = await r.json();
      rewritten = d.choices?.[0]?.message?.content?.trim() || "";

    } else if (provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set." });

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 256,
          system: systemPrompt,
          messages: [{ role: "user", content: `Rewrite this bullet:\n"${bullet}"` }],
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        return res.status(500).json({ error: e.error?.message || "Anthropic request failed." });
      }
      const d = await r.json();
      rewritten = d.content?.[0]?.text?.trim() || "";

    } else if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not set." });

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${systemPrompt}\n\nRewrite this bullet:\n"${bullet}"\n\nIMPORTANT: Match the style of the examples exactly — use f/, w/, --, slashes, real numbers, and a unit-specific impact. No generic endings.`
              }]
            }],
            generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
          }),
        }
      );
      if (!r.ok) {
        const e = await r.json();
        return res.status(500).json({ error: e.error?.message || "Gemini request failed." });
      }
      const d = await r.json();
      rewritten = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    } else {
      return res.status(500).json({ error: `Unknown LLM_PROVIDER: "${provider}"` });
    }

    if (!rewritten) return res.status(500).json({ error: "LLM returned empty response." });

    return res.status(200).json({ rewritten, unitMission });

  } catch (err) {
    console.error("Rewrite error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};
