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

  // ── Helper: safely parse JSON from LLM output ─────────────────────────────
  function parseLLMJson(text) {
    if (!text) return null;

    const cleaned = text
      .trim()
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  // ── Step 1: Fetch FULL Wikipedia article for the unit ────────────────────
  let unitMission = "";
  let unitMissionFull = "";

  if (unit && unit.trim()) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        unit.trim()
      )}&format=json&origin=*`;

      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      const topResult = searchData?.query?.search?.[0];

      if (topResult) {
        const pageTitle = topResult.title;

        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
          pageTitle
        )}&prop=extracts&explaintext=true&format=json&origin=*`;

        const extractRes = await fetch(extractUrl);
        const extractData = await extractRes.json();
        const pages = extractData?.query?.pages;
        const page = pages ? Object.values(pages)[0] : null;
        const fullText = page?.extract || "";

        unitMissionFull =
          fullText.length > 4000 ? fullText.substring(0, 4000) + "..." : fullText;

        unitMission =
          fullText.length > 600 ? fullText.substring(0, 600) + "..." : fullText;
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

  // ── Step 3: Build prompt ─────────────────────────────────────────────────
  const wikiContext = unitMissionFull
    ? `SUPPLEMENTAL WIKIPEDIA CONTEXT FOR ${unit}:\n${unitMissionFull}\n\n`
    : "";

  const unitInstruction =
    unit && unit.trim()
      ? `The member's unit is: ${unit}

Use your Google Search grounding to find the MOST CURRENT mission statement, roles, and strategic responsibilities of "${unit}" from official .mil websites, press releases, or news. Prioritize what you find online over the Wikipedia context below.

${wikiContext}Use everything you find to make the impact statement after "--" as specific and powerful as possible — naming real systems, commands, asset values, or outcomes tied to this unit's actual current mission.`
      : "";

  const systemPrompt = `You are an elite US military E/OPR (Enlisted/Officer Performance Report) bullet writer with 20 years of experience writing bullets that get Airmen and Guardians promoted. You use your experience to see results that other's can't. For example, a person moved chairs for a wing event, you see them reallocating $4000 worth of equipment to secure mission succenss for the wing. 

${unitInstruction}

YOUR TASK:
Rewrite the given EPR bullet into TWO required outputs:

1. bullet
2. narrative

You must always generate BOTH.

The bullet must match the style, density, and impact of the real examples below.

The narrative must explain the same achievement in plain English, as if the member's supervisor is telling a short story about how good they are, what they did, and how their actions impacted the unit, mission, command, joint force, nation, or world.

REAL BULLET EXAMPLES — match this style exactly for the bullet:
- "Accomplished 462 SV special activities; configured bus system/collected analysis data--GPS constellation optimized"
- "Analyzed crit SACCS outage; ID'd/rpr'd damaged wiring <2 hrs--restored NC2 comm link w/15 Missile Alert Facilities"
- "Author'd GO/FO TBMW codeword proc; expedit'd vital missile info to USFJ/5AF CC--reduc'd notification time 20%"
- "Conduct'd 15 hrs of GPS III ESA validation; safeguarded $500M SV--assured future $11B GPS constellation success"
- "Drove SA for 146K+ sq mi AOR; processed 20+ CCIRs/briefed USFJ CC--upheld U.S./Japan alliance/58 year Treaty"
- "Drove sq C2 for 2 satellite break-ups; defined 2 new debris fields--alerted 30 sensors of collision risks to global assets"
- "Engr'd innovative satellite identification tactic; incr'd obs time 300%--crew won Combat Superior Performer Tm 19-22"
- "Led 13 prsnl in historic, 104-item launch; integrated 3 tactics/6 sites--deliver'd 1st-track orbital data f/8 int'l partners"
- "Led top secret ntwk rpr; sync'd 4 orgs/5 prsnl, ID'd/config'd faulty encryption device--cert'd CinC/JCS emer C2 comm"
- "Managed theater msl warning ops; led 10-mbr jt tm/processed 93 space events--produced 2 sub-CCMD SOY winners"
- "Ops lead f/2 ISS resupply missions; tracked delivery of 11 tons of cargo--$150B asset & 6-mbr global crew sustained"
- "Org'd CMS rpr; trn'd/liaised 2 techs w/3 comm agencies on reconfig prcs f/AEHF modem--restored $330M strat ntwk"
- "Overhauled sys ops procedures; drove 15 updates/implemented 9 new C/Ls--slashed crew troubleshooting time 30%"
- "Oversaw 45K daily collects; delivered vital tgt orbit determinations--enabled Jt Space Ops Center custody of 4.8k items"
- "Secured $40B nat'l asset ISO coalition PR event; coord'd hi-pri intelligence collect--assured safety 2 coalition mbrs/asset"
- "Tracked 3 nK missile launches; relayed crit ops/intel data to HHQ & inter-nat'l partners--ensured safety of 127M civs"
- "Val'd acft antenna NDI pres; eval'd 138-steps/elim'd 25, cert'd $1.7M sys--keyed Gp's Gen Rawlings Tm OTY '19 awd!"
- "Validat'd ground sys architecture; tested s/w upgrade/32 sorties/16 hrs--ensur'd integration/rec'd Operator of 2Q 2018"
- "Hosted enl conf; raised $28K f/4 NCOs to achieve edu goal/spt'd recruit of 20 amn--rec'd 5 qtrly awds/2 sq/CC LOAs"
- "Created inaugural prog; coord'd w/8 sqs/5 mths/lvl'd social barrier f/569 jr enl--lauded by 9 RW & MSG/awarded BTZ!"

BULLET STYLE RULES — follow every one:
- Bullet must be 120 characters or less.
- Contract verbs: "Author'd", "ID'd", "rpr'd", "Conduct'd", "Engr'd", "Coord'd", "Trn'd", "Validat'd", "Accompl'd", "Deliver'd"
- Use "f/" for "for", "w/" for "with", "<" for "less than", "&" for "and"
- Use "--" double dash before the impact statement
- Use "/" to chain related items
- Include REAL numbers wherever possible — people, dollars, percentages, time, rankings
- Drop all articles: "a", "an", "the"
- ONE line only — dense and packed
- Use "!" only for exceptional results: BTZ, DG, OTY, #1 ranking
- Impact after "--" must name a specific system, command, asset value, or outcome tied to THIS unit's actual mission

NARRATIVE STYLE RULES:
- Write in plain English.
- Sound like a supervisor describing the member's performance.
- Explain what the member did, why it mattered, and who or what benefited.
- Make it read like a strong performance report narrative, not casual praise.
- Do NOT use bullet abbreviations like f/, w/, rpr'd, trn'd, or "--".
- Do NOT copy the bullet format.
- Keep it professional, specific, and mission-focused.
- Use numbers, systems, commands, dollars, lives, assets, or mission outcomes when possible.
- 2 to 3 sentences with condensed information.
- The narrative must describe the same achievement and impact as the bullet, but written naturally.
- Avoid vague praise like "great job", "hard worker", or "valuable member" unless supported by specific action and impact.

BANNED endings — never write these in either output:
- "for CONUS defense" / "for national security" / "for the mission"
- "ensured unit readiness" / "supported unit operations"
- "enhanced mission capability" / "improved overall effectiveness"

APPROVED ACRONYM/ABBREVIATION LIST:
${acronymList}

OUTPUT FORMAT:
Return ONLY valid JSON.
Do not include markdown.
Do not include code fences.
Do not include extra explanation.

The JSON must look exactly like this:
{
  "bullet": "one bullet here",
  "narrative": "plain English narrative here"
}`;

  // ── Step 4: Call the LLM ─────────────────────────────────────────────────
  try {
    let rawOutput = "";

    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "OPENAI_API_KEY is not set." });
      }

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
            {
              role: "user",
              content: `Rewrite this bullet and return both a bullet and narrative:\n"${bullet}"`,
            },
          ],
          max_tokens: 700,
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      });

      if (!r.ok) {
        const e = await r.json();
        return res
          .status(500)
          .json({ error: e.error?.message || "OpenAI request failed." });
      }

      const d = await r.json();
      rawOutput = d.choices?.[0]?.message?.content?.trim() || "";
    } else if (provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set." });
      }

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 700,
          temperature: 0.7,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Rewrite this bullet and return both a bullet and narrative:\n"${bullet}"`,
            },
          ],
        }),
      });

      if (!r.ok) {
        const e = await r.json();
        return res
          .status(500)
          .json({ error: e.error?.message || "Anthropic request failed." });
      }

      const d = await r.json();
      rawOutput = d.content?.[0]?.text?.trim() || "";
    } else if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
      }

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${systemPrompt}

Rewrite this bullet and return both a bullet and narrative:
"${bullet}"

IMPORTANT:
Return ONLY valid JSON.
Do not include markdown.
Do not include code fences.
The bullet must keep the exact bullet style rules.
The narrative must be plain English from a supervisor's perspective.`,
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 700,
              temperature: 0.7,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!r.ok) {
        const e = await r.json();
        return res
          .status(500)
          .json({ error: e.error?.message || "Gemini request failed." });
      }

      const d = await r.json();
      rawOutput = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } else {
      return res
        .status(500)
        .json({ error: `Unknown LLM_PROVIDER: "${provider}"` });
    }

    if (!rawOutput) {
      return res.status(500).json({ error: "LLM returned empty response." });
    }

    const parsed = parseLLMJson(rawOutput);

    if (!parsed?.bullet || !parsed?.narrative) {
      return res.status(500).json({
        error: "LLM did not return the expected JSON format.",
        rawOutput,
      });
    }

    return res.status(200).json({
      bullet: parsed.bullet,
      narrative: parsed.narrative,

      // Backwards compatibility if your frontend currently expects "rewritten"
      rewritten: parsed.bullet,

      unitMission,
    });
  } catch (err) {
    console.error("Rewrite error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
