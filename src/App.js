import "./styles.css";
import React, { useState } from "react";
import { dictionary } from "./Dictionary";
import ReverseDictionary from "./Reverse";
import { ReverseTng } from "./ReverseTngDict";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  const [user, setUser] = useState(""); // Input from user
  const [result, setResult] = useState(""); // Decoding results
  const [page, setPage] = useState(false); // Page toggling (Decoder vs Acronym Finder)
  const [tng, setTng] = useState(false); // Toggle between CFC and STARCOM
  
  // Function to navigate to Londle
  const handleClick = () => {
    window.location.href = "https://londle.vercel.app/";
  };

  // Function to toggle between STARCOM and CFC
  const handleTng = () => {
    setTng((prev) => !prev);
    setResult(""); // Reset result when switching dictionaries
  };

  // Function to toggle between pages (Acronym Finder and Decoder)
  const PageChange = () => {
    setPage((prev) => !prev);
  };

  // Combined function for checking acronyms and abbreviations
  const checkAcronyms = (user, dict) => {
    if (!user) return;

    const cleanSentence = user.replace(/--/g, " ");
    const inputWords = cleanSentence
      .toUpperCase()
      .split(" ")
      .map((word) => word.replace(/[;:.,!—]/g, ""));

    const exactMatches = new Set();
    const possibleMatches = new Set();

    // Check for exact matches
    if (dict.hasOwnProperty(cleanSentence.toUpperCase())) {
      setResult(`Possible Acronym(s): ${cleanSentence}: ${dict[cleanSentence.toUpperCase()]}`);
      return;
    }

    // Check for partial matches
    Object.keys(dict).forEach((key) => {
      if (cleanSentence.toUpperCase().includes(key.toUpperCase())) {
        exactMatches.add(`${key}: ${dict[key]}`);
      }
    });

    if (exactMatches.size > 0) {
      setResult(`Possible Acronym(s): ${Array.from(exactMatches).join(", ")}`);
      return;
    }

    // Check for possible matches based on word prefixes
    inputWords.forEach((word) => {
      const prefix = word.substring(0, 8);
      Object.keys(dict).forEach((key) => {
        if (key.toUpperCase().startsWith(prefix)) {
          possibleMatches.add(`${key}: ${dict[key]}`);
        }
      });
    });

    if (possibleMatches.size > 0) {
      setResult(`Possible Acronym(s): ${Array.from(possibleMatches).join(", ")}`);
    } else {
      setResult("No matches found.");
    }
  };

  // Choose which dictionary to use based on the training flag (tng)
  const dictionaryToUse = tng ? ReverseTng : dictionary;

  // Main rendering logic based on `page` and `tng` states
  return (
    <div className="app-container">
      <h1>{page ? `Reverse Acronym Decoder${tng ? " STARCOM" : " CFC"}` : "Acronym/Abbreviation Finder"}</h1>
      <Analytics />

      {page ? (
        // Reverse Dictionary (Decoder) page
        <ReverseDictionary training={tng} />
      ) : (
        // Acronym Finder page
        <>
          <p>
            Improve your EPR bullet's conciseness. Paste your bullet into the box below, and this tool will identify potential acronyms and abbreviations to replace lengthy phrases.
          </p>
          <textarea
            placeholder="Paste your bullet here..."
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
          <div className="button-group">
            <button onClick={() => checkAcronyms(user, dictionaryToUse)}>Find Acronyms</button>
          </div>
          {user && <div className="user-output">{user}</div>}
          {result && <div className="result">{result}</div>}
        </>
      )}

      {/* Footer with page change and Londle links */}
      <div className="button-group">
        <button onClick={PageChange}>{page ? "Acronym Finder" : "Decoder"}</button>
        <button onClick={handleTng}>{tng ? "CFC" : "STARCOM"}</button>
        <button onClick={handleClick}>Londle</button>
      </div>

      <footer>Please notify all errors to Spc4 Bryant</footer>
    </div>
  );
}
