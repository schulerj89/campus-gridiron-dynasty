export class Rng {
  private state: number;

  constructor(seed = 123456789) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 123456789;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty list.");
    }
    return items[this.nextInt(0, items.length - 1)] as T;
  }

  weighted<T>(items: readonly { value: T; weight: number }[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item.value;
    }
    return items[items.length - 1]!.value;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = this.nextInt(0, index);
      [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
    }
    return copy;
  }

  fork(label: string): Rng {
    let hash = this.state;
    for (const char of label) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 2654435761) >>> 0;
    }
    return new Rng(hash || 1);
  }

  currentState(): number {
    return this.state;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number, places = 0): number {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}
