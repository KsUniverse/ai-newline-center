const VECTOR_DIMENSION = 64;

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

export function tokenizeLearningText(input: string): string[] {
  const normalized = input.trim();
  if (!normalized) {
    return [];
  }

  const phraseTokens = Array.from(normalized.matchAll(/[\p{L}\p{N}]{1,32}/gu)).map((match) =>
    normalizeToken(match[0]),
  );
  const charTokens = Array.from(normalized.replace(/\s+/g, "")).slice(0, 256).map((char) =>
    normalizeToken(char),
  );

  return [...phraseTokens, ...charTokens].filter(Boolean);
}

function hashToken(token: string): number {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function buildLearningEmbedding(text: string): number[] {
  const vector = Array.from({ length: VECTOR_DIMENSION }, () => 0);
  const tokens = tokenizeLearningText(text);

  for (const token of tokens) {
    const bucket = hashToken(token) % VECTOR_DIMENSION;
    vector[bucket] = (vector[bucket] ?? 0) + 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const size = Math.min(left.length, right.length);
  if (size === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < size; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}
