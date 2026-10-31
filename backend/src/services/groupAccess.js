const sameId = (first, second) => String(first?._id || first) === String(second?._id || second);

export const isGroupMember = (group, userId) =>
  Boolean(group?.members?.some((member) => sameId(member.user, userId)));

export const canAccessGroup = (group, user) =>
  Boolean(
    group &&
    user &&
    sameId(group.institution, user.institution) &&
    sameId(group.campus, user.campus) &&
    group.status === "ACTIVE" &&
    (!group.isPrivate || isGroupMember(group, user._id)),
  );

export const groupVisibilityFilter = (user) => ({
  institution: user.institution,
  campus: user.campus,
  status: "ACTIVE",
  $or: [{ isPrivate: { $ne: true } }, { "members.user": user._id }],
});
