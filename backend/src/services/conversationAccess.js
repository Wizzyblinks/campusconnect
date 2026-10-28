export const isConversationParticipant = (participants, userId) =>
  Array.from(participants || []).some(
    (participant) => participant.toString() === userId.toString(),
  );
