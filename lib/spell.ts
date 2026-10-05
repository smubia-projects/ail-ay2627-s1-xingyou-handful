// Turns typed text into the letters to fingerspell, for the "Spell it" page. Pure logic, so it can be
// tested on its own (tests/spell.test.mts).
//
// Names and words with no sign of their own are fingerspelled one letter at a time. Only the 26 letters
// exist as handshapes in Handful, so accents are dropped (é becomes e), and anything else that isn't a
// letter is left out and reported back, so the page can say what it skipped.

// The longest spelling shown, so a pasted paragraph doesn't fill the screen.
export const MAX_LETTERS = 30;

export type Spelling = {
  // The letters of each word, in order. A space or hyphen starts a new word.
  words: string[][];
  // Characters that couldn't be spelled (digits, symbols, emoji and so on), once each.
  skipped: string[];
  // True when the text was longer than MAX_LETTERS and was cut off.
  truncated: boolean;
};

export function spellOut(text: string): Spelling {
  const words: string[][] = [];
  const skipped = new Set<string>();
  let current: string[] = [];
  let total = 0;
  let truncated = false;
  const endWord = () => {
    if (current.length) words.push(current);
    current = [];
  };

  for (const char of text.normalize("NFD")) {
    // Accent marks come apart from their letter, and are dropped.
    if (/[̀-ͯ]/.test(char)) continue;
    const upper = char.toUpperCase();
    if (upper.length === 1 && upper >= "A" && upper <= "Z") {
      if (total >= MAX_LETTERS) {
        truncated = true;
        break;
      }
      current.push(upper);
      total++;
    } else if (/[\s\-–—_]/.test(char)) {
      endWord();
    } else if (/['’`.]/.test(char)) {
      // Apostrophes and full stops are just punctuation: O'Brien is spelled OBRIEN, with no note.
    } else if (char.trim()) {
      skipped.add(char);
    }
  }
  endWord();
  return { words, skipped: [...skipped], truncated };
}

// A letter signed twice in a row inside a word, like the LL in ELLA.
export const hasDoubleLetter = (words: string[][]) => words.some((word) => word.some((letter, i) => i > 0 && word[i - 1] === letter));

// J and Z are traced in the air, not held still.
export const hasMovingLetter = (words: string[][]) => words.some((word) => word.some((letter) => letter === "J" || letter === "Z"));
