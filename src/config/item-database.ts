import { world } from "@minecraft/server";

/**
 * The typeId of the entity with a container component
 * to be used by the item database
 */
export const ENTITY_TYPEID = "database:database";

/**
 * The Location where the database item entities will reside
 */
export const ENTITY_LOCATION = { x: 0, y: 0, z: 0 };

/**
 * Dimension where the entities are spawning
 */
export const ENTITY_DIMENSION = world.getDimension("overworld");

/**
 * The prefix to put on items in the database.
 */
export const ITEM_PREFIX = "!!:";