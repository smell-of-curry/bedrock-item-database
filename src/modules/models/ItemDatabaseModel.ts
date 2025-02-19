import { Entity, ItemStack, system, world } from "@minecraft/server";
import { EntitiesLoad } from "../events/EntitiesLoadEvent";
import { ItemDatabaseItemStackData } from "../../types";
import {
  ENTITY_DIMENSION,
  ENTITY_LOCATION,
  ENTITY_TYPEID,
  ITEM_PREFIX,
} from "../../config/item-database";
import { EntitiesNotLoadedError } from "../errors/EntitiesNotLoadedError";
import { ItemsNotCachedError } from "../errors/ItemsNotCachedError";

/**
 * Represents a database for storing items in Minecraft Bedrock Edition.
 * @template IdentifierData - The type of data associated with each item in the database.
 */
export class ItemDatabase<IdentifierData extends ItemDatabaseItemStackData> {
  /**
   * Array of entities that this database is connected to.
   * This can be undefined if the entities have not been fetched yet,
   * which would occur when the entities have not yet been loaded in.
   */
  private databaseEntities: Entity[] | undefined;

  /**
   * The typeId that this database is linked to, and is how it keeps track of entities spawned in.
   *
   * @example "auctionItems"
   * @example "backpackItems"
   */
  typeId: string;

  /**
   * Cached items that have been fetched from the database.
   * This will be undefined if the items have not yet been fetched.
   * This is used to prevent fetching the items multiple times.
   */
  private cachedItems: ItemStack[] | undefined;

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

    // Await for entities to be loaded to ensure we can fetch them.
    EntitiesLoad.subscribe(async () => {
      // Register Ticking area so we can for sure load entities.
      await ENTITY_DIMENSION.runCommandAsync(
        `tickingarea add ${ItemDatabase.getEntityBoundingBox()} itemDatabase true`
      );

      // Wait for a few ticks to ensure the entities are loaded.
      // This is important because the ticking area might take a bit to register.
      await system.waitTicks(20);

      // Load a register database
      console.log(`Loading item database "${this.typeId}"...`);

      // Fetch entities
      const entities = this.fetchEntities();
      console.log(`Fetched ${entities.length}x entities for ${this.typeId}!`);

      // Fetch items
      const items = await this.fetchAllItems();
      console.log(`Fetched ${items.length}x item(s) for ${this.typeId}!`);
    });

    world.beforeEvents.entityRemove.subscribe(({ removedEntity }) => {
      // Check if the entity is one of our database entities
      if (!this.databaseEntities) return;
      const isDatabaseEntity = this.databaseEntities.find(
        (entity) => entity.id == removedEntity.id
      );
      if (!isDatabaseEntity) return;

      // Something caused this entity to be removed! Not good!
      console.error(
        `Entity of typeId "${ENTITY_TYPEID}", and ID "${
          removedEntity.id
        }" was removed at location: ${JSON.stringify(
          removedEntity.location
        )}. This can result in a serious loss of data!`
      );

      // Remove this entity from the database entities, as we dont want to fetch broken entities.
      this.databaseEntities = this.databaseEntities.filter(
        (entity) => entity.id != removedEntity.id
      );
    });
  }

  /**
   * Fetches entities from the database.
   */
  private fetchEntities(): Entity[] {
    const entities = ENTITY_DIMENSION.getEntities({
      type: ENTITY_TYPEID,
      location: ENTITY_LOCATION,
      maxDistance: 2, // Ensure even if they have moved a bit.
    });

    const databaseEntities: Entity[] = [];
    for (const entity of entities) {
      if (!entity.isValid()) continue;
      if (entity.getDynamicProperty("databaseTypeId") != this.typeId) continue;

      // Valid Entity used for this database
      databaseEntities.push(entity);
    }

    this.databaseEntities = databaseEntities;
    return databaseEntities;
  }

  /**
   * Gets all items inside this database.
   *
   * @returns itemStacks that are valid.
   * @throws if entities are not yet registered.
   */
  private async fetchAllItems(): Promise<ItemStack[]> {
    if (this.databaseEntities == undefined) throw new EntitiesNotLoadedError();

    // Items have already been fetched, so we dont need to fetch again.
    if (this.cachedItems != undefined) return this.cachedItems;

    const itemStacks: ItemStack[] = [];
    for (const entity of this.databaseEntities) {
      if (!entity.isValid()) continue;
      const inventory = entity.getComponent("inventory");
      if (!inventory || !inventory.isValid()) continue;
      const inventoryContainer = inventory.container;
      if (!inventoryContainer || !inventoryContainer.isValid()) continue;

      for (let i = 0; i < inventory.inventorySize; i++) {
        const itemStack = inventoryContainer.getItem(i);
        if (!itemStack) continue;

        // Append this item to the list of items
        itemStacks.push(itemStack);
      }

      // Await each entity to prevent watchdog
      await system.waitTicks(1);
    }

    // Register cached items
    this.cachedItems = itemStacks;
    return itemStacks;
  }

  /**
   * Clears all data stored in this database.
   * @throws if entities are not yet registered.
   */
  clear() {
    if (this.databaseEntities == undefined) throw new EntitiesNotLoadedError();

    // Try catch as, we should still wipe catch even if this errors.
    try {
      for (const entity of this.databaseEntities) {
        if (!entity.isValid()) continue;
        entity.remove();
      }
    } catch (error) {
      console.warn(`Failed to clear database: ${error}`);
    }

    this.databaseEntities = [];
    this.cachedItems = [];
  }

  /**
   * Gets all items inside this database.
   * @returns itemStacks that are valid.
   * @throws if entities are not yet registered.
   * @throws if items have not been cached.
   */
  getAllItems(): ItemStack[] {
    if (this.databaseEntities == undefined) throw new EntitiesNotLoadedError();
    if (this.cachedItems == undefined) throw new ItemsNotCachedError();
    return this.cachedItems;
  }

  /**
   * Fetches all item ids for all items
   *
   * @returns
   * @throws if entities are not yet registered.
   * @throws if items have not been cached.
   */
  getAllItemIds(): string[] {
    const items = this.getAllItems();

    // Map the items to their IDs
    const itemIds = items.map((item) => {
      try {
        const id = this.getItemId(item);
        if (!id) return "INVALID";

        return id;
      } catch (error) {
        console.warn(`Failed to fetch item ID: ${error}`);
        return "INVALID";
      }
    });

    // Filter out invalid IDs
    return itemIds.filter((id) => id != "INVALID");
  }

  /**
   * Sets data onto this item inside the database.
   * @param itemStack - ItemStack to apply data to.
   * @param data - Other data to set onto this itemStack.
   *
   * @caution will replace ":" with ""!
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
    if (this.databaseEntities == undefined) throw new EntitiesNotLoadedError();

    // Check if item is already in database, if so remove it.
    if (this.getItem(data.id)) await this.removeItem(data.id);

    // Update the itemStack with the identifier data.
    itemStack = this.setIdentifierData(itemStack, data);

    // Find a entity to put the item on.
    let addedItem = false;
    for (const entity of this.databaseEntities) {
      if (!entity.isValid()) continue;
      const inventory = entity.getComponent("inventory");
      if (!inventory || !inventory.isValid()) continue;
      const inventoryContainer = inventory.container;
      if (!inventoryContainer || !inventoryContainer.isValid()) continue;
      if (inventoryContainer.emptySlotsCount == 0) continue;

      inventoryContainer.addItem(itemStack);
      addedItem = true;
      break;
    }

    if (!addedItem) {
      // All current entities in use are full,
      // we must make a new entity to store this new item.

      // Spawn entity and wait ticks to ensure it is loaded.
      const entity = ENTITY_DIMENSION.spawnEntity(
        ENTITY_TYPEID,
        ENTITY_LOCATION
      );
      await system.waitTicks(10);

      // Shouldn't happen, but could if there is some type of entity clearing.
      if (!entity.isValid())
        throw new Error(`Failed to spawn entity of typeId "${ENTITY_TYPEID}"!`);

      // Register this entity as in use for this database.
      entity.setDynamicProperty("databaseTypeId", this.typeId);

      // Check if inventory is valid.
      const inventory = entity.getComponent("inventory");
      if (!inventory || !inventory.isValid())
        throw new Error(
          `Could not add ItemStack, Entity does not have a valid Inventory Component!`
        );

      const inventoryContainer = inventory.container;
      if (!inventoryContainer || !inventoryContainer.isValid())
        throw new Error(
          `Could not add ItemStack, Entity's container is not valid!`
        );

      inventoryContainer.addItem(itemStack);
      this.databaseEntities.push(entity);
      addedItem = true;
    }

    // Add item to cached items.
    if (!this.cachedItems) this.cachedItems = [];
    this.cachedItems.push(itemStack);

    return addedItem;
  }

  /**
   * Gets an item with the specified ID from the database.
   *
   * @param id - The ID of the item to retrieve.
   * @returns The itemStack that corresponds to the specified ID, or undefined if not found.
   * @throws if entities are not yet registered.
   */
  getItem(id: IdentifierData["id"]): ItemStack | undefined {
    if (this.databaseEntities == undefined) throw new EntitiesNotLoadedError();

    const allItems = this.getAllItems();
    for (const item of allItems) {
      try {
        const itemId = this.getItemId(item);
        if (!itemId) continue;
        if (itemId != id) continue;
        if (!item.nameTag) continue; // Should not be possible because thats how ID's are stored

        // Clone this item to prevent modifying the original item.
        const newItem = item.clone();
        const previousName = item.nameTag.split(ITEM_PREFIX)[2] ?? "";
        newItem.nameTag = previousName;
        return newItem;
      } catch (error) {
        console.error(
          `Failed to parse item of type ${item.typeId} when looking for "${id}", ${error}`
        );
      }
    }

    // Item not found
    return undefined;
  }

  /**
   * Removes an item from the database.
   *
   * @param id - The ID of the item to remove.
   * @returns True if the item was successfully removed, false otherwise.
   */
  async removeItem(id: IdentifierData["id"]): Promise<boolean> {
    if (this.databaseEntities == undefined) return false;

    for (const entity of this.databaseEntities) {
      if (!entity.isValid()) continue;
      const inventory = entity.getComponent("inventory");
      if (!inventory || !inventory.isValid()) continue;
      const inventoryContainer = inventory.container;
      if (!inventoryContainer || !inventoryContainer.isValid()) continue;

      for (let i = 0; i < inventory.inventorySize; i++) {
        const itemStack = inventoryContainer.getItem(i);
        if (!itemStack) continue;

        try {
          const itemId = this.getItemId(itemStack);
          if (!itemId) continue;
          if (itemId != id) continue;

          // Set item at slot to undefined
          inventoryContainer.setItem(i);
          if (this.cachedItems == undefined) return true;

          // Clear item from cached slot
          this.cachedItems = this.cachedItems.filter((cachedItem) => {
            const cachedItemId = this.getItemId(cachedItem);
            if (!cachedItemId) return true; // Remove invalid items

            return cachedItemId !== id;
          });
        } catch (error) {
          console.warn(`Failed to remove item: ${error}`);
          continue;
        }
      }

      // Await on each entity to prevent watchdog
      await system.waitTicks(1);
    }

    // Failed to remove item
    return false;
  }
}
