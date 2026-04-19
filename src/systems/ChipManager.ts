export class ChipManager {
  private chips: number;
  private readonly listeners = new Set<(chips: number) => void>();

  public constructor(initial: number) {
    this.chips = initial;
  }

  public get value(): number {
    return this.chips;
  }

  public add(amount: number): void {
    if (amount <= 0) return;
    this.chips += amount;
    this.emit();
  }

  public canAfford(cost: number): boolean {
    return this.chips >= cost;
  }

  public spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.chips -= cost;
    this.emit();
    return true;
  }

  public onChange(listener: (chips: number) => void): () => void {
    this.listeners.add(listener);
    listener(this.chips);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.chips);
  }
}
