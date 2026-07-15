// Weighted random pick with anti-repetition correction.
// Correction is 2^-(c_i - T·d_i) where c_i is counter, T is total picks,
// d_i = w_i / Σw_j is the desired share.
// When c_i = T·d_i (exactly on target) correction is 1 (neutral).
// One pick above target halves the effective weight, one below doubles it.
export class Cooldown {
  private weights = new Map<string, number>();
  private counters = new Map<string, number>();
  private keys: string[];
  private totalWeight: number;
  private totalPicks = 0;

  constructor(weights: Map<string, number>) {
    this.keys = [...weights.keys()];
    this.totalWeight = this.keys.reduce(
      (s, k) => s + (weights.get(k) ?? 0),
      0,
    );
    for (const [key, weight] of weights) {
      this.weights.set(key, weight);
    }
  }

  countersSnapshot(): Map<string, number> {
    const result = new Map<string, number>();
    for (const k of this.keys) {
      result.set(k, this.counters.get(k) ?? 0);
    }
    return result;
  }

  probabilities(): Map<string, number> {
    const result = new Map<string, number>();
    if (this.totalWeight === 0) {
      const uniform = 1 / this.keys.length;
      for (const k of this.keys) {
        result.set(k, uniform);
      }
      return result;
    }
    const total = this.keys.reduce((s, k) => {
      const weight = this.weights.get(k) ?? 0;
      const counter = this.counters.get(k) ?? 0;
      const desired = this.totalPicks * (weight / this.totalWeight);
      const excess = counter - desired;
      return s + weight * Math.pow(2, -excess);
    }, 0);
    for (const k of this.keys) {
      const weight = this.weights.get(k) ?? 0;
      const counter = this.counters.get(k) ?? 0;
      const desired = this.totalPicks * (weight / this.totalWeight);
      const excess = counter - desired;
      result.set(k, (weight * Math.pow(2, -excess)) / total);
    }
    return result;
  }

  pick(): string {
    const probs = this.probabilities();
    let r = Math.random();
    for (const k of this.keys) {
      r -= probs.get(k) ?? 0;
      if (r <= 0) {
        this.counters.set(k, (this.counters.get(k) ?? 0) + 1);
        this.totalPicks++;
        return k;
      }
    }
    const last = this.keys[this.keys.length - 1];
    this.counters.set(last, (this.counters.get(last) ?? 0) + 1);
    this.totalPicks++;
    return last;
  }
}
