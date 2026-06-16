// api/rewrite.js — Vercel Serverless Function (ES module)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { bullet, acronyms, unit, outputMode } = req.body;
  const isNarrative = outputMode === "narrative";

  if (!bullet || !acronyms) {
    return res.status(400).json({ error: "Missing bullet or acronyms." });
  }

  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();

  // ── Step 1: Wikipedia as baseline context ────────────────────────────────
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

        unitMissionFull = fullText.length > 3000
          ? fullText.substring(0, 3000) + "..."
          : fullText;

        unitMission = fullText.length > 600
          ? fullText.substring(0, 600) + "..."
          : fullText;
      }
    } catch (e) {
      console.error("Wikipedia fetch error:", e);
    }
  }

  // ── Step 2: Build approved acronym list ──────────────────────────────────
  const acronymList = Object.entries(acronyms)
    .map(([phrase, abbr]) => `"${phrase}" → ${abbr}`)
    .join("\n");

  // ── Step 3: Build prompt ──────────────────────────────────────────────────
  const wikiContext = unitMissionFull
    ? `UNIT WIKIPEDIA CONTEXT FOR ${unit}:\n${unitMissionFull}\n\n`
    : "";

  const unitInstruction = unit && unit.trim()
    ? `The member's unit is: ${unit}\n\n${wikiContext}Use the unit context above to make the impact as specific and powerful as possible — naming real systems, commands, asset values, or outcomes tied to this unit's actual mission.`
    : "";

  const narrativeSystemPrompt = `You are an elite US military EPR/OPR narrative writer with 20 years of experience writing narratives that get Airmen and Guardians promoted.

${unitInstruction}

YOUR TASK:
Expand the given bullet or notes into a polished EPR narrative paragraph of 4-6 sentences.

NARRATIVE RULES:
1. Open with the member's most impactful action or achievement
2. Describe scope, scale, and complexity — use numbers, people, systems, timeframes
3. Explain the direct result and its significance to the unit's specific mission
4. Close with a strong promotion recommendation or senior rater endorsement
5. Write in third person; be specific — no generic filler phrases
6. Use approved acronyms from the list below where appropriate

BANNED phrases: "significantly improved", "greatly enhanced", "contributed to mission success", "played a key role"

APPROVED ACRONYM/ABBREVIATION LIST:
${acronymList}`;


  const bulletSystemPrompt = `You are an elite US military EPR bullet writer with 20 years of experience writing bullets that get Airmen and Guardians promoted.

${unitInstruction}

YOUR TASK:
Rewrite the given EPR bullet into ONE unique, high-impact bullet. Study the real examples below and match their style exactly.

HARD LIMIT — MOST IMPORTANT RULE:
The finished bullet MUST be 124 characters or fewer (including spaces). Count every character before outputting. If it exceeds 124 characters, abbreviate more aggressively or restructure until it fits. Never exceed 124 characters.

UNIQUENESS RULE:
Every bullet must be unique to the input. Do NOT reuse the same opening verb, same structure, or same impact phrase repeatedly. Draw directly from the specific details in the input.

REAL BULLET EXAMPLES — match this style exactly (all are ≤124 chars):
- "Accomplished 462 SV special activities; configured bus sys/collected data--GPS constellation optimized"
- "Analyzed crit SACCS outage; ID'd/rpr'd damaged wiring <2 hrs--restored NC2 comm w/15 MAFs"
- "Author'd GO/FO TBMW codeword proc; expedit'd vital msl info to USFJ/5AF CC--reduc'd notification time 20%"
- "Conduct'd 15 hrs GPS III ESA validation; safeguarded $500M SV--assured future $11B constellation success"
- "Drove SA f/146K+ sq mi AOR; processed 20+ CCIRs/briefed USFJ CC--upheld U.S./Japan alliance/58yr Treaty"
- "Engr'd innovative sat ID tactic; incr'd obs time 300%--crew won Combat Superior Performer Tm 19-22"
- "Led TS ntwk rpr; sync'd 4 orgs/5 prsnl, ID'd/config'd faulty encryption--cert'd CinC/JCS emer C2 comm"
- "Managed theater MW ops; led 10-mbr jt tm/processed 93 space events--produced 2 sub-CCMD SOY winners"
- "Ops lead f/2 ISS resupply msns; tracked 11 tons cargo--$150B asset & 6-mbr global crew sustained"
- "Org'd CMS rpr; trn'd/liaised 2 techs w/3 comm agencies f/AEHF modem reconfig--restored $330M strat ntwk"
- "Overhauled sys ops prcs; drove 15 updates/9 new C/Ls--slashed crew troubleshooting time 30%"
- "Oversaw 45K daily collects; delivered tgt orbit determinations--enabled JSpOC custody of 4.8k items"
- "Secured $40B nat'l asset ISO coalition PR; coord'd hi-pri intel collect--assured safety 2 coalition mbrs"
- "Tracked 3 nK msl launches; relayed crit ops/intel to HHQ & int'l partners--ensured safety of 127M civs"
- "Val'd acft antenna NDI; eval'd 138-steps/elim'd 25, cert'd $1.7M sys--keyed Gp's Gen Rawlings Tm OTY '19!"
- "Hosted enl conf; raised $28K f/4 NCOs edu goal/20 amn recruit--rec'd 5 qtrly awds/2 sq/CC LOAs"
- "Created inaugural prog; coord'd w/8 sqs/5 mths/lvl'd barrier f/569 jr enl--lauded by 9 RW & MSG/BTZ!"

STYLE RULES — every one is mandatory:
- Contract verbs: "Author'd", "ID'd", "rpr'd", "Conduct'd", "Engr'd", "Coord'd", "Trn'd", "Validat'd", "Accompl'd", "Deliver'd", "Sync'd", "Config'd"
- Use "f/" for "for", "w/" for "with", "<" for "less than", "&" for "and"
- Use "--" (double dash) to separate action from impact
- Use "/" to chain related items
- Include numbers wherever possible — people, dollars, percentages, time, rankings
- Drop ALL articles ("a", "an", "the") everywhere
- ONE line only — dense and packed
- Use "!" only for exceptional results: BTZ, DG, OTY, AOY, #1 of many
- Impact after "--" MUST reference a specific system, command, asset value, or named outcome tied to THIS unit's actual mission

BANNED endings — NEVER use these:
- "for CONUS defense" / "for national security" / "for the mission"
- "ensured unit readiness" / "supported unit operations"
- "enhanced mission capability" / "improved overall effectiveness"

CHARACTER COUNT REMINDER: If output exceeds 124 characters, shorten it. This is non-negotiable.

APPROVED ACRONYM/ABBREVIATION LIST:
${acronymList}`;


  const systemPrompt = isNarrative ? narrativeSystemPrompt : bulletSystemPrompt;
  const userMessage = isNarrative
    ? `Write a narrative paragraph for this bullet/notes:
"${bullet}"`
    : `Rewrite this bullet:
"${bullet}"

Rules: ONE line, <=124 characters total, unique structure, contracted verbs, f/, w/, --, unit-specific impact after the double dash. Count characters before responding.`;

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
            { role: "user", content: userMessage },
          ],
          max_tokens: 512,
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
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
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

      const geminiBody = JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}

${userMessage}`
          }]
        }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
      });

      // Retry up to 3 times on rate limit with exponential backoff
      let r;
      for (let attempt = 1; attempt <= 3; attempt++) {
        r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: geminiBody }
        );
        if (r.status !== 429) break;
        if (attempt < 3) {
          const waitMs = attempt * 3000;
          console.log(`Rate limited. Retrying in ${waitMs}ms (attempt ${attempt}/3)...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }

      if (!r.ok) {
        const e = await r.json();
        if (r.status === 429) {
          return res.status(429).json({ error: "Gemini rate limit reached. Please wait 30 seconds and try again." });
        }
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
