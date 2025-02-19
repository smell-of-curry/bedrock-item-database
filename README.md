# Minecraft Bedrock Item Database

A high-performance, real-time, and type-safe database system for storing and managing items in Minecraft Bedrock Edition. This solution makes it easier to track, monitor, and preserve items—whether for an auction house, backpack system, custom enderchests, or any other use case that requires persistent item storage.

## Overview

Storing items in Minecraft Bedrock can be challenging if you rely on traditional methods (like placing items in a chest). This project provides an advanced, in-world database system written in TypeScript. It leverages custom entities, asynchronous initialization, and robust caching to manage items safely and efficiently while offering extreme type safety.

## Features

- **⏱️ Real-Time Storage:**  
  Persist items instantly using custom entities with container components that operate in real time.

- **⚡ High Performance:**  
  Asynchronous operations and smart caching minimize delays and prevent watchdog timeouts.

- **🔒 Extreme Type Safety:**  
  Built with TypeScript and strict type definitions to ensure all item data is fully validated.

- **🔀 Flexible Design:**  
  Easily create multiple database instances for different storage purposes (auction items, backpack items, etc.).

- **🚨 Robust Error Handling:**  
  Custom error classes clearly signal issues—such as when entities or cached items are not yet available.

- **⚙️ Configurable Parameters:**  
  Change core settings like entity type, location, and identifier prefix through a centralized configuration file.

## Customizing the Type System

This database is generic and accepts a type parameter for its item identifier data. The custom type (called `IdentifierData`) must extend the base `ItemDatabaseItemStackData` interface. This approach allows you to add extra properties while maintaining strict type safety.

For example, if you want to store auction items with additional metadata, you can define your custom type as follows:

```ts
import type { ItemDatabaseItemStackData } from "./src/types.ts";

// Define your custom data type.
type AuctionItemData = {
  id: string; // Required unique identifier.
  auctionPriceRaw: string;
  seller: string;
} & ItemDatabaseItemStackData; // Must extend the base type.

// Create an instance of the database with your custom type.
import { ItemDatabase } from "./src/modules/models/ItemDatabaseModel";

const auctionDatabase = new ItemDatabase<AuctionItemData>("auctionItems");

// Now, when storing an item, TypeScript enforces that your data conforms to AuctionItemData:
await auctionDatabase.setItem(heldItem, {
  id: "item123",
  auctionPriceRaw: "100",
  seller: "PlayerOne",
});

// When fetching the item, you get proper typing:
const storedItem = auctionDatabase.getItem("item123");
```

Although this custom type system is optional, it gives you compile-time checking and the ability to work with additional data fields (such as auction price and seller) seamlessly.

## Entity Inventory Tracker Example

Lets say you wanted to create some custom entity tracker system, that allows moderators to check players inventories.
However when a player leaves you no longer have access to the items. 

Well using the example code snippet below, you can add all of the players items before they leave to a item database,
store all the items somewhere in a actual database, then grab those items if they are not in the game.

```ts
import { world } from "@minecraft/server";
import { ItemDatabase } from "./src/modules/models/ItemDatabaseModel";

const playersItems = new ItemDatabase("playersItems");

world.beforeEvents.playerLeave.subscribe(({ player }) => {
  const inventoryComponent = player.getComponent("inventory");
  if (!inventoryComponent || !inventoryComponent.isValid()) return;
  const container = inventoryComponent.container;
  if (!container) return;

  let itemIds: string[] = [];
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;

    const id = `${player.name}:${i}:${Date.now()}`;
    playersItems.setItem(item, {
      id,
    });
    itemIds.push(id);
  }

  // Store itemIds somewhere, and then can be used to retrieve items later
});
```

---

## Public API

The `ItemDatabase` class (defined in `src/modules/models/ItemDatabaseModel.ts`) exposes the following public functions:

### `static getEntityBoundingBox(): string`

Returns a string representing the bounding box in which the database entities reside.  
_Example Output:_ `"-1 -1 -1 1 1 1"`

### `constructor(typeId: string)`

Initializes a new instance of the database with a unique type identifier.

- **Parameters:**
  - `typeId` – A unique string (e.g., `"auctionItems"`) used to link the database to specific entities.
- **Behavior:**  
  Subscribes to an event that waits for entities to load, registers a ticking area, and fetches both the database entities and the cached items.

### `async setItem(itemStack: ItemStack, data: IdentifierData): Promise<boolean>`

Stores an item in the database.

- **Parameters:**
  - `itemStack` – The item to be stored.
  - `data` – Identifier data that must include a unique `id` and any extra fields defined by your custom type.
- **Behavior:**  
  Encodes identifier data into the item’s name tag, searches for an available entity with free slots, or spawns a new entity if necessary. The item is also added to the cache.
- **Returns:**  
  A promise that resolves to `true` if the item was successfully added, or throws an error if the database entities are not yet available.

### `getItem(id: IdentifierData["id"]): ItemStack | undefined`

Retrieves a stored item by its unique identifier.

- **Parameters:**
  - `id` – The unique identifier of the item.
- **Behavior:**  
  Searches through the cached items and returns a cloned copy of the matching item to prevent unintended modifications.
- **Returns:**  
  The item stack if found; otherwise, `undefined`.

### `getAllItems(): ItemStack[]`

Returns all items currently stored in the database.

- **Behavior:**  
  Throws an error if the entities or cached items are not yet loaded.
- **Returns:**  
  An array of valid item stacks from the cache.

### `getAllItemIds(): string[]`

Fetches all stored item identifiers.

- **Behavior:**  
  Maps through the cached items, extracting each item’s identifier, and filters out any invalid entries.
- **Returns:**  
  An array of item IDs.

### `async removeItem(id: IdentifierData["id"]): Promise<boolean>`

Removes an item from the database using its unique identifier.

- **Parameters:**
  - `id` – The unique identifier of the item to remove.
- **Behavior:**  
  Iterates through each database entity, checks each inventory slot, and removes the matching item. Also updates the cached items.
- **Returns:**  
  A promise that resolves to `true` if the item was successfully removed, or `false` if not found.

### `clear(): void`

Clears all stored items from the database.

- **Behavior:**  
  Removes every item from each database entity and resets both the entity list and the item cache. Throws an error if entities are not yet registered.

## Configuration

All fundamental configuration settings for the item database are defined in one place. In particular, refer to the file:

**File Path:** `src/config/item-database.ts`

This file includes key constants such as:

- **ENTITY_TYPEID**

  ```ts
  export const ENTITY_TYPEID = "database:database";
  ```

  Defines the type identifier for the custom entities that hold item data.

- **ENTITY_LOCATION**

  ```ts
  export const ENTITY_LOCATION = { x: 0, y: 0, z: 0 };
  ```

  Specifies the fixed world coordinates where database entities reside.

- **ENTITY_DIMENSION**

  ```ts
  export const ENTITY_DIMENSION = world.getDimension("overworld");
  ```

  Sets the dimension (typically the Overworld) in which the entities are spawned.

- **ITEM_PREFIX**
  ```ts
  export const ITEM_PREFIX = "!!:";
  ```
  A prefix added to item name tags to encode unique identifier data for items stored in the database.

These constants are referenced throughout the system to ensure that all operations (fetching, storing, and retrieving items) occur in the correct context.

## Project Structure

- **src/config/item-database.ts**  
  Contains configuration constants (ENTITY_TYPEID, ENTITY_LOCATION, ENTITY_DIMENSION, ITEM_PREFIX) that define how and where the database operates.

- **src/modules/models/ItemDatabaseModel.ts**  
  Implements the core logic of the item database, including entity fetching, caching, storing, retrieval, and removal of items.

- **src/modules/events/EntitiesLoadEvent.ts**  
  Provides a subscription mechanism to wait for entities to load before operations begin.

- **src/modules/errors/**  
  Contains custom error classes (e.g., `EntitiesNotLoadedError`, `ItemsNotCachedError`) used to signal issues during database operations.
  
## Contributing

Contributions are welcome! If you want to fix bugs, add features, or improve documentation, feel free to open an issue or submit a pull request.
