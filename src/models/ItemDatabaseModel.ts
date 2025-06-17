import { Entity, ItemStack, system, world } from "@minecraft/server";
import { ItemDatabaseItemStackData } from "../types";
import {
  ENTITY_DIMENSION,
  ENTITY_INVENTORY_SIZE,
  ENTITY_LOCATION,
  ENTITY_TYPEID,
  ITEM_PREFIX,
} from "../config/item-database";
import { assert } from "../utils";

/**
 * Represents a database for storing items in Minecraft Bedrock Edition.
 * @template IdentifierData - The type of data associated with each item in the database.
 */
export class ItemDatabase<IdentifierData extends ItemDatabaseItemStackData> {
  /**
   * Array of entities that this database is connected to.
   * @key - The ID of the entity.
   * @value - The entity itself.
   */
  private databaseEntities: Map<string, Entity>;

  /**
   * Cached items that have been fetched from the database.
   * @key - The ID of the item.
   * @value - The item itself.
   */
  private cachedItems: Map<string, ItemStack>;

  /**
   * Map of entity ids to the item ids that are stored in them.
   * @key - The ID of the entity.
   * @value - The item ids that are stored in the entity.
   */
  private itemStorageMap: Map<string, string[]>;

  /**
   * The typeId that this database is linked to, and is how it keeps track of entities spawned in.
   *
   * @example "auctionItems"
   * @example "backpackItems"
   */
  public typeId: string;

  /**
   * Returns a string representing a bounding box that the entities must be in,
   * this is used for ticking areas and such that require running commands.
   *
   * @returns @example "-1 -1 -1 1 1 1"
   */
  static getEntityBoundingBox(): string {
    return `${ENTITY_LOCATION.x - 1} ${ENTITY_LOCATION.y - 1} ${
      ENTITY_LOCATION.z - 1
    } ${ENTITY_LOCATION.x + 1} ${ENTITY_LOCATION.y + 1} ${
      ENTITY_LOCATION.z + 1
    }`;
  }

  /**
   * Establishes an ItemDatabase instance into the world.
   * @param typeId - Identifier for ItemDatabase Mapping.
   */
  constructor(typeId: string) {
    this.typeId = typeId;
    this.databaseEntities = new Map();
    this.cachedItems = new Map();
    this.itemStorageMap = new Map();

    // Fetch any entities that were loaded before this database was initialized.
    world.afterEvents.worldLoad.subscribe(() => {
      try {
        const alreadyLoadedEntities = world
          .getDimension(ENTITY_DIMENSION)
          .getEntities({
            type: ENTITY_TYPEID,
          });

        for (const entity of alreadyLoadedEntities) {
          if (!this.isDatabaseEntity(entity)) continue;
          if (this.databaseEntities.has(entity.id)) continue;
          this.databaseEntities.set(entity.id, entity);
          this.registerEntityItems(entity);
        }
      } catch (error) {
        console.warn(
          `[ITEM_DATABASE] Failed to fetch pre-loaded entities: ${error}`
        );
      }
    });

    // Fetch items when entities are loaded.
    world.afterEvents.entityLoad.subscribe(({ entity }) => {
      if (!this.isDatabaseEntity(entity)) return;
      if (this.databaseEntities.has(entity.id)) return;
      this.databaseEntities.set(entity.id, entity);
      console.log(
        `[ITEM_DATABASE] Loaded Entity (${entity.id}) of "${this.typeId}"!`
      );

      // Fetch items from this entity.
      const itemCount = this.registerEntityItems(entity);
      console.log(
        `[ITEM_DATABASE] Fetched ${itemCount}x items from Entity (${entity.id}) of "${this.typeId}"!`
      );
    });

    world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
      // Check if the entity is one of our database entities
      const isDatabaseEntity = this.databaseEntities.get(removedEntityId);
      if (!isDatabaseEntity) return;

      // Something caused this entity to be removed! Not good!
      console.warn(
        `Entity (${removedEntityId}) of "${this.typeId}" was removed!`
      );

      // Remove this entity from the database entities, as we don't want to fetch broken entities.
      this.databaseEntities.delete(removedEntityId);
    });
  }

  /**
   * Checks if an entity is a database entity.
   *
   * @param entity - The entity to check.
   * @returns true if the entity is a entity of this database, false otherwise.
   */
  private isDatabaseEntity(entity: Entity): boolean {
    if (!entity.isValid) return false;
    if (entity.getDynamicProperty("databaseTypeId") != this.typeId)
      return false;

    // Valid Entity used for this database
    return true;
  }

  /**
   * Registers all items inside this entity.
   *
   * @param entity - The entity to register items from.
   * @returns number of items registered.
   */
  private registerEntityItems(entity: Entity): number {
    if (!entity.isValid) return 0;

    const inventory = entity.getComponent("inventory");
    if (!inventory || !inventory.isValid) return 0;
    const inventoryContainer = inventory.container;
    if (!inventoryContainer || !inventoryContainer.isValid) return 0;

    const entitiesItemIds = this.getEntityItemIds(entity);
    assert(
      entitiesItemIds.length == 0,
      `Entity (${entity.id}) of "${this.typeId}" already has items registered!`
    );

    let itemCount = 0;
    for (let i = 0; i < inventory.inventorySize; i++) {
      const itemStack = inventoryContainer.getItem(i);
      if (!itemStack) continue;

      const itemId = this.getItemId(itemStack);
      if (!itemId) {
        console.warn(
          `Item (${itemStack.typeId}) of "${this.typeId}" lost its ID!`
        );
        continue;
      }

      // Register this item to the cached items.
      this.cachedItems.set(itemId, itemStack);
      entitiesItemIds.push(itemId);
      itemCount++;
    }

    // Update the item storage map.
    this.itemStorageMap.set(entity.id, entitiesItemIds);

    return itemCount;
  }

  /**
   * Clears all data stored in this database.
   */
  clear() {
    // Try catch as, we should still wipe catch even if this errors.
    try {
      for (const entity of this.databaseEntities.values()) {
        if (!entity.isValid) continue;
        entity.remove();
      }
    } catch (error) {
      console.warn(`Failed to clear database: ${error}`);
    }

    this.databaseEntities.clear();
    this.cachedItems.clear();
    this.itemStorageMap.clear();
  }

  /**
   * Gets all item ids that are stored in an entity.
   *
   * @param entity - The entity to get the item ids from.
   * @returns The item ids that are stored in the entity.
   */
  getEntityItemIds(entity: { id: string }): string[] {
    if (!this.databaseEntities.has(entity.id)) return [];
    return this.itemStorageMap.get(entity.id) ?? [];
  }

  /**
   * Gets all items inside this database.
   * @returns itemStacks that are valid.
   */
  getAllItems(): ItemStack[] {
    return Array.from(this.cachedItems.values());
  }

  /**
   * Fetches all item ids for all items
   *
   * @returns
   */
  getAllItemIds(): string[] {
    return Array.from(this.cachedItems.keys());
  }

  /**
   * Sets data onto this item inside the database.
   * @param itemStack - ItemStack to apply data to.
   * @param data - Other data to set onto this itemStack.
   *
   * @returns The modified itemStack.
   */
  private setIdentifierData(
    itemStack: ItemStack,
    data: IdentifierData
  ): ItemStack {
    // Keep track of previous name tag, if it exists.
    // This is used to prevent overwriting the name tag.
    let previousNameTag = itemStack.nameTag ?? "";
    if (previousNameTag.includes(ITEM_PREFIX)) previousNameTag = "";

    itemStack.nameTag = `${ITEM_PREFIX}${data.id}${ITEM_PREFIX}${previousNameTag}`;
    return itemStack;
  }

  /**
   * Gets the item identifier in the database
   *
   * @param itemStack - The itemStack to fetch.
   * @returns The identifier of the itemStack, or undefined if not set correctly.
   */
  private getItemId(itemStack: ItemStack): IdentifierData["id"] | undefined {
    const itemName = itemStack.nameTag;
    if (!itemName || !itemName.startsWith(ITEM_PREFIX)) return undefined;

    return itemName.split(ITEM_PREFIX)[1];
  }

  /**
   * Adds an item to this itemStack database.
   *
   * @param itemStack - The itemStack to add to the database.
   * @param data - The data to associate with this item.
   * @returns True if the item was successfully added, false otherwise.
   * @throws if entities are not yet registered.
   */
  async setItem(itemStack: ItemStack, data: IdentifierData): Promise<boolean> {
    // Check if item is already in database, if so remove it.
    if (this.getItem(data.id)) await this.removeItem(data.id);

    // Update the itemStack with the identifier data.
    itemStack = this.setIdentifierData(itemStack, data);

    // Find a entity to put the item on.
    let addedItem = false;
    for (const entityId of this.itemStorageMap.keys()) {
      try {
        // Check if the entity is full.
        const currentItemIds = this.getEntityItemIds({ id: entityId });
        if (currentItemIds.length >= ENTITY_INVENTORY_SIZE) continue;

        // Get the entity and check if it is valid.
        const entity = this.databaseEntities.get(entityId);
        if (!entity || !entity.isValid) continue;

        // Get the inventory and check if it is valid.
        const inventory = entity.getComponent("inventory");
        if (!inventory || !inventory.isValid) continue;
        const inventoryContainer = inventory.container;
        if (!inventoryContainer || !inventoryContainer.isValid) continue;

        // Get the first empty slot.
        const firstEmptySlot = inventoryContainer.firstEmptySlot();
        assert(
          firstEmptySlot !== undefined,
          `Entity (${entityId}) of "${this.typeId}" is somehow full!`
        );

        // Set the item to the first empty slot.
        inventoryContainer.setItem(firstEmptySlot, itemStack);

        // Update the item storage map.
        currentItemIds.push(data.id);
        this.itemStorageMap.set(entityId, currentItemIds);

        // Mark as added.
        addedItem = true;
        break;
      } catch (error) {
        console.error(`Failed to add item to database: ${error}`);
      }
    }

    // All current entities in use are full, must make a new entity to store this item.
    if (!addedItem) {
      try {
        // Spawn entity and wait to ensure it is loaded.
        const entity = world
          .getDimension(ENTITY_DIMENSION)
          .spawnEntity<string>(ENTITY_TYPEID, ENTITY_LOCATION);
        await system.waitTicks(10);

        // Could happen if there is some type of entity clearing.
        assert(
          entity.isValid,
          `Entity (${entity.id}) of "${this.typeId}" went invalid after spawning!`
        );

        // Register this entity as in use for this database.
        entity.setDynamicProperty("databaseTypeId", this.typeId);

        // Check if inventory is valid.
        const inventory = entity.getComponent("inventory");
        if (!inventory || !inventory.isValid)
          throw new Error(
            `Could not add ItemStack, Entity does not have a valid Inventory Component!`
          );

        const inventoryContainer = inventory.container;
        if (!inventoryContainer || !inventoryContainer.isValid)
          throw new Error(
            `Could not add ItemStack, Entity's container is not valid!`
          );

        const firstEmptySlot = inventoryContainer.firstEmptySlot();
        assert(
          firstEmptySlot !== undefined,
          `Entity (${entity.id}) of "${this.typeId}" is somehow full!`
        );
        assert(
          firstEmptySlot == 0,
          `Entity (${entity.id}) of "${this.typeId}" has an empty slot that is not the first slot!`
        );

        inventoryContainer.setItem(firstEmptySlot, itemStack);
        this.databaseEntities.set(entity.id, entity);
        this.itemStorageMap.set(entity.id, [data.id]);
        addedItem = true;
      } catch (error) {
        console.error(`Failed to add item to database: ${error}`);
      }
    }

    // Add item to cached items if it was added.
    if (addedItem) this.cachedItems.set(data.id, itemStack);
    return addedItem;
  }

  /**
   * Gets an item with the specified ID from the database.
   *
   * @param id - The ID of the item to retrieve.
   * @returns The itemStack that corresponds to the specified ID, or undefined if not found.
   */
  getItem(id: IdentifierData["id"]): ItemStack | undefined {
    const item = this.cachedItems.get(id);
    if (!item) return;
    assert(
      item.nameTag,
      `Item (${item.typeId}) of "${this.typeId}" has no name tag!`
    );

    // Clone this item to prevent modifying the original item.
    const newItem = item.clone();

    // Remove the identifier data from the items name tag.
    newItem.nameTag = item.nameTag.split(ITEM_PREFIX)[2] ?? "";

    // Return the new item.
    return newItem;
  }

  /**
   * Removes an item from the database.
   *
   * @param id - The ID of the item to remove.
   * @returns True if the item was successfully removed, false otherwise.
   */
  async removeItem(id: IdentifierData["id"]): Promise<boolean> {
    // Find the entity that contains the item.
    const entityMapWithItem = [...this.itemStorageMap.entries()].find(
      ([_, itemIds]) => itemIds.includes(id)
    );
    if (!entityMapWithItem) return false;
    const [entityId, itemIds] = entityMapWithItem;

    // Remove item from cached items, and update the item storage map.
    const removeItemFromCache = () => {
      this.cachedItems.delete(id);
      const newItemIds = itemIds.filter((itemId) => itemId !== id);
      this.itemStorageMap.set(entityId, newItemIds);
    };

    // Get the entity and check if it is valid.
    const entity = this.databaseEntities.get(entityId);
    if (!entity || !entity.isValid) return removeItemFromCache(), false;

    // Get the inventory and check if it is valid.
    const inventory = entity.getComponent("inventory");
    if (!inventory || !inventory.isValid) return removeItemFromCache(), false;
    const inventoryContainer = inventory.container;
    if (!inventoryContainer || !inventoryContainer.isValid)
      return removeItemFromCache(), false;

    let foundItem = false;
    for (let i = 0; i < inventory.inventorySize; i++) {
      const itemStack = inventoryContainer.getItem(i);
      if (!itemStack) continue;

      try {
        const itemId = this.getItemId(itemStack);
        if (!itemId) continue;
        if (itemId !== id) continue;

        // Clear item at slot.
        inventoryContainer.setItem(i, undefined);
        foundItem = true;
        break;
      } catch (error) {
        console.warn(`Failed to remove item: ${error}`);
        continue;
      }
    }

    // Warn if the item was not found.
    if (!foundItem)
      console.warn(
        `Item (${id}) of "${this.typeId}" was not found of entity (${entityId}), despite it being in the item storage map!`
      );

    // Remove item from cached items, and return success.
    return removeItemFromCache(), true;
  }
}
