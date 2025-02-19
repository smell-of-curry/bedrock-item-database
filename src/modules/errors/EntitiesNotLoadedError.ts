export class EntitiesNotLoadedError extends Error {
  constructor() {
    super("Entities not yet registered, cannot precede with action!");
    this.name = "EntitiesNotLoadedError";
    Object.setPrototypeOf(this, EntitiesNotLoadedError.prototype);
  }
}
