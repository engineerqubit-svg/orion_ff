/**
 * Seed word bank, grouped so categories can be picked per game later without
 * touching the engine.
 */

export const WORD_CATEGORIES = [
  "Office",
  "Technology",
  "Bollywood",
  "Movies",
  "Food",
  "India",
  "Random",
] as const;

export type WordCategory = (typeof WORD_CATEGORIES)[number];

export const WORD_BANK: Record<WordCategory, string[]> = {
  Office: [
    "Coffee Machine",
    "Meeting",
    "Boss",
    "Deadline",
    "Friday",
    "Office Chair",
    "Printer",
    "Air Conditioner",
    "Zoom Call",
    "Presentation",
    "Lunch Break",
    "Intern",
    "Project Manager",
    "Client Meeting",
    "Overtime",
    "Whiteboard",
    "Standup",
    "Appraisal",
    "Water Cooler",
    "Notice Period",
  ],
  Technology: [
    "Laptop",
    "Mouse",
    "Keyboard",
    "Developer",
    "Designer",
    "Bug",
    "Server",
    "WiFi",
    "Password",
    "GitHub",
    "Merge Conflict",
    "Loading Screen",
    "Render",
    "3D Model",
    "VR Headset",
    "Projector",
    "Firewall",
    "Cloud",
    "Robot",
    "Satellite",
  ],
  Bollywood: [
    "Devdas",
    "Sholay",
    "Dhoom",
    "Bajrangi Bhaijaan",
    "Item Song",
    "Filmfare Award",
    "Playback Singer",
    "Dance Number",
    "Villain",
    "Interval",
  ],
  Movies: [
    "Popcorn",
    "Cinema Hall",
    "Director",
    "Clapperboard",
    "Red Carpet",
    "Superhero",
    "Time Machine",
    "Alien",
    "Pirate Ship",
    "Haunted House",
  ],
  Food: [
    "Samosa",
    "Biryani",
    "Vada Pav",
    "Filter Coffee",
    "Ice Cream",
    "Birthday Cake",
    "Pizza Slice",
    "Chai",
    "Golgappa",
    "Masala Dosa",
  ],
  India: [
    "Taj Mahal",
    "Auto Rickshaw",
    "Traffic Jam",
    "Monsoon",
    "Cricket Match",
    "Local Train",
    "Kite Flying",
    "Diwali",
    "Elephant",
    "Chai Stall",
  ],
  Random: [
    "Umbrella",
    "Sandcastle",
    "Snowman",
    "Treasure Map",
    "Hot Air Balloon",
    "Lighthouse",
    "Roller Coaster",
    "Traffic Light",
    "Fishing Rod",
    "Windmill",
  ],
};

const ALL_WORDS: { word: string; category: WordCategory }[] = (
  Object.entries(WORD_BANK) as [WordCategory, string[]][]
).flatMap(([category, words]) => words.map((word) => ({ word, category })));

/**
 * Three choices for the drawer, never repeating a word already used this game.
 * Falls back to allowing repeats once the bank is exhausted.
 */
export function pickWordChoices(
  usedWords: string[],
  categories: readonly WordCategory[] = WORD_CATEGORIES,
  count = 3,
): { word: string; category: WordCategory }[] {
  const allowed = new Set(categories);
  const used = new Set(usedWords.map((w) => w.toLowerCase()));

  const pool = ALL_WORDS.filter((entry) => allowed.has(entry.category));
  const fresh = pool.filter((entry) => !used.has(entry.word.toLowerCase()));
  const source = fresh.length >= count ? fresh : pool;

  const picked: { word: string; category: WordCategory }[] = [];
  const taken = new Set<number>();

  while (picked.length < Math.min(count, source.length)) {
    const index = Math.floor(Math.random() * source.length);
    if (taken.has(index)) continue;
    taken.add(index);
    picked.push(source[index]!);
  }

  return picked;
}
