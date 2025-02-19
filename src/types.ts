/**
 * A data structure representing an item in a database.
 * This structure is used to store information about items
 * in a database, including their ID, name, and other properties.
 * The structure is designed to be flexible and extensible,
 */
export type ItemDatabaseItemStackData = {
  [key: string]: string;
  id: string;
};
