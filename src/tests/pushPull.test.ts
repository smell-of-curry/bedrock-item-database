import {
  CommandPermissionLevel,
  CustomCommandSource,
  CustomCommandStatus,
  Player,
  system,
} from "@minecraft/server";
import { ItemDatabase } from "../models/ItemDatabaseModel";

/**
 * The item database to do tests on
 */
const pushPullDB = new ItemDatabase("pushPullTest");

system.beforeEvents.startup.subscribe((data) => {
  data.customCommandRegistry.registerCommand(
    {
      name: "item_database:pushhelditem",
      description: "Pushes the selected item in your hand to the database",
      permissionLevel: CommandPermissionLevel.Admin,
      cheatsRequired: true,
    },
    (origin) => {
      if (origin.sourceType !== CustomCommandSource.Entity)
        return {
          status: CustomCommandStatus.Failure,
          message: "This command can only be used by an entity",
        };

      const entity = origin.sourceEntity;
      if (!(entity instanceof Player))
        return {
          status: CustomCommandStatus.Failure,
          message: "This command can only be used by a player",
        };

      const inventory = entity.getComponent("inventory");
      if (!inventory || !inventory.isValid)
        return {
          status: CustomCommandStatus.Failure,
          message:
            "This command can only be used by a player with a valid inventory",
        };

      const selectedSlot = entity.selectedSlotIndex;
      const itemStack = inventory.container.getItem(selectedSlot);
      if (!itemStack)
        return {
          status: CustomCommandStatus.Failure,
          message: "Failed to get an item from the selected slot",
        };

      const id = Date.now().toString();
      system.run(() => {
        pushPullDB.setItem(itemStack, { id }).then((status) => {
          if (!status) {
            entity.onScreenDisplay.setActionBar(
              `§cFailed to push item to database`
            );
            entity.playSound("random.bass");
            return;
          }
          entity.onScreenDisplay.setActionBar(
            `§aItem §dpushed§a to database with id: ${id}`
          );
          entity.playSound("random.pop");
          inventory.container.setItem(selectedSlot, undefined);
          return;
        });
      });

      return {
        status: CustomCommandStatus.Success,
        message: "Item registered to be pushed to database!",
      };
    }
  );

  data.customCommandRegistry.registerCommand(
    {
      name: "item_database:fetchall",
      description: "Fetches all items from the database",
      permissionLevel: CommandPermissionLevel.Admin,
      cheatsRequired: true,
    },
    (origin) => {
      if (origin.sourceType !== CustomCommandSource.Entity)
        return {
          status: CustomCommandStatus.Failure,
          message: "This command can only be used by an entity",
        };

      const entity = origin.sourceEntity;
      if (!(entity instanceof Player))
        return {
          status: CustomCommandStatus.Failure,
          message: "This command can only be used by a player",
        };

      const inventory = entity.getComponent("inventory");
      if (!inventory || !inventory.isValid)
        return {
          status: CustomCommandStatus.Failure,
          message:
            "This command can only be used by a player with a valid inventory",
        };

      system.run(() => {
        try {
          const items = pushPullDB.getAllItems();
          for (const item of items) {
            inventory.container.addItem(item);
          }
          entity.onScreenDisplay.setActionBar(
            `§aFetched §d${items.length} §aitems from the database!`
          );
          entity.playSound("random.pop");
        } catch (error) {
          entity.onScreenDisplay.setActionBar(
            `§cFailed to fetch items from database`
          );
          entity.playSound("random.bass");
          console.error(error);
        }
      });

      return {
        status: CustomCommandStatus.Success,
        message: "Fetching all items from the database!",
      };
    }
  );

  data.customCommandRegistry.registerCommand(
    {
      name: "item_database:clear",
      description: "Clears the database",
      permissionLevel: CommandPermissionLevel.Admin,
      cheatsRequired: true,
    },
    (origin) => {
      system.run(() => {
        try {
          pushPullDB.clear();
          if (
            origin.sourceType === CustomCommandSource.Entity &&
            origin.sourceEntity instanceof Player
          ) {
            const player = origin.sourceEntity;
            player.onScreenDisplay.setActionBar(`§aDatabase cleared!`);
            player.playSound("random.pop");
          }
          console.log("Item database cleared.");
        } catch (error) {
          if (
            origin.sourceType === CustomCommandSource.Entity &&
            origin.sourceEntity instanceof Player
          ) {
            const player = origin.sourceEntity;
            player.onScreenDisplay.setActionBar(`§cFailed to clear database`);
            player.playSound("random.bass");
          }
          console.error("Failed to clear item database:", error);
        }
      });

      return {
        status: CustomCommandStatus.Success,
        message: "Clearing the database!",
      };
    }
  );
});
