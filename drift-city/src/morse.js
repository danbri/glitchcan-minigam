// ---------- Morse: one key for the whole city ----------
// The red lights on some masts and the faint tone on the radio layer key the same Morse, in step: the Asters'
// messages, in English and in the Asters' own words, round and round (a story can put its own message in MORSE.override).
// A dot is one unit (0.14 s, about 9 words a minute), a dash three; one unit between marks, three between letters,
// seven between words, and a pause between messages. EVN[209] carries the key to the shader (after computeEvents).
const MORSE_CODE = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...",
  8: "---..", 9: "----.",
};
const MORSE = { unit: 0.14, messages: ["AD ASTRA PER ASPERA", "O TAWA MUN", "KON SELI"], override: null, plan: null, key: 0, text: "" };
// a message as on/off runs, in units: [[on, length], ...], ending in the pause before the next
function morsePlan(text) {
  const runs = [];
  for (const w of text.toUpperCase().split(/\s+/)) {
    for (const ch of w) {
      const code = MORSE_CODE[ch];
      if (!code) continue;
      for (const m of code) runs.push([1, m === "." ? 1 : 3], [0, 1]);
      runs[runs.length - 1][1] = 3;
    }
    if (runs.length) runs[runs.length - 1][1] = 7;
  }
  if (runs.length) runs[runs.length - 1][1] = 24;
  return runs;
}
// the key at world time t (seconds): 1 while a mark sounds
function morseKey(t) {
  const list = MORSE.override ? [MORSE.override] : MORSE.messages, src = MORSE.override || MORSE.messages.join("|");
  if (!MORSE.plan || MORSE.plan.src !== src) {
    MORSE.plan = list.map((m) => { const r = morsePlan(m); return { text: m, runs: r, len: r.reduce((a, x) => a + x[1], 0) }; });
    MORSE.plan.src = src;
    MORSE.plan.total = MORSE.plan.reduce((a, p) => a + p.len, 0);
  }
  let u = (t / MORSE.unit) % MORSE.plan.total;
  for (const p of MORSE.plan) {
    if (u >= p.len) { u -= p.len; continue; }
    MORSE.text = p.text;
    for (const [on, n] of p.runs) { if (u < n) return (MORSE.key = on); u -= n; }
  }
  return (MORSE.key = 0);
}
