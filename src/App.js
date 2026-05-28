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
  const [rewritten, setRewritten] = useState("");
  const [unitMission, setUnitMission] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    window.location.href = "https://londle.vercel.app/";
  };

  const handleTng = () => {
    setTng((prev) => !prev);
    setResult("");
    setRewritten("");
    setUnitMission("");
    setRewriteError("");
  };

  const PageChange = () => {
    setPage((prev) => !prev);
    setRewritten("");
    setUnitMission("");
    setRewriteError("");
  };

  const checkAcronyms = (inputText, dict) => {
    if (!inputText) return;

    // Normalize: replace double hyphens, then clean punctuation
    const cleanSentence = inputText.replace(/--/g, " ");
    const upperSentence = cleanSentence.toUpperCase();

    // Split into individual words, strip punctuation from each
    const inputWords = upperSentence
      .split(/\s+/)
      .map((word) => word.replace(/[;:.,!—\-\/\\]/g, ""))
      .filter(Boolean);

    const exactMatches = new Set();   // full phrase found in sentence
    const wordMatches = new Set();    // individual word exact key match
    const possibleMatches = new Set(); // prefix-based partial matches

    // 1. Check if entire sentence is a key
    if (dict.hasOwnProperty(upperSentence)) {
      setResult(`Possible Acronym(s):\n${cleanSentence}: ${dict[upperSentence]}`);
      return;
    }

    // 2. Check every dictionary key against the full sentence (phrase match)
    Object.keys(dict).forEach((key) => {
      if (upperSentence.includes(key.toUpperCase())) {
        exactMatches.add(`${key}: ${dict[key]}`);
      }
    });

    // 3. Check every individual input word as an exact dictionary key
    inputWords.forEach((word) => {
      Object.keys(dict).forEach((key) => {
        // Match single-word keys exactly
        if (key.toUpperCase() === word) {
          wordMatches.add(`${key}: ${dict[key]}`);
        }
      });
    });

    // 4. Prefix matching — each word checked against start of each key
    //    Use longer prefix (up to 5 chars) for better precision
    inputWords.forEach((word) => {
      if (word.length < 3) return; // skip very short words like "a", "of"
      const prefix = word.substring(0, Math.min(word.length, 5));
      Object.keys(dict).forEach((key) => {
        const keyUpper = key.toUpperCase();
        // Only match start of first word in multi-word keys
        const firstKeyWord = keyUpper.split(" ")[0];
        if (firstKeyWord.startsWith(prefix) && !exactMatches.has(`${key}: ${dict[key]}`)) {
          possibleMatches.add(`${key}: ${dict[key]}`);
        }
      });
    });

    // Combine all matches — exact first, then word, then possible
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
    setRewritten("");
    setUnitMission("");
    setRewriteError("");
    setCopied(false);

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
        setRewritten(data.rewritten);
        setUnitMission(data.unitMission || "");
      }
    } catch (err) {
      setRewriteError("Could not reach the rewrite service. Check your connection.");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rewritten);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dictionaryToUse = tng ? ReverseTng : dictionary;

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
            find acronyms, or enter your unit and click <strong>✦ Rewrite</strong> to
            let AI suggest an improved bullet — tied to your unit's mission and CONUS
            impact — using only approved acronyms.
          </p>

          {/* Unit input */}
          <div className="unit-input-group">
            <label className="unit-label">Unit (optional — for AI Rewrite)</label>
            <input
              className="unit-input"
              type="text"
              placeholder="e.g. 319th Combat Training Squadron, 1st Space Operations Squadron..."
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                setRewritten("");
                setUnitMission("");
                setRewriteError("");
              }}
            />
          </div>

          {/* Bullet textarea */}
          <textarea
            placeholder="Paste your bullet here..."
            value={user}
            onChange={(e) => {
              setUser(e.target.value);
              setRewritten("");
              setUnitMission("");
              setRewriteError("");
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

          {/* Unit mission context */}
          {unitMission && (
            <div className="mission-context">
              <div className="mission-label">Unit Mission (via Wikipedia)</div>
              <div className="mission-text">{unitMission}</div>
            </div>
          )}

          {/* AI rewrite result */}
          {rewritten && (
            <div className="rewrite-result">
              <div className="rewrite-label">AI-Suggested Rewrite</div>
              <div className="rewrite-text">{rewritten}</div>
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          {rewriteError && (
            <div className="rewrite-error">{rewriteError}</div>
          )}
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
