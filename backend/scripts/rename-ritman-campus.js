import "dotenv/config";
import mongoose from "mongoose";
import Institution from "../src/models/Institution.js";
import { planRitmanCampusRename } from "../src/services/ritmanCampusRename.js";

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("Database configuration is missing.");
  }
  await mongoose.connect(process.env.MONGO_URI);

  const institution = await Institution.findOne({ name: "Ritman University" });
  const plan = planRitmanCampusRename(institution);
  if (!plan.changed) {
    console.log("Ritman University campus is already named Green Campus.");
    return;
  }

  const result = await Institution.updateOne(
    {
      _id: plan.institutionId,
      campuses: {
        $elemMatch: { _id: plan.campusId, name: "Main Campus" },
      },
    },
    { $set: { "campuses.$.name": "Green Campus" } },
  );
  if (result.modifiedCount !== 1) {
    throw new Error("The campus record was not updated.");
  }
  const updated = await Institution.exists({
    _id: plan.institutionId,
    campuses: {
      $elemMatch: { _id: plan.campusId, name: "Green Campus" },
    },
  });
  if (!updated) {
    throw new Error("The updated campus record could not be verified.");
  }
  console.log("Renamed Ritman University's Main Campus to Green Campus.");
};

try {
  await run();
} catch {
  console.error("Ritman campus update failed. No database details were logged.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
