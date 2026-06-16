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


  const narrativeSystemPrompt = `You are an elite US military EPR/OPR narrative writer with 20 years of experience writing narratives that get Airmen and Guardians promoted. You us your wealth of knowledge to find the highest impact your guardian/airmen have done. If there isn't a result, you provide an estimate.

${unitInstruction}

YOUR TASK:
Expand the given bullet or notes into a polished EPR narrative paragraph of 4-6 sentences that follows this structure:

STRUCTURE — every narrative must have all three parts:
1. ACTION — What did the member do? Open with a strong past-tense verb, specific scope, scale, and complexity (numbers, systems, people, timeframes)
2. RESULT — What was the measurable outcome? (percentages, rankings, dollar values, time saved, awards received)
3. IMPACT — Why does it matter to THIS unit's specific mission? Name a real system, command, or strategic outcome

NARRATIVE STYLE RULES:
- Write in third person ("The member", or implied subject — no "he/she/they")
- Be specific — include real numbers, dollar values, system names, command names wherever possible
- No generic filler: never use "significantly improved", "greatly enhanced", "contributed to mission success", "played a key role", "ensured success"
- Each sentence must add NEW information — no repetition or padding
- Use approved acronyms from the list below where appropriate
- Close with a direct promotion recommendation or endorsement statement (e.g. "Promote immediately", "Select for senior roles without hesitation", "Top X% of peers")

APPROVED ACRONYM/ABBREVIATION LIST:
${acronymList}`;

  const bulletSystemPrompt = `You are an elite US military EPR bullet writer with 20 years of experience writing bullets that get Airmen and Guardians promoted.

${unitInstruction}

YOUR TASK:
Rewrite the given EPR bullet into ONE unique, dense, high-impact bullet that follows the ACTION--IMPACT structure of the real examples below.

CHARACTER LIMIT:
The bullet must be between 100 and 124 characters (including spaces). The real examples below all fall in this range. Do NOT cut a bullet short — aim for the full 124 if needed to include all relevant details. Do NOT exceed 124.

UNIQUENESS:
Every bullet must be unique to the input. Draw directly from the specific details given. Do not default to a generic template.

REAL BULLET EXAMPLES — study these carefully, match their length, density, and style:
- "Accomplished 462 SV special activities; configured bus system/collected analysis data--GPS constellation optimized"  [114]
- "Analyzed crit SACCS outage; ID'd/rpr'd damaged wiring <2 hrs--restored NC2 comm link w/15 Missile Alert Facilities"  [114]
- "Author'd GO/FO TBMW codeword proc; expedit'd vital missile info to USFJ/5AF CC--reduc'd notification time 20%"  [109]
- "Conduct'd 15 hrs of GPS III ESA validation; safeguarded $500M SV--assured future $11B GPS constellation success"  [111]
- "Drove SA for 146K+ sq mi AOR; processed 20+ CCIRs/briefed USFJ CC--upheld U.S./Japan alliance/58 year Treaty"  [108]
- "Drove sq C2 for 2 satellite break-ups; defined 2 new debris fields--alerted 30 sensors of collision risks to global assets"  [122]
- "Engr'd innovative satellite identification tactic; incr'd obs time 300%--crew won Combat Superior Performer Tm 19-22"  [116]
- "Led 13 prsnl in historic, 104-item launch; integrated 3 tactics/6 sites--deliver'd 1st-track orbital data f/8 int'l partners"  [124]
- "Led top secret ntwk rpr; sync'd 4 orgs/5 prsnl, ID'd/config'd faulty encryption device--cert'd CinC/JCS emer C2 comm"  [116]
- "Managed theater msl warning ops; led 10-mbr jt tm/processed 93 space events--produced 2 sub-CCMD SOY winners"  [108]
- "Ops lead f/2 ISS resupply missions; tracked delivery of 11 tons of cargo--$150B asset & 6-mbr global crew sustained"  [115]
- "Org'd CMS rpr; trn'd/liaised 2 techs w/3 comm agencies on reconfig prcs f/AEHF modem--restored $330M strat ntwk"  [111]
- "Overhauled sys ops procedures; drove 15 updates/implemented 9 new C/Ls--slashed crew troubleshooting time 30%"  [109]
- "Oversaw 45K daily collects; delivered vital tgt orbit determinations--enabled Jt Space Ops Center custody of 4.8k items"  [119]
- "Secured $40B nat'l asset ISO coalition PR event; coord'd hi-pri intelligence collect--assured safety 2 coalition mbrs/asset"  [123]
- "Tracked 3 nK missile launches; relayed crit ops/intel data to HHQ & inter-nat'l partners--ensured safety of 127M civs"  [117]
- "Val'd acft antenna NDI pres; eval'd 138-steps/elim'd 25, cert'd $1.7M sys--keyed Gp's Gen Rawlings Tm OTY '19 awd!"  [114]
- "Validat'd ground sys architecture; tested s/w upgrade/32 sorties/16 hrs--ensur'd integration/rec'd Operator of 2Q 2018"  [118]
- "Hosted enl conf; raised $28K f/4 NCOs to achieve edu goal/spt'd recruit of 20 amn--rec'd 5 qtrly awds/2 sq/CC LOAs"  [114]
- "Created inaugural prog; coord'd w/8 sqs/5 mths/lvl'd social barrier f/569 jr enl--lauded by 9 RW & MSG/awarded BTZ!"  [115]

STYLE RULES — every one mandatory:
- Contract verbs: "Author'd", "ID'd", "rpr'd", "Conduct'd", "Engr'd", "Coord'd", "Trn'd", "Validat'd", "Accompl'd", "Deliver'd", "Sync'd", "Config'd"
- Use "f/" for "for", "w/" for "with", "<" for "less than", "&" for "and"
- Use "--" (double dash) to separate action from impact — never end before the "--"
- Use "/" to chain related items (e.g. "ID'd/config'd", "tested/validated")
- Include real numbers wherever possible — people, dollars, percentages, time, rankings
- Drop ALL articles ("a", "an", "the") everywhere possible
- ONE line only — dense and packed, aim for 110-124 characters
- Use "!" only for exceptional results: BTZ, DG, OTY, AOY, #1 of many
- The impact after "--" MUST reference a specific system, command, asset value, or named outcome tied to THIS unit's actual mission

BANNED endings — NEVER use these:
- "for CONUS defense" / "for national security" / "for the mission"
- "ensured unit readiness" / "supported unit operations"
- "enhanced mission capability" / "improved overall effectiveness"

APPROVED ACRONYM/ABBREVIATION LIST:
${acronymList}`;

  const systemPrompt = isNarrative ? narrativeSystemPrompt : bulletSystemPrompt;
  const userMessage = isNarrative
    ? `Write a narrative paragraph (4-6 sentences) with clear ACTION, RESULT, and IMPACT for this bullet:\n"${bullet}"\n\nEnd with a direct promotion recommendation.`
    : `Rewrite this bullet:\n"${bullet}"\n\nTarget 110-124 characters. Include full action AND impact after "--". Do not cut the bullet short. Use contracted verbs, f/, w/, numbers, and a specific unit-tied impact.`;

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
