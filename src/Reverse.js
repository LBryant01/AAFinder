import React, { useState } from "react";
import { dictionary } from "./ReverseDictionary"; // Assuming dictionary is imported from ReverseDictionary.js
import { TngDict } from "./TngDict";

export default function ReverseDictionary({ training }) {
  const [user, setUser] = useState(""); // Stores the input from the user
  const [result, setResult] = useState("");

  const dict = training ? TngDict : dictionary; // Determine which dictionary to use

  // Function for checking words in the selected dictionary
  const checkWords = (user) => {
    // Replace double hyphens '--' with a space to handle cases like '--'
    const cleanSentence = user.replace(/--/g, " ");

    // Split sentence into words and remove punctuation
    const inputWords = cleanSentence
      .toUpperCase()
      .split(" ") // Split into individual words
      .map((word) => word.replace(/[;:.,!—]/g, "")); // Remove punctuation from each word

    // Create a set to store matches (to avoid duplicates)
    const matches = new Set();

    // Search for multi-word keys in the dictionary first
    Object.keys(dict).forEach((key) => {
      // For multi-word keys, check if they exist in the sentence
      const keyWords = key.toUpperCase().split(" ");
      const regex = new RegExp(`\\b${keyWords.join("\\s+")}\\b`, "i"); // Match multi-word key
      if (regex.test(cleanSentence)) {
        matches.add(`${key}: ${dict[key]}`);
      }
    });

    // Search for individual word matches in the dictionary
    inputWords.forEach((word) => {
      // Check if the word exists as a key in the dictionary
      if (dict.hasOwnProperty(word)) {
        matches.add(`${word}: ${dict[word]}`);
      }
    });

    if (matches.size > 0) {
      // Set the result with the matched acronyms and abbreviations
      setResult(
        <div>
          <p>Possible Acronyms/Abbreviations:</p>
          {Array.from(matches).map((match, index) => (
            <p key={index}>{match}</p>
          ))}
        </div>
      );
    } else {
      setResult(<div>No match.</div>);
    }
  };

  return (
    <div>
      <p>
        Input your bullet into the text box below to decode acronyms and
        abbreviations.
      </p>
      <br />
      <textarea
        placeholder="Paste your bullet here..."
        value={user}
        onChange={(e) => setUser(e.target.value)} // Update user state on input change
      />
      <div className="button-group">
        <button onClick={() => checkWords(user)}>Decode Acronyms</button>{" "}
        {/* Trigger checkWords on button click */}
      </div>
      {/* Display the result */}
      <br />
      <br />
      {user && <div className="user-output">{user}</div>}
      {result && <div className="result">{result}</div>}
    </div>
  );
}

