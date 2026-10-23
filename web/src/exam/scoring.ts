export const PASS_MARK = 0.7

export function questionScore(named: boolean, identifiedCorrectly: boolean, passed: number, total: number): number {
  const checks = total > 0 ? passed / total : 0
  if (named) return checks
  return 0.2 * (identifiedCorrectly ? 1 : 0) + 0.8 * checks
}

export function sessionScore(scores: number[]): number {
  return scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length
}

export function isPass(score: number): boolean {
  return score >= PASS_MARK - 1e-9
}

/** Whole-number percent for display. Floors, so "70%" always means the pass mark was reached. */
export function scorePercent(score: number): number {
  return Math.floor((score + 1e-9) * 100)
}
