export function parseWhitelistedEmailList(str: string) {
  // Replace single quotes with double quotes to make it valid JSON
  const jsonCompatible = str.replace(/'/g, '"');

  try {
    const emailArray = JSON.parse(jsonCompatible);
    if (Array.isArray(emailArray)) {
      return emailArray;
    }
  } catch (err) {
    console.log("Failed to parse email list:", err);
    return [];
  }
}
