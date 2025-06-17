import { TicksPerSecond, system, world } from "@minecraft/server";
import { ItemDatabase } from "../models/ItemDatabaseModel";

/**
 * The item database to do tests on
 */
const testItemDB = new ItemDatabase("testItems");

// Push item to database when used
world.afterEvents.itemUse.subscribe(async ({ itemStack, source }) => {
  const usedSlot = source.selectedSlotIndex; // Get slot, to ensure they don't move there cursor.
  const id = Date.now().toString();
  const setStatus = await testItemDB.setItem(itemStack, { id });
  if (!setStatus) {
    source.onScreenDisplay.setActionBar(`§cFailed to push item to database`);
    source.playSound("random.bass");
    return;
  }
  source.onScreenDisplay.setActionBar(
    `§aItem §dpushed§a to database with id: ${id}`
  );
  source.playSound("random.pop");

  // Remove item from inventory
  const inventoryComponent = source.getComponent("inventory");
  if (!inventoryComponent) return;
  const inventoryContainer = inventoryComponent.container;
  if (!inventoryContainer) return;
  inventoryContainer.setItem(usedSlot, undefined);

  // Wait a second
  await system.waitTicks(TicksPerSecond);

  // Add item back to inventory from database
  const item = testItemDB.getItem(id);
  if (!item) {
    source.onScreenDisplay.setActionBar(
      `§cFailed to retrieve item from database with id: ${id}`
    );
    source.playSound("random.bass");
    return;
  }
  source.onScreenDisplay.setActionBar(
    `§aItem §eretrieved§a from database with id: ${id}`
  );
  inventoryContainer.setItem(usedSlot, item);
  source.playSound("random.orb");

  // Wait a second
  await system.waitTicks(TicksPerSecond);

  // Remove item from database
  const removeStatus = await testItemDB.removeItem(id);
  if (!removeStatus) {
    source.onScreenDisplay.setActionBar(
      `§cFailed to remove item from database with id: ${id}`
    );
    source.playSound("random.bass");
    return;
  }

  // Confirm item removal
  const itemRemoved = testItemDB.getItem(id);
  if (itemRemoved) {
    source.onScreenDisplay.setActionBar(
      `§cFailed to confirm item removal from database with id: ${id}`
    );
    source.playSound("random.bass");
    return;
  }
  source.onScreenDisplay.setActionBar(
    `§aItem §cremoved§a from database with id: ${id}`
  );
  source.playSound("random.break");
});
