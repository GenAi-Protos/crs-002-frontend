// Fixture-backed question resolution. The routing between held corpus, live
// lookup and keyword search is the system's decision and is never named in UI.

import { INVESTIGATIONS } from "./fixtures";
import type { Answer } from "./types";

// The fixture-free half lives in lib/turn.ts; re-exported so nothing that
// imported them from here has to move.
export { makeTurn, nextTurnId, STARTER_PROMPTS } from "./turn";

const CANNED: { match: RegExp; investigationId: string; turnIndex: number }[] = [
  { match: /secur32/i, investigationId: "inv-wp2shell", turnIndex: 1 },
  { match: /wp2shell|wordpress/i, investigationId: "inv-wp2shell", turnIndex: 0 },
  { match: /dprk|supply chain|lazarus|fleet/i, investigationId: "inv-dprk", turnIndex: 0 },
];

const DRAFT_ANSWER: Answer = {
  title: "Draft created: DPRK supply chain campaign against logistics software",
  blocks: [
    {
      kind: "prose",
      text: "Draft CPX-TIC-IA-2026-352 has been created from the held campaign records and the two supporting actor reports. The draft carries all seven IA sections, three mapped techniques and six indicators, and is assigned for review.",
      attribution: "Held corpus",
    },
  ],
  entities: [],
  citations: [
    { id: "c-d1", ref: 1, label: "Held corpus, campaign records", recordCount: 8, urlSafe: false },
  ],
  negativeResults: [],
  sourcesUnavailable: [],
  tlp: "AMBER",
  classificationSettled: true,
  egress: false,
  producedArtefact: { ref: "CPX-TIC-IA-2026-352", type: "IA" },
};

const DRAFT_ANSWER_WP2SHELL: Answer = {
  title: "Draft created: wp2shell follow-on WordPress theme flaws",
  blocks: [
    {
      kind: "prose",
      text: "Draft CPX-TIC-VA-2026-118 has been created from the held exploitation records and the vendor advisory pair. The draft carries all ten VA sections, two mapped techniques and four indicators, and is assigned for review.",
      attribution: "Held corpus",
    },
  ],
  entities: [],
  citations: [
    { id: "c-d2", ref: 1, label: "Held corpus, exploitation records", recordCount: 6, urlSafe: false },
  ],
  negativeResults: [],
  sourcesUnavailable: [],
  tlp: "GREEN",
  classificationSettled: true,
  egress: false,
  producedArtefact: { ref: "CPX-TIC-VA-2026-118", type: "VA" },
};

function fallbackAnswer(question: string): Answer {
  const q = question.replace(/[?.]+$/, "").slice(0, 60);
  return {
    blocks: [
      {
        kind: "prose",
        text: "No held record matches this question, and no connected live source returned a result. The searches that ran are listed below.",
        attribution: "Held corpus",
      },
    ],
    entities: [],
    citations: [
      { id: "c-f1", ref: 1, label: "Held corpus, full text search", recordCount: 0, urlSafe: false },
    ],
    negativeResults: [
      { query: q, recordCount: 0 },
      { query: `${q.split(" ").slice(0, 3).join(" ")} synonyms`, recordCount: 0 },
    ],
    sourcesUnavailable: [],
    tlp: "CLEAR",
    classificationSettled: true,
    egress: false,
  };
}

export function resolveQuestion(question: string): Answer {
  if (/create (an? )?(intelligence |vulnerability )?advisory|draft (an? )?advisory/i.test(question)) {
    return /wp2shell|wordpress|theme/i.test(question)
      ? DRAFT_ANSWER_WP2SHELL
      : DRAFT_ANSWER;
  }
  for (const c of CANNED) {
    if (c.match.test(question)) {
      const inv = INVESTIGATIONS.find((i) => i.id === c.investigationId);
      const turn = inv?.turns[c.turnIndex];
      if (turn?.answer) return turn.answer;
    }
  }
  return fallbackAnswer(question);
}
