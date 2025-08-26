/**
 * Returns true if the provided value is a valid name:
 * - must be a string
 * - trimmed length > 0 and <= MAX_NAME_LENGTH
 * - must contain at least one alphanumeric character
 * - may only include letters, numbers, space, -, _, ., @
 */
export function isValidName(value: unknown): boolean {
  const MAX_NAME_LENGTH = 100;
  const SAFE_NAME_REGEX = /^(?=.*[a-zA-Z0-9])[a-zA-Z0-9 _\-\.@]+$/;

  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return false;
  return SAFE_NAME_REGEX.test(trimmed);
}
