export const initialFollowStatus = (profileVisibility) =>
  profileVisibility === "public" ? "ACCEPTED" : "PENDING";
