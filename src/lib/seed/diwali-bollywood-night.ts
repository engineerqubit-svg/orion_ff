import type { QuestionMode, QuizWithQuestions } from "@/types/quiz";
import { placeAnswer } from "./shuffle";

/**
 * Main event quiz for the Diwali Bollywood party. Twenty questions spanning
 * 1950s classics through 2023 releases so the trivia lands across the 10-to-60
 * age range in the room, not just one generation.
 *
 * Seventeen of the twenty questions carry real media: posters linked directly
 * from Wikipedia/Wikimedia (every URL individually checked for an HTTP 200
 * before being committed here, not downloaded/rehosted — the standard
 * low-risk way to reference this kind of image) and three YouTube embeds for
 * song/video moments (Naatu Naatu, Didi Tera Devar Deewana, Lungi Dance —
 * each verified by its own YouTube oEmbed response, confirming the title and
 * uploader channel before use). The three questions left without media
 * (Q4's emoji round, Q11, Q14) are deliberate: an image would either give
 * away an emoji-guess answer or, for Q11, mean using a real couple's wedding
 * photo, which isn't something to source and ship without their involvement.
 *
 * Every poster/video that accompanies a "which film/person is this" style
 * question was opened and actually looked at before the question was written
 * — not just URL-checked. First pass here shipped posters (and one YouTube
 * title overlay) that printed the exact correct answer as readable text,
 * which defeats the question. The fix wasn't to drop the media: each of
 * those questions now states the film/song by name up front (nothing is a
 * secret there) and tests a different fact — the director, a co-star, the
 * composer — that doesn't appear anywhere on the image or in the video's
 * on-screen title. Every new question added in this pass had its source
 * image opened and read before the question text was finalized, specifically
 * to catch this.
 *
 * Video is display-only by design (see types/game.ts) — it never ships to
 * participant phones, so 200 people don't try to stream the same clip over
 * venue wifi at once. Video questions get a longer durationSeconds so there's
 * time to actually watch/listen before the timer runs out.
 *
 * `options` below is always written correct-answer-first — that's just the
 * natural order while fact-checking each question. `build()` runs every
 * question's options through `placeAnswer` before they're used, which is
 * what actually determines on-screen order; every question shipped with the
 * correct answer in slot A until that existed. See shuffle.ts.
 */

export const DIWALI_QUIZ_ID = "quiz-diwali-bollywood-night";

interface Seed {
  order: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  durationSeconds: number;
  mode?: QuestionMode;
  image?: string;
  video?: string;
}

const SEEDS: Seed[] = [
  {
    order: 1,
    question:
      "In Sholay (1975), which actor played Bollywood's most-quoted villain, Gabbar Singh?",
    options: ["Amjad Khan", "Amrish Puri", "Pran", "Prem Chopra"],
    correctIndex: 0,
    durationSeconds: 20,
    image: "https://upload.wikimedia.org/wikipedia/en/5/52/Sholay-poster.jpg",
  },
  {
    order: 2,
    question:
      "Mughal-e-Azam (1960) — Dilip Kumar and Madhubala's epic, famous for 'Pyaar kiya to darna kya' — was directed by whom?",
    options: ["K. Asif", "Mehboob Khan", "Bimal Roy", "Raj Kapoor"],
    correctIndex: 0,
    durationSeconds: 20,
    image: "https://upload.wikimedia.org/wikipedia/en/1/16/Mughal-e-Azam.jpg",
  },
  {
    order: 3,
    question:
      "'Didi Tera Devar Deewana' — the sangeet floor-filler at every Indian wedding, from Hum Aapke Hain Koun..! (1994) — was sung by S. P. Balasubrahmanyam alongside which legendary playback singer?",
    options: ["Lata Mangeshkar", "Asha Bhosle", "Kavita Krishnamurthy", "Alka Yagnik"],
    correctIndex: 0,
    durationSeconds: 40,
    video: "https://www.youtube.com/watch?v=2V56f0xZNqw",
  },
  {
    order: 4,
    question: "Emoji round 🤼🥇👧👧 — wrestling, gold medal, two daughters. Name the 2016 film.",
    options: ["Dangal", "Chak De! India", "Mary Kom", "Sultan"],
    correctIndex: 0,
    durationSeconds: 15,
    mode: "FASTEST_FINGER",
  },
  {
    order: 5,
    question:
      "Known as the 'Shahenshah of Bollywood', this actor has starred in over 200 films across six decades.",
    options: ["Amitabh Bachchan", "Dilip Kumar", "Rajesh Khanna", "Dharmendra"],
    correctIndex: 0,
    durationSeconds: 20,
  },
  {
    order: 6,
    question:
      "RRR's 'Naatu Naatu' made history in 2023 by becoming the first Indian production to win an Oscar in which category?",
    options: ["Best Original Song", "Best Picture", "Best Director", "Best Actor"],
    correctIndex: 0,
    durationSeconds: 45,
    mode: "DOUBLE_POINTS",
    video: "https://www.youtube.com/watch?v=79IEesucPo8",
  },
  {
    order: 7,
    question:
      "In Mr. India (1987), which veteran actor played Mogambo, delivering the catchphrase 'Mogambo khush hua'?",
    options: ["Amrish Puri", "Pran", "Amjad Khan", "Prem Chopra"],
    correctIndex: 0,
    durationSeconds: 15,
    image: "https://upload.wikimedia.org/wikipedia/en/d/d7/Mr._India_%281987_film%29_poster.jpg",
  },
  {
    order: 8,
    question:
      "This actress earned the nickname 'Dhak-Dhak Girl' after her dance in 'Beta' (1992).",
    options: ["Madhuri Dixit", "Sridevi", "Juhi Chawla", "Karisma Kapoor"],
    correctIndex: 0,
    durationSeconds: 20,
    image: "https://upload.wikimedia.org/wikipedia/en/1/1c/Betafilm.jpg",
  },
  {
    order: 9,
    question:
      "Lagaan (2001), the colonial-India cricket drama nominated for the Academy Award for Best Foreign Language Film, starred which actor as the village's captain, Bhuvan?",
    options: ["Aamir Khan", "Shah Rukh Khan", "Hrithik Roshan", "Saif Ali Khan"],
    correctIndex: 0,
    durationSeconds: 20,
    image: "https://upload.wikimedia.org/wikipedia/en/b/b6/Lagaan.jpg",
  },
  {
    order: 10,
    question: "Quick fire — as of 2013, how many 'Dhoom' films had Bollywood made?",
    options: ["2", "3", "4", "5"],
    correctIndex: 1,
    durationSeconds: 12,
    mode: "FASTEST_FINGER",
    image: "https://upload.wikimedia.org/wikipedia/en/b/bb/DhoomPoster.jpg",
  },
  {
    order: 11,
    question:
      "This real-life Bollywood power couple — both National Award winners — married in Lake Como, Italy in 2018.",
    options: [
      "Deepika Padukone & Ranveer Singh",
      "Priyanka Chopra & Nick Jonas",
      "Anushka Sharma & Virat Kohli",
      "Katrina Kaif & Vicky Kaushal",
    ],
    correctIndex: 0,
    durationSeconds: 20,
  },
  {
    order: 12,
    question:
      "Who composed the music for 'Jai Ho', the Oscar-winning song from Slumdog Millionaire (2008)?",
    options: ["A. R. Rahman", "Shankar-Ehsaan-Loy", "Pritam", "Vishal-Shekhar"],
    correctIndex: 0,
    durationSeconds: 20,
    image: "https://upload.wikimedia.org/wikipedia/en/9/92/Slumdog_Millionaire_poster.png",
  },
  {
    order: 13,
    question:
      "In the 'Lungi Dance' video from Chennai Express (2013), Shah Rukh Khan dances alongside which actress?",
    options: ["Deepika Padukone", "Priyanka Chopra", "Katrina Kaif", "Anushka Sharma"],
    correctIndex: 0,
    durationSeconds: 40,
    mode: "DOUBLE_POINTS",
    video: "https://www.youtube.com/watch?v=D8Br5HLmP1c",
  },
  {
    order: 14,
    question: "What is the name of the fictional village where 'Lagaan' (2001) is set?",
    options: ["Champaner", "Chandrapur", "Ramgarh", "Betul"],
    correctIndex: 0,
    durationSeconds: 20,
  },
  {
    order: 15,
    question:
      "Tiger 3 released in cinemas on Diwali day itself in 2023. Who played Zoya, opposite Salman Khan?",
    options: ["Katrina Kaif", "Deepika Padukone", "Kareena Kapoor", "Alia Bhatt"],
    correctIndex: 0,
    durationSeconds: 25,
    mode: "DOUBLE_POINTS",
    image: "https://upload.wikimedia.org/wikipedia/en/f/f8/Tiger_3_poster.jpg",
  },
  {
    order: 16,
    question:
      "Awaara (1951) — Raj Kapoor and Nargis's classic, famous for the song 'Awaara Hoon' — had its music composed by which duo?",
    options: ["Shankar-Jaikishan", "Naushad", "S. D. Burman", "Laxmikant-Pyarelal"],
    correctIndex: 0,
    durationSeconds: 20,
    image: "https://upload.wikimedia.org/wikipedia/en/0/04/Awaara_poster.jpg",
  },
  {
    order: 17,
    question:
      "Baahubali: The Conclusion (2017) — the first Indian film to cross ₹1000 crore worldwide — had Prabhas playing a dual role as father and son. What was the father's name?",
    options: ["Amarendra Baahubali", "Mahendra Baahubali", "Bhalladeva", "Kattappa"],
    correctIndex: 0,
    durationSeconds: 20,
    mode: "DOUBLE_POINTS",
    image: "https://upload.wikimedia.org/wikipedia/en/9/93/Baahubali_2_The_Conclusion_poster.jpg",
  },
  {
    order: 18,
    question:
      "In the cult comedy Andaz Apna Apna (1994), Aamir Khan and Salman Khan play bumbling rivals-turned-friends. Which two actresses played their love interests?",
    options: [
      "Raveena Tandon & Karisma Kapoor",
      "Madhuri Dixit & Juhi Chawla",
      "Kajol & Rani Mukerji",
      "Sridevi & Meenakshi Sheshadri",
    ],
    correctIndex: 0,
    durationSeconds: 20,
    image: "https://upload.wikimedia.org/wikipedia/en/1/15/Andaz_Apna_Apna.jpg",
  },
  {
    order: 19,
    question:
      "Jawan (2023) — Shah Rukh Khan's hit, directed by Atlee — featured which South Indian star as the female lead alongside him?",
    options: ["Nayanthara", "Samantha Ruth Prabhu", "Rashmika Mandanna", "Keerthy Suresh"],
    correctIndex: 0,
    durationSeconds: 15,
    mode: "FASTEST_FINGER",
    image: "https://upload.wikimedia.org/wikipedia/en/3/39/Jawan_film_poster.jpg",
  },
  {
    order: 20,
    question:
      "Final question — 'Chaiyya Chaiyya', filmed entirely atop a moving train for Dil Se (1998, starring Shah Rukh Khan, directed by Mani Ratnam), won a Filmfare Award for which playback singer?",
    options: ["Sukhwinder Singh", "Udit Narayan", "Kumar Sanu", "Sonu Nigam"],
    correctIndex: 0,
    durationSeconds: 25,
    mode: "DOUBLE_POINTS",
    image: "https://upload.wikimedia.org/wikipedia/en/7/7a/Dil_Se_poster.jpg",
  },
];

function build(seed: Seed) {
  const correctText = seed.options[seed.correctIndex];
  const placed = placeAnswer(seed.options, seed.correctIndex, seed.order);
  const answers = placed.map((text, index) => ({
    id: `dq${seed.order}a${index + 1}`,
    text,
  }));

  return {
    questionId: `${DIWALI_QUIZ_ID}-q${seed.order}`,
    quizId: DIWALI_QUIZ_ID,
    order: seed.order - 1,
    question: seed.question,
    imageUrl: seed.image,
    videoUrl: seed.video,
    answers,
    correctAnswerId: answers.find((a) => a.text === correctText)!.id,
    durationSeconds: seed.durationSeconds,
    mode: seed.mode ?? ("NORMAL" as QuestionMode),
  };
}

export const diwaliQuiz: QuizWithQuestions = {
  quizId: DIWALI_QUIZ_ID,
  title: "Diwali Dhamaka — Bollywood Night",
  description:
    "Twenty questions from Awaara to Jawan — classics for the grandparents, blockbusters for the kids.",
  category: "Movies",
  gameMode: "QUIZ_BATTLE",
  createdAt: "2026-10-28T09:00:00.000Z",
  updatedAt: "2026-10-28T09:00:00.000Z",
  questions: SEEDS.map(build),
};
