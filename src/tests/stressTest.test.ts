import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandSource,
  CustomCommandStatus,
  ItemStack,
  Player,
  system,
} from "@minecraft/server";
import { ItemDatabase } from "../models/ItemDatabaseModel";
import { generateUniqueId, randomInList } from "../utils";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";

/**
 * The item database to do tests on
 */
const stressTestDB = new ItemDatabase("stressTest");

system.beforeEvents.startup.subscribe((data) => {
  data.customCommandRegistry.registerCommand(
    {
      name: "item_database:stresstest",
      description: "Pushes the selected item in your hand to the database",
      permissionLevel: CommandPermissionLevel.Admin,
      cheatsRequired: true,
      mandatoryParameters: [
        {
          name: "amount",
          type: CustomCommandParamType.Integer,
        },
      ],
    },
    (origin, args) => {
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

      const amount = parseInt(args);
      if (typeof amount !== "number" || isNaN(amount))
        return {
          status: CustomCommandStatus.Failure,
          message: "Amount must be a number",
        };

      if (amount < 1)
        return {
          status: CustomCommandStatus.Failure,
          message: "Amount must be greater than 0",
        };

      const items = stressTestDB.getAllItems();
      entity.sendMessage(`§aFound §d${items.length} §aitems in database`);

      system.run(async () => {
        const itemIds: string[] = [];
        for (let i = 0; i < amount; i++) {
          const itemStack = new ItemStack(
            randomInList(Object.values(MinecraftItemTypes)),
            1
          );
          const id = Date.now().toString() + "-" + generateUniqueId();
          const status = await stressTestDB.setItem(itemStack, { id });
          if (!status) {
            entity.onScreenDisplay.setActionBar(
              `§cFailed to push item to database`
            );
            entity.playSound("random.bass");
            return;
          }
          itemIds.push(id);
          entity.playSound("random.pop");

          if (i % 100 === 0) await system.waitTicks(1);
        }
      });

      return {
        status: CustomCommandStatus.Success,
        message: "Item registered to be pushed to database!",
      };
    }
  );
});
