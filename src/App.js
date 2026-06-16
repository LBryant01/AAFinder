import "./styles.css";
import React, { useState } from "react";
import { dictionary } from "./Dictionary";
import ReverseDictionary from "./Reverse";
import { ReverseTng } from "./ReverseTngDict";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  const [user, setUser] = useState("");
  const [unit, setUnit] = useState("");
  const [result, setResult] = useState("");
  const [page, setPage] = useState(false);
  const [tng, setTng] = useState(false);

  // Separate AI outputs
  const [bulletOutput, setBulletOutput] = useState("");
  const [narrativeOutput, setNarrativeOutput] = useState("");

  const [unitMission, setUnitMission] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState("");
  const [copiedBullet, setCopiedBullet] = useState(false);
  const [copiedNarrative, setCopiedNarrative] = useState(false);

  const dictionaryToUse = tng ? ReverseTng : dictionary;

  const clearRewriteOutputs = () => {
    setBulletOutput("");
    setNarrativeOutput("");
    setUnitMission("");
    setRewriteError("");
    setCopiedBullet(false);
    setCopiedNarrative(false);
  };

  const handleClick = () => {
    window.location.href = "https://londle.vercel.app/";
  };

  const handleTng = () => {
    setTng((prev) => !prev);
    setResult("");
    clearRewriteOutputs();
  };

  const PageChange = () => {
    setPage((prev) => !prev);
    clearRewriteOutputs();
  };

  const checkAcronyms = (inputText, dict) => {
    if (!inputText) return;

    const cleanSentence = inputText.replace(/--/g, " ");
    const upperSentence = cleanSentence.toUpperCase();

    const inputWords = upperSentence
      .split(/\s+/)
      .map((word) => word.replace(/[;:.,!—\-\/\\]/g, ""))
      .filter(Boolean);

    const exactMatches = new Set();
    const wordMatches = new Set();
    const possibleMatches = new Set();

    if (dict.hasOwnProperty(upperSentence)) {
      setResult(`Possible Acronym(s):\n${cleanSentence}: ${dict[upperSentence]}`);
      return;
    }

    Object.keys(dict).forEach((key) => {
      if (upperSentence.includes(key.toUpperCase())) {
        exactMatches.add(`${key}: ${dict[key]}`);
      }
    });

    inputWords.forEach((word) => {
      Object.keys(dict).forEach((key) => {
        if (key.toUpperCase() === word) {
          wordMatches.add(`${key}: ${dict[key]}`);
        }
      });
    });

    inputWords.forEach((word) => {
      if (word.length < 3) return;

      const prefix = word.substring(0, Math.min(word.length, 5));

      Object.keys(dict).forEach((key) => {
        const keyUpper = key.toUpperCase();
        const firstKeyWord = keyUpper.split(" ")[0];

        if (
          firstKeyWord.startsWith(prefix) &&
          !exactMatches.has(`${key}: ${dict[key]}`)
        ) {
          possibleMatches.add(`${key}: ${dict[key]}`);
        }
      });
    });

    const allMatches = [
      ...Array.from(exactMatches),
      ...Array.from(wordMatches).filter((m) => !exactMatches.has(m)),
      ...Array.from(possibleMatches).filter(
        (m) => !exactMatches.has(m) && !wordMatches.has(m)
      ),
    ];

    if (allMatches.length > 0) {
      setResult(`Possible Acronym(s):\n${allMatches.join("\n")}`);
    } else {
      setResult("No matches found.");
    }
  };

  const handleRewrite = async () => {
    if (!user.trim()) return;

    setIsRewriting(true);
    clearRewriteOutputs();

    const apiBase = process.env.REACT_APP_API_URL || "";

    try {
      const response = await fetch(`${apiBase}/api/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bullet: user,
          acronyms: dictionaryToUse,
          unit: unit.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRewriteError(data.error || "Rewrite failed. Please try again.");
      } else {
        setBulletOutput(data.bullet || data.rewritten || "");
        setNarrativeOutput(data.narrative || "");
        setUnitMission(data.unitMission || "");
      }
    } catch (err) {
      setRewriteError("Could not reach the rewrite service. Check your connection.");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleCopyBullet = () => {
    navigator.clipboard.writeText(bulletOutput);
    setCopiedBullet(true);
    setTimeout(() => setCopiedBullet(false), 2000);
  };

  const handleCopyNarrative = () => {
    navigator.clipboard.writeText(narrativeOutput);
    setCopiedNarrative(true);
    setTimeout(() => setCopiedNarrative(false), 2000);
  };

  return (
    <div className="app-container">
      <h1>
        {page
          ? `Reverse Acronym Decoder${tng ? " STARCOM" : " CFC"}`
          : "Acronym/Abbreviation Finder"}
      </h1>

      <Analytics />

      {page ? (
        <ReverseDictionary training={tng} />
      ) : (
        <>
          <p>
            Improve your EPR bullet's conciseness. Paste your bullet below to
            find acronyms, or enter your unit and click <strong>✦ Rewrite</strong>{" "}
            to let AI suggest an improved bullet and narrative tied to your
            unit's mission and impact using only approved acronyms.
          </p>

          <div className="unit-input-group">
            <label className="unit-label">Unit optional — for AI Rewrite</label>
            <input
              className="unit-input"
              type="text"
              placeholder="e.g. 319th Combat Training Squadron, 1st Space Operations Squadron..."
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                clearRewriteOutputs();
              }}
            />
          </div>

          <textarea
            placeholder="Paste your bullet here..."
            value={user}
            onChange={(e) => {
              setUser(e.target.value);
              clearRewriteOutputs();
              setResult("");
            }}
          />

          <div className="button-group">
            <button onClick={() => checkAcronyms(user, dictionaryToUse)}>
              Find Acronyms
            </button>

            <button
              className="rewrite-btn"
              onClick={handleRewrite}
              disabled={isRewriting || !user.trim()}
            >
              {isRewriting ? "Rewriting…" : "✦ Rewrite"}
            </button>
          </div>

          {user && <div className="user-output">{user}</div>}

          {result && <div className="result">{result}</div>}

          {unitMission && (
            <div className="mission-context">
              <div className="mission-label">Unit Mission via Wikipedia</div>
              <div className="mission-text">{unitMission}</div>
            </div>
          )}

          {bulletOutput && (
            <div className="rewrite-result">
              <div className="rewrite-label">AI-Suggested Bullet</div>
              <div className="rewrite-text">{bulletOutput}</div>

              <button className="copy-btn" onClick={handleCopyBullet}>
                {copiedBullet ? "Copied!" : "Copy Bullet"}
              </button>
            </div>
          )}

          {narrativeOutput && (
            <div className="rewrite-result">
              <div className="rewrite-label">AI-Suggested Narrative</div>
              <div className="rewrite-text">{narrativeOutput}</div>

              <button className="copy-btn" onClick={handleCopyNarrative}>
                {copiedNarrative ? "Copied!" : "Copy Narrative"}
              </button>
            </div>
          )}

          {rewriteError && <div className="rewrite-error">{rewriteError}</div>}
        </>
      )}

      <div className="button-group">
        <button onClick={PageChange}>{page ? "Acronym Finder" : "Decoder"}</button>
        <button onClick={handleTng}>{tng ? "CFC" : "STARCOM"}</button>
        <button onClick={handleClick}>Londle</button>
      </div>

      <footer>Please notify all errors to Spc4 Bryant</footer>
    </div>
  );
}
