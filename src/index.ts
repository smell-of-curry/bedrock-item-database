import { system, world } from "@minecraft/server";
import "./tests/import";
import { ENTITY_DIMENSION } from "./config/item-database";
import { ItemDatabase } from "./models/ItemDatabaseModel";

system.beforeEvents.startup.subscribe(async () => {
  await system.waitTicks(1); // Exit Read-Only Mode

  world
    .getDimension(ENTITY_DIMENSION)
    .runCommand(
      `tickingarea add ${ItemDatabase.getEntityBoundingBox()} itemDatabase true`
    );
});
