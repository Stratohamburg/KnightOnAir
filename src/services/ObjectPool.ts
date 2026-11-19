export class ObjectPool<T extends { active: boolean }> {
  readonly items: T[];
  private cursor = 0;
  constructor(size: number, factory: () => T) {
    this.items = Array.from({ length: size }, factory);
  }
  acquire(): T | undefined {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.items.length;
      if (!item.active) {
        item.active = true;
        return item;
      }
    }
  }
  clear() {
    for (const item of this.items) item.active = false;
    this.cursor = 0;
  }
  get count() {
    return this.items.reduce((n, item) => n + Number(item.active), 0);
  }
}
