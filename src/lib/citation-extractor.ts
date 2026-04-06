/**
 * TF-IDF citation extractor.
 *
 * TF  (term frequency)  = occurrences of term in doc / total terms in doc
 * IDF (inverse doc freq) = log(N / docs_containing_term) + 1  (smoothed)
 *
 * A word like "split" that appears in multiple notes gets a low IDF and
 * therefore barely contributes to any note's score, even if it appears in
 * the query. Highly specific words ("squat", "deadlift", "caching", "useRef")
 * appear in few notes and get a high IDF, driving correct attribution.
 *
 * After scoring, notes below 30 % of the top score are dropped so the UI
 * never shows obviously unrelated sources.
 */

import { noteContents } from "@/data/mock";
import type { Citation } from "@/types/domain";

const STOP_WORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are",
  "as","at","be","because","been","before","being","below","between","both","but",
  "by","can","did","do","does","doing","don","down","during","each","few","for",
  "from","further","get","got","had","has","have","having","he","her","here","hers",
  "him","his","how","i","if","in","into","is","it","its","itself","just","me","more",
  "most","my","myself","no","nor","not","now","of","off","on","once","only","or",
  "other","our","out","over","own","same","she","should","so","some","such","than",
  "that","the","their","them","then","there","these","they","this","those","through",
  "to","too","under","until","up","us","was","we","were","what","when","where","which",
  "while","who","why","will","with","would","you","your","yours","s","t","re","ve",
  "ll","d","m","also","can","could","may","might","shall","want","like","use","using",
  "used","make","made","way","ways","let","lets","new","one","two","three","four",
  "five","six","seven","eight","nine","ten","many","much","very","well","good","best",
  "note","notes","know","think","says","said","see","example","need","needs",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\b[a-z][a-z0-9]{2,}\b/g) ?? []).filter(
    (t) => !STOP_WORDS.has(t)
  );
}

/** Find the sentence in content that contains the most keyword hits. */
function bestExcerpt(content: string, keywords: Set<string>): string {
  const sentences = content
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.replace(/^#+\s*/, "").trim())
    .filter((s) => s.length > 30 && s.length < 300);

  if (sentences.length === 0) return content.slice(0, 160).trim();

  let best = sentences[0];
  let bestHits = 0;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const hits = [...keywords].filter((kw) => lower.includes(kw)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = sentence;
    }
  }

  return best.length > 180 ? best.slice(0, 177) + "…" : best;
}

// Pre-compute IDF for all tokens across all notes (stays constant per session).
const allDocContents = Object.values(noteContents);
const N = allDocContents.length;

function idf(term: string): number {
  const docsContaining = allDocContents.filter((d) =>
    d.toLowerCase().includes(term)
  ).length;
  if (docsContaining === 0) return 0;
  // Smoothed IDF — terms in every doc get score 1; rare terms get higher.
  return Math.log(N / docsContaining) + 1;
}

/**
 * Score each note against the user query + AI reply using TF-IDF.
 * Returns top-k citations, filtering out notes below 30 % of the top score.
 */
export function extractCitations(
  userQuery: string,
  _aiReply: string,
  topK = 3
): Citation[] {
  // Score on query tokens only (the user's intent) to avoid false matches
  // on incidental words the LLM happened to use in its reply.
  const queryTokens = [...new Set(tokenize(userQuery))];
  if (queryTokens.length === 0) return [];

  const scored: { docTitle: string; rawScore: number; excerpt: string }[] = [];

  for (const [filename, content] of Object.entries(noteContents)) {
    const docTokens = tokenize(content);
    const docLength = Math.max(docTokens.length, 1);

    let score = 0;

    for (const term of queryTokens) {
      const termCount = docTokens.filter((t) => t === term).length;
      if (termCount === 0) continue;

      const tf = termCount / docLength;
      score += tf * idf(term);
    }

    if (score > 0) {
      scored.push({
        docTitle: filename,
        rawScore: score,
        excerpt: bestExcerpt(content, new Set(queryTokens)),
      });
    }
  }

  scored.sort((a, b) => b.rawScore - a.rawScore);

  const topScore = scored[0]?.rawScore ?? 0;
  if (topScore === 0) return [];

  // Drop any note that scores less than 30 % of the top note.
  const MIN_RELATIVE = 0.30;
  const relevant = scored.filter((s) => s.rawScore >= topScore * MIN_RELATIVE);

  const top = relevant.slice(0, topK);
  const max = top[0]?.rawScore;

  return top.map((s, i) => ({
    id: `cit-${Date.now()}-${i}`,
    docTitle: s.docTitle,
    excerpt: s.excerpt,
    score: Math.min(1, s.rawScore / max),
  }));
}
