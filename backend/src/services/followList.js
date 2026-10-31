import { canViewProfile } from "./profileVisibility.js";

export const getAccessibleFollowUsers = ({
  relationships,
  relationshipField,
  viewer,
  followedUserIds = new Set(),
  blockedUserIds = new Set(),
}) =>
  relationships
    .map((relationship) => relationship[relationshipField])
    .filter((person) => {
      if (!person) return false;
      const personId = String(person._id);
      return (
        !blockedUserIds.has(personId) &&
        canViewProfile(viewer, person, followedUserIds.has(personId))
      );
    });

export const paginateFollowUsers = (users, page, limit) => {
  const total = users.length;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.min(page, Math.max(totalPages, 1));
  const start = (currentPage - 1) * limit;

  return {
    users: users.slice(start, start + limit),
    pagination: { page: currentPage, limit, total, totalPages },
  };
};
