export const messageId = (message) =>
  String(message?._id || message?.clientMessageId || "");

export function mergeChronologicalMessages(...collections) {
  const byId = new Map();
  for (const message of collections.flat()) {
    const id = messageId(message);
    if (id) byId.set(id, message);
  }
  return [...byId.values()].sort((first, second) => {
    const firstTime = new Date(first.createdAt || 0).getTime();
    const secondTime = new Date(second.createdAt || 0).getTime();
    return firstTime - secondTime;
  });
}
