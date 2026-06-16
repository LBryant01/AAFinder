// api/rewrite.js — Vercel Serverless Function

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
          fullText.length > 3000 ? fullText.substring(0, 3000) + "..." : fullText;

        unitMission =
          fullText.length > 600 ? fullText.substring(0, 600) + "..." : fullText;
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

  const unitInstruction =
    unit && unit.trim()
      ? `The member's unit is: ${unit}

${wikiContext}Use the unit context above to make the impact as specific and powerful as possible — naming real systems, commands, asset values, or outcomes tied to this unit's actual mission.`
      : "";

  const narrativeSystemPrompt = `You are an elite US military EPR/OPR narrative writer with 20 years of experience writing narratives that get Airmen and Guardians promoted.

${unitInstruction}

YOUR TASK:
Expand the given bullet or notes into a polished EPR narrative paragraph of 4-6 sentences.

CRITICAL CONTENT RULE:
Use ONLY the facts, actions, and details from the input bullet. Do NOT invent space operations, satellite systems, missile warning, or any content not mentioned in the input. If numbers are missing, use conservative realistic estimates. All content must be directly relevant to what the member actually did.

STRUCTURE — all three parts required:
1. ACTION — Open with a strong past-tense verb. Describe what the member did, the scope and scale: people, systems, hours, dollars, items involved.
2. RESULT — What measurable outcome happened? Percentages improved, rankings earned, dollars saved, time reduced, awards received.
3. IMPACT — Why does it matter to this specific unit's mission? Reference the unit's actual role, a named system, command, or strategic outcome from the Wikipedia context if available.

STYLE RULES:
- Third person — no "he/she/they"; use implied subject or "the member"
- Specific — real numbers, system names, command names wherever possible
- No filler phrases: never write "significantly improved", "greatly enhanced", "contributed to mission success", "played a key role", "ensured success", "leveraged expertise"
- Each sentence adds NEW information — no repetition
- Use approved acronyms where appropriate
- Close with a direct promotion recommendation, such as "Promote immediately" or "Top X% of peers — select for advanced roles without hesitation"

APPROVED ACRONYM/ABBREVIATION LIST:
${acronymList}`;

  const bulletSystemPrompt = `You are an elite US military EPR/OPR bullet writer with 20 years of experience writing short, dense, award-winning Air Force and Space Force bullets.

${unitInstruction}

YOUR TASK:
Rewrite the user's input into EXACTLY ONE EPR/OPR bullet that closely matches this style:

"Drove SA for 146K+ sq mi AOR; processed 20+ CCIRs/briefed USFJ CC--upheld U.S./Japan alliance/58 year Treaty"

STYLE TARGET:
The output should feel like a real Air Force / Space Force performance bullet:
- Short, dense, mission-focused
- Past-tense action verb first
- Heavy use of abbreviations
- Numbers included wherever possible
- One semicolon separating the main action from supporting detail
- Double dash "--" separating action/result from impact
- Impact must be concrete and mission-specific

REQUIRED STRUCTURE:
[Strong past-tense verb] [mission/action] f/[scope/scale]; [specific action]/[specific action]--[specific impact/outcome]

GOOD STRUCTURE EXAMPLES — copy the FORMAT, not the content:
- Drove SA for 146K+ sq mi AOR; processed 20+ CCIRs/briefed USFJ CC--upheld U.S./Japan alliance/58 year Treaty
- Managed theater msl warning ops; led 10-mbr jt tm/processed 93 space events--produced 2 sub-CCMD SOY winners
- Tracked 3 nK missile launches; relayed crit ops/intel data to HHQ & inter-nat'l partners--ensured safety of 127M civs
- Led 13 prsnl in historic, 104-item launch; integrated 3 tactics/6 sites--deliver'd 1st-track orbital data f/8 int'l partners
- Overhauled sys ops procedures; drove 15 updates/implemented 9 new C/Ls--slashed crew troubleshooting time 30%
- Secured $40B nat'l asset ISO coalition PR event; coord'd hi-pri intelligence collect--assured safety 2 coalition mbrs/asset

CRITICAL CONTENT RULE:
- Use ONLY facts from the user's input and the unit context.
- Do NOT invent systems, missions, people, awards, treaties, countries, commanders, or numbers.
- Do NOT copy or borrow content from the examples unless the user's input directly supports it.
- If the input has numbers, preserve them.
- If no numbers are provided, estimate only conservative scope when reasonable.
- Every noun, verb, number, and impact must be tied to the user's input or unit context.
- The bullet must include action, result, and impact.
- The impact after "--" must explain why the action mattered.

FORMAT RULES:
- ONE line only.
- 100-124 characters preferred.
- Maximum 130 characters.
- No period at the end.
- Use exactly one semicolon.
- Use exactly one double dash "--".
- Use "/" to compress related actions.
- Use "&" instead of "and".
- Use "f/" instead of "for".
- Use "w/" instead of "with".
- Use "<" instead of "less than".
- Drop articles: "a", "an", "the".
- Use military abbreviations where natural.
- Use approved acronyms when applicable.
- Do not explain the bullet.
- Do not provide multiple options.

CONTRACTION STYLE:
Use contracted verbs when they sound natural:
- Author'd
- Conduct'd
- Coord'd
- Deliver'd
- ID'd
- Rpr'd
- Trn'd
- Validat'd
- Config'd
- Sync'd
- Expedit'd
- Reduc'd
- Restor'd
- Cert'd
- Rec'd
- Org'd
- Accompl'd

PREFERRED OPENING VERBS:
Drove, Led, Managed, Executed, Delivered, Directed, Processed, Tracked, Validat'd, Coord'd, Conduct'd, Built, Created, Authored, Secured, Trn'd, Oversaw, Spearheaded, Streamlined, Orchestrated

ABBREVIATION STYLE:
Use common military shorthand when appropriate:
- personnel → prsnl
- member → mbr
- team → tm
- training → tng
- operations → ops
- command and control → C2
- critical → crit
- communication → comm
- network → ntwk
- repair → rpr
- identified → ID'd
- headquarters → HHQ
- commander → CC
- squadron → sq
- group → gp
- wing → wg
- national → nat'l
- international → int'l

BANNED PHRASES:
- "significantly improved"
- "greatly enhanced"
- "contributed to mission success"
- "played a key role"
- "ensured mission success"
- "enhanced readiness"
- "improved effectiveness"
- "supported the mission"
- "for national security"
- "for CONUS defense"
- "for the mission"
- "boosted morale"
- "increased productivity"
- "mission accomplishment"

BAD OUTPUTS:
- Too generic: "Led important project; improved team operations--supported mission success"
- Too long: Any bullet over 130 characters
- Too plain: "Helped with training and improved readiness"
- Too vague: "Worked on multiple tasks; ensured success--enhanced unit effectiveness"

OUTPUT CHECKLIST BEFORE FINAL:
Before answering, silently verify:
1. One line only
2. Starts with a strong past-tense verb
3. Has exactly one semicolon
4. Has exactly one "--"
5. Uses compressed military style
6. Includes numbers if available
7. Does not invent unsupported facts
8. Has a concrete impact after "--"
9. Sounds similar in style to: "Drove SA for 146K+ sq mi AOR; processed 20+ CCIRs/briefed USFJ CC--upheld U.S./Japan alliance/58 year Treaty"

APPROVED ACRONYM/ABBREVIATION LIST:
${acronymList}`;

  const systemPrompt = isNarrative ? narrativeSystemPrompt : bulletSystemPrompt;

  const userMessage = isNarrative
    ? `Write a 4-6 sentence narrative paragraph with ACTION, RESULT, and IMPACT based ONLY on this input:

"${bullet}"

Do not add content not present in the input. End with a direct promotion recommendation.`
    : `Rewrite this into ONE dense EPR/OPR bullet using the exact style of this example:

"Drove SA for 146K+ sq mi AOR; processed 20+ CCIRs/briefed USFJ CC--upheld U.S./Japan alliance/58 year Treaty"

INPUT:
"${bullet}"

RULES:
- Use only the input and unit context.
- Do not copy the example's content.
- One line only.
- 100-124 characters preferred.
- Maximum 130 characters.
- Use exactly one semicolon and exactly one "--".
- Use compressed military abbreviations.
- Include action, result, and mission impact.
- Make it sound like a real Air Force/Space Force bullet.
- Return only the bullet.`;

  // ── Step 4: Call the LLM ─────────────────────────────────────────────────
  try {
    let rewritten = "";

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
            { role: "user", content: userMessage },
          ],
          max_tokens: 512,
          temperature: isNarrative ? 0.7 : 0.35,
        }),
      });

      if (!r.ok) {
        const e = await r.json();
        return res.status(500).json({
          error: e.error?.message || "OpenAI request failed.",
        });
      }

      const d = await r.json();
      rewritten = d.choices?.[0]?.message?.content?.trim() || "";
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
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
          temperature: isNarrative ? 0.7 : 0.35,
        }),
      });

      if (!r.ok) {
        const e = await r.json();
        return res.status(500).json({
          error: e.error?.message || "Anthropic request failed.",
        });
      }

      const d = await r.json();
      rewritten = d.content?.[0]?.text?.trim() || "";
    } else if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
      }

      const geminiBody = JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}

${userMessage}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: isNarrative ? 0.7 : 0.35,
        },
      });

      // Retry up to 3 times on rate limit with exponential backoff
      let r;

      for (let attempt = 1; attempt <= 3; attempt++) {
        r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: geminiBody,
          }
        );

        if (r.status !== 429) break;

        if (attempt < 3) {
          const waitMs = attempt * 3000;
          console.log(
            `Rate limited. Retrying in ${waitMs}ms (attempt ${attempt}/3)...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }

      if (!r.ok) {
        const e = await r.json();

        if (r.status === 429) {
          return res.status(429).json({
            error: "Gemini rate limit reached. Please wait 30 seconds and try again.",
          });
        }

        return res.status(500).json({
          error: e.error?.message || "Gemini request failed.",
        });
      }

      const d = await r.json();
      rewritten = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } else {
      return res.status(500).json({
        error: `Unknown LLM_PROVIDER: "${provider}"`,
      });
    }

    if (!rewritten) {
      return res.status(500).json({ error: "LLM returned empty response." });
    }

    // ── Step 5: Clean bullet output ─────────────────────────────────────────
    if (!isNarrative) {
      rewritten = rewritten
        .replace(/^[-•\d.)\s]+/, "")
        .replace(/^"|"$/g, "")
        .replace(/\.$/, "")
        .trim();

      // Keep only first line if the model accidentally returns explanation/options
      rewritten = rewritten.split("\n")[0].trim();
    }

    return res.status(200).json({ rewritten, unitMission });
  } catch (err) {
    console.error("Rewrite error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};
