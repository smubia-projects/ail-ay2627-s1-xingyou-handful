// Checks how typed text becomes fingerspelling letters (lib/spell.ts).
// Run with:  node tests/spell.test.mts
import { hasDoubleLetter, hasMovingLetter, MAX_LETTERS, spellOut } from "../lib/spell.ts";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  if (!ok) console.log(`FAIL  ${name}${detail ? `: ${detail}` : ""}`);
}
const letters = (text: string) => spellOut(text).words.map((word) => word.join(""));

check("a name is spelled letter by letter, in capitals", JSON.stringify(spellOut("Anna").words) === JSON.stringify([["A", "N", "N", "A"]]));
check("capitals and lower case give the same letters", letters("aNnA")[0] === "ANNA" && letters("ANNA")[0] === "ANNA");
check("a space starts a new word", JSON.stringify(letters("Anna Lee")) === JSON.stringify(["ANNA", "LEE"]));
check("a hyphen starts a new word", JSON.stringify(letters("Mary-Ann")) === JSON.stringify(["MARY", "ANN"]));
check("extra spaces, tabs and new lines don't make empty words", JSON.stringify(letters("  Anna \t\n  Lee  ")) === JSON.stringify(["ANNA", "LEE"]));
check("an apostrophe is dropped without splitting the word: O'Brien becomes OBRIEN", JSON.stringify(letters("O'Brien")) === JSON.stringify(["OBRIEN"]) && spellOut("O'Brien").skipped.length === 0);
check("a curly apostrophe and a full stop are dropped quietly too", JSON.stringify(letters("D’Arcy St.")) === JSON.stringify(["DARCY", "ST"]) && spellOut("D’Arcy St.").skipped.length === 0);
check("accents are dropped: José becomes JOSE", JSON.stringify(letters("José Zoë Müller")) === JSON.stringify(["JOSE", "ZOE", "MULLER"]) && spellOut("José").skipped.length === 0);
check("digits and symbols are skipped and reported once each", JSON.stringify(spellOut("R2-D2 &").skipped.sort()) === JSON.stringify(["&", "2"]) && JSON.stringify(letters("R2-D2")) === JSON.stringify(["R", "D"]));
check("an emoji is skipped, not turned into letters", spellOut("Sam 👍").skipped.length === 1 && JSON.stringify(letters("Sam 👍")) === JSON.stringify(["SAM"]));
check("a letter that isn't A to Z is skipped, not guessed (ß)", spellOut("Straße").skipped.includes("ß") && letters("Straße")[0] === "STRAE");
check("empty or blank text gives nothing", spellOut("").words.length === 0 && spellOut("   \n ").words.length === 0 && !spellOut("").truncated);
check("only symbols give no words, and say what was skipped", spellOut("123").words.length === 0 && spellOut("123").skipped.length === 3);
const long = "a".repeat(MAX_LETTERS + 25);
check(`more than ${MAX_LETTERS} letters is cut off and says so`, spellOut(long).words[0].length === MAX_LETTERS && spellOut(long).truncated);
check("exactly the limit is not flagged as cut off", !spellOut("a".repeat(MAX_LETTERS)).truncated && spellOut("a".repeat(MAX_LETTERS)).words[0].length === MAX_LETTERS);
check("the limit counts letters across words", spellOut("abcdefghij klmnopqrst uvwxyzabcd ef").words.flat().length === MAX_LETTERS && spellOut("abcdefghij klmnopqrst uvwxyzabcd ef").truncated);
check("28 letters across words is under the limit and not cut off", spellOut("abcdefghij klmnopqrst uvwxyz ab").words.flat().length === 28 && !spellOut("abcdefghij klmnopqrst uvwxyz ab").truncated);
check("every letter A to Z can be spelled", letters("abcdefghijklmnopqrstuvwxyz")[0] === "ABCDEFGHIJKLMNOPQRSTUVWXYZ");

check("double letters are noticed inside a word (ELLA)", hasDoubleLetter(spellOut("Ella").words));
check("a letter ending one word and starting the next is not a double (SAM MIA)", !hasDoubleLetter(spellOut("Sam Mia").words) && hasDoubleLetter(spellOut("Anna").words));
check("no double letters in a name without them", !hasDoubleLetter(spellOut("Sam").words));
check("J and Z are noticed as moving letters", hasMovingLetter(spellOut("Jazz").words) && hasMovingLetter(spellOut("Zoe").words) && !hasMovingLetter(spellOut("Sam").words));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
