export const canViewProfile = (viewer, target, followsTarget = false) => {
  if (!viewer || !target || target.isRestricted || target.emailVerified === false) {
    return false;
  }
  if (String(viewer._id) === String(target._id)) return true;
  if (target.privacy?.discoverable === false) return false;
  if (target.privacy?.profileVisibility === "public") return true;
  if (
    String(viewer.institution) === String(target.institution) &&
    String(viewer.campus) === String(target.campus) &&
    target.privacy?.profileVisibility !== "private"
  ) {
    return true;
  }
  return target.privacy?.profileVisibility === "private" && followsTarget;
};
