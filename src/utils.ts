/**
 * Asserts a condition is true.
 *
 * @param condition - The condition to assert.
 * @param message - The message to throw if the condition is false.
 */
export function assert(condition: any, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Returns a random item from a list.
 *
 * @param list - The list to get a random item from.
 * @returns A random item from the list.
 */
export function randomInList<T extends any>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] as T;
}

let counter = 0;

/**
 * Generates a more reliable unique identifier without external dependencies.
 * @returns a unique id
 */
export function generateUniqueId(): string {
  const now = Date.now();
  const performanceTime =
    typeof performance !== 'undefined' ? performance.now() : 0;
  const randomString = Array(12)
    .fill(null)
    .map(() => Math.random().toString(36).charAt(2))
    .join('');
  const uniqueCounter = (++counter % 1000000).toString(36);

  return `${now.toString(36)}-${performanceTime.toString(
    36
  )}-${randomString}-${uniqueCounter}-${Date.now()}`;
}