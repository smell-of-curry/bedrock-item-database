import { TicksPerSecond, system, world } from "@minecraft/server";
import { ItemDatabase } from "../modules/models/ItemDatabaseModel";

/**
 * The item database to do tests on
 */
const testItemDB = new ItemDatabase("testItems");

// Push item to database when used
world.afterEvents.itemUse.subscribe(async ({ itemStack, source }) => {
  const id = Date.now().toString();
  const setStatus = await testItemDB.setItem(itemStack, { id });
  if (!setStatus) {
    source.sendMessage(`§cFailed to push item to database`);
    source.playSound("random.bass");
    return;
  }
  source.sendMessage(`§aItem pushed to database with id: ${id}`);
  source.playSound("random.pop");

  // Remove item from inventory
  const inventoryComponent = source.getComponent("inventory");
  if (!inventoryComponent) return;
  const inventoryContainer = inventoryComponent.container;
  if (!inventoryContainer) return;
  inventoryContainer.setItem(source.selectedSlotIndex, undefined);

  // Wait a second
  await system.waitTicks(TicksPerSecond);

  // Add item back to inventory from database
  const item = testItemDB.getItem(id);
  if (!item) {
    source.sendMessage(
      `§cFailed to retrieve item from database with id: ${id}`
    );
    source.playSound("random.bass");
    return;
  }
  source.sendMessage(`§aItem retrieved from database with id: ${id}`);
  inventoryContainer.setItem(source.selectedSlotIndex, item);
  source.playSound("random.ping");

  // Wait a second
  await system.waitTicks(TicksPerSecond);

  // Remove item from database
  const removeStatus = await testItemDB.removeItem(id);
  if (!removeStatus) {
    source.sendMessage(`§cFailed to remove item from database with id: ${id}`);
    source.playSound("random.bass");
    return;
  }

  // Confirm item removal
  const itemRemoved = testItemDB.getItem(id);
  if (itemRemoved) {
    source.sendMessage(
      `§cFailed to confirm item removal from database with id: ${id}`
    );
    source.playSound("random.bass");
    return;
  }
  source.sendMessage(`§aItem removed from database with id: ${id}`);
  source.playSound("random.pop");
});
