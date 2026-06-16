module.exports = async function handler(req, res) {
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


  // ── Step 3: Build unit context ───────────────────────────────────────────
  const wikiContext = unitMissionFull
    ? `UNIT WIKIPEDIA CONTEXT FOR ${unit}:\n${unitMissionFull}\n\n`
    : "";

  const unitInstruction = unit && unit.trim()
    ? `The member's unit is: ${unit}\n\n${wikiContext}Use the unit context above to make the impact as specific and powerful as possible — naming real systems, commands, asset values, or outcomes tied to this unit's actual mission.`
    : "";


  const narrativeSystemPrompt = `You are an elite US military EPR/OPR narrative writer with 20 years of experience writing narratives that get Airmen and Guardians promoted. You use this extensive knowledge to find the highest impact possible (I.E. Your troop says I set up chair for the wing you turn that to acquisition of $5000 of valuables for critical wing event.

${unitInstruction}

YOUR TASK:
Expand the given bullet or notes into a polished EPR narrative paragraph of 4-6 sentences.

CRITICAL CONTENT RULE:
Use ONLY the facts, actions, and details from the input bullet. Do NOT invent space operations, satellite systems, missile warning, or any content not mentioned in the input. If numbers are missing, use conservative realistic estimates. All content must be directly relevant to what the member actually did.

STRUCTURE — all three parts required:
1. ACTION — Open with a strong past-tense verb. Describe what the member did, the scope and scale (how many people, systems, hours, dollars, items involved).
2. RESULT — What measurable outcome happened? (percentages improved, rankings earned, dollars saved, time reduced, awards received)
3. IMPACT — Why does it matter to this specific unit's mission? Reference the unit's actual role, a named system, command, or strategic outcome from the Wikipedia context if available.

STYLE RULES:
- Third person — no "he/she/they", use implied subject or "the member"
- Specific — real numbers, system names, command names wherever possible
- No filler phrases: never write "significantly improved", "greatly enhanced", "contributed to mission success", "played a key role", "ensured success", "leveraged expertise"
- Each sentence adds NEW information — no repetition
- Use approved acronyms where appropriate
- Close with a direct promotion recommendation (e.g. "Promote immediately", "Top X% of peers — select for advanced roles without hesitation")

APPROVED ACRONYM/ABBREVIATION LIST:
${acronymList}`;

  const bulletSystemPrompt = `You are an elite US military EPR bullet writer with 20 years of experience writing bullets that get Airmen and Guardians promoted.

${unitInstruction}

CRITICAL CONTENT RULE:
The bullet must be based ENTIRELY on the input provided. Do NOT copy or borrow content, jargon, systems, or acronyms from the style examples below. The examples show FORMATTING ONLY — their space/satellite/missile content is irrelevant unless the input is about those topics. Every noun, verb, and number in your output must come from the input bullet or the unit context above.

YOUR TASK:
Rewrite the input into ONE dense, high-impact EPR bullet using the formatting style of the examples below — but with content drawn ONLY from the input.

CHARACTER LIMIT:
Between 100 and 124 characters. Aim for 110-124. Do NOT cut short. Do NOT exceed 124.

FORMATTING STYLE EXAMPLES — copy the FORMAT, not the content:
- ACTION verb + scope/scale; detail/detail--specific measurable impact  [108-124 chars]
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

FORMATTING RULES — mandatory:
- Contract verbs: "Author'd", "ID'd", "rpr'd", "Conduct'd", "Engr'd", "Coord'd", "Trn'd", "Validat'd", "Accompl'd", "Deliver'd", "Sync'd", "Config'd"
- Use "f/" for "for", "w/" for "with", "<" for "less than", "&" for "and"
- Use "--" (double dash) to separate action from impact — always include both sides
- Use "/" to chain related items
- Include numbers wherever possible — if input has none, estimate conservatively
- Drop ALL articles ("a", "an", "the") everywhere possible
- ONE line only
- Use "!" only for exceptional results: BTZ, DG, OTY, AOY, #1 of many
- Impact after "--" ties to THIS unit's actual role — not a generic ending

BANNED endings:
- "for CONUS defense" / "for national security" / "for the mission"
- "ensured unit readiness" / "enhanced mission capability" / "improved overall effectiveness"

APPROVED ACRONYM/ABBREVIATION LIST:
${acronymList}`;

  const systemPrompt = isNarrative ? narrativeSystemPrompt : bulletSystemPrompt;
  const userMessage = isNarrative
    ? `Write a 4-6 sentence narrative paragraph with ACTION, RESULT, and IMPACT based ONLY on this input:\n"${bullet}"\n\nDo not add content not present in the input. End with a direct promotion recommendation.`
    : `Rewrite ONLY based on the content of this input bullet — do not borrow any content from the style examples:\n"${bullet}"\n\nTarget 110-124 characters. Include full action AND impact after "--". Use contracted verbs, f/, w/, and a unit-specific impact.`;


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
