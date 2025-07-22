import React, { useState } from "react";
import { dictionary } from "./ReverseDictionary"; // Assuming dictionary is imported from ReverseDictionary.js

export default function ReverseDictionary() {
  const [user, setUser] = useState(""); // Stores the input from the user
  const [result, setResult] = useState(""); // Stores the result of checking the word

  // Function for regular key lookup
  const CheckWord = (user) => {
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
    Object.keys(dictionary).forEach((key) => {
      // For multi-word keys, check if they exist in the sentence
      const keyWords = key.toUpperCase().split(" ");
      const regex = new RegExp(`\\b${keyWords.join("\\s+")}\\b`, "i"); // Match multi-word key
      if (regex.test(cleanSentence)) {
        matches.add(`${key}: ${dictionary[key]}`);
      }
    });

    // Search for individual word matches in the dictionary
    inputWords.forEach((word) => {
      // Check if the word exists as a key in the dictionary
      if (dictionary.hasOwnProperty(word)) {
        matches.add(`${word}: ${dictionary[word]}`);
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
        <button onClick={() => CheckWord(user)}>Decode Acronyms</button>{" "}
        {/* Trigger CheckWord on button click */}
      </div>
      {/* Display the result */}
      <br />
      <br />
      {user && <div className="user-output">{user}</div>}
      {result && <div className="result">{result}</div>}
    </div>
  );
}
