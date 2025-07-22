import "./styles.css";
import React, { useState } from "react";
import { dictionary } from "./Dictionary";
import ReverseDictionary from "./Reverse";

export default function App() {
  const [user, setUser] = useState("");
  const [result, setResult] = useState("");
  const [page, setPage] = useState(false);

  const handleClick = () => {
    window.location.href = "https://zw27g9.csb.app/";
  };

  const PageChange = () => {
    setPage((prev) => !prev);
  };

  const CheckWord = (user) => {
    if (user === "") return;

    const cleanSentence = user.replace(/--/g, " ");
    const inputWords = cleanSentence
      .toUpperCase()
      .split(" ")
      .map((word) => word.replace(/[;:.,!—]/g, ""));

    const exactMatches = new Set();
    const possibleMatches = new Set();

    if (dictionary.hasOwnProperty(cleanSentence.toUpperCase())) {
      setResult(
        `Possible Acronym(s): ${cleanSentence}: ${
          dictionary[cleanSentence.toUpperCase()]
        }`
      );
      return;
    }

    Object.keys(dictionary).forEach((key) => {
      if (cleanSentence.toUpperCase().includes(key.toUpperCase())) {
        exactMatches.add(`${key}: ${dictionary[key]}`);
      }
    });

    if (exactMatches.size > 0) {
      setResult(`Possible Acronym(s): ${Array.from(exactMatches).join(", ")}`);
      return;
    }

    inputWords.forEach((word) => {
      const prefix = word.substring(0, 8);
      Object.keys(dictionary).forEach((key) => {
        if (key.toUpperCase().startsWith(prefix)) {
          possibleMatches.add(`${key}: ${dictionary[key]}`);
        }
      });
    });

    if (possibleMatches.size > 0) {
      setResult(
        `Possible Acronym(s): ${Array.from(possibleMatches).join(", ")}`
      );
    } else {
      setResult("No matches found.");
    }
  };

  if (page) {
    return (
      <div className="app-container">
        <h1>Reverse Acronym Decoder</h1>
        <ReverseDictionary />
        <div className="button-group">
          <button onClick={PageChange}>Acronym Finder</button>
          <button onClick={handleClick}>Londle</button>
        </div>
        <footer>Please notify all errors to Spc4 Bryant</footer>
      </div>
    );
  }

  return (
    <div className="app-container">
      <h1>Acronym/Abbreviation Finder</h1>
      <p>
        Improve your EPR bullet's conciseness. Paste your bullet into the box
        below, and this tool will identify potential acronyms and abbreviations
        to replace lengthy phrases.
      </p>

      <textarea
        placeholder="Paste your bullet here..."
        value={user}
        onChange={(e) => setUser(e.target.value)}
      />

      <div className="button-group">
        <button onClick={() => CheckWord(user)}>Find Acronyms</button>
      </div>
      {user && <div className="user-output">{user}</div>}
      {result && <div className="result">{result}</div>}
      <div className="button-group">
        <button onClick={PageChange}>Decoder</button>
        <button onClick={handleClick}>Londle</button>
      </div>

      <footer>Please notify all errors to Spc4 Bryant</footer>
    </div>
  );
}
