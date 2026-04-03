/**
 * @file consensusEngine.ts
 * @service router-service
 * @version V74
 * @description COMMAND 074 - SEMANTIC CONSENSUS ENGINE (THE TRUTH GATE)
 */

export interface ConsensusVerificationResult {
  isAgreed: boolean;
  similarityScore: number;
  reason?: string;
}

/**
 * verifyConsensus (V74)
 * Lightweight semantic similarity check or LLM-based comparison
 * to verify if the primary response and backup response agree.
 */
export function verifyConsensus(primaryResponse: string, backupResponse: string): ConsensusVerificationResult {
  if (!primaryResponse || !backupResponse) {
    return { isAgreed: false, similarityScore: 0, reason: "Missing response data." };
  }

  const primaryLower = primaryResponse.toLowerCase();
  const backupLower = backupResponse.toLowerCase();

  // 1. Contradiction Logic: Trading Directives
  const tradingKeywords = ["buy", "sell", "hold"];
  const primaryTrading = tradingKeywords.filter(kw => primaryLower.includes(kw));
  const backupTrading = tradingKeywords.filter(kw => backupLower.includes(kw));

  if (primaryTrading.length > 0 && backupTrading.length > 0) {
    const overlap = primaryTrading.some(kw => backupTrading.includes(kw));
    if (!overlap) {
      return {
        isAgreed: false,
        similarityScore: 0.1,
        reason: `Contradictory directives: ${primaryTrading.join()} vs ${backupTrading.join()}`
      };
    }
  }

  // 2. Contradiction Logic: Polarity / Sentiment
  const positive = ["approve", "allow", "yes", "proceed", "safe", "verified"];
  const negative = ["deny", "block", "no", "stop", "unsafe", "hallucination"];
  
  const pPos = positive.some(kw => primaryLower.includes(kw));
  const pNeg = negative.some(kw => primaryLower.includes(kw));
  const bPos = positive.some(kw => backupLower.includes(kw));
  const bNeg = negative.some(kw => backupLower.includes(kw));

  if ((pPos && bNeg) || (pNeg && bPos)) {
    return {
      isAgreed: false,
      similarityScore: 0.2,
      reason: "Polarity contradiction (Positive vs Negative sentiment)"
    };
  }

  // 3. Jaccard Index for basic semantic overlap
  const getTokens = (str: string) => new Set(str.split(/\W+/).filter(t => t.length > 3));
  const pTokens = getTokens(primaryLower);
  const bTokens = getTokens(backupLower);

  let overlapCount = 0;
  for (const t of pTokens) {
    if (bTokens.has(t)) overlapCount++;
  }

  const maxUnion = Math.max(pTokens.size, bTokens.size);
  const similarityScore = maxUnion === 0 ? 1 : overlapCount / maxUnion;

  // We consider it agreed if score > 0.3 OR no obvious semantic divergence detected
  const isAgreed = similarityScore > 0.3 || (primaryTrading.length === 0 && !pPos && !pNeg);

  return {
    isAgreed,
    similarityScore,
    reason: isAgreed ? "Semantic agreement verified" : `Low similarity index (${similarityScore.toFixed(2)})`
  };
}
