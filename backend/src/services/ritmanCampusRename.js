export const planRitmanCampusRename = (institution) => {
  if (institution?.name !== "Ritman University") {
    throw new Error("Ritman University was not found.");
  }

  const mainCampuses = institution.campuses.filter(
    (campus) => campus.name === "Main Campus",
  );
  const greenCampuses = institution.campuses.filter(
    (campus) => campus.name === "Green Campus",
  );

  if (mainCampuses.length > 1 || greenCampuses.length > 1) {
    throw new Error("The Ritman campus records need manual review.");
  }
  if (mainCampuses.length && greenCampuses.length) {
    throw new Error("Both campus names exist; no campus was changed.");
  }
  if (!mainCampuses.length && greenCampuses.length) {
    return { changed: false, institutionId: institution._id };
  }
  if (!mainCampuses.length) {
    throw new Error("Ritman Main Campus was not found.");
  }

  return {
    changed: true,
    institutionId: institution._id,
    campusId: mainCampuses[0]._id,
  };
};
