export class ItemsNotCachedError extends Error {
  constructor() {
    super("Items have not been cached, cannot precede with action!");
    this.name = "ItemsNotCachedError";
    Object.setPrototypeOf(this, ItemsNotCachedError.prototype);
  }
}
