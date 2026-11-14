import { randomBytes } from "crypto";

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])$/;

export const normalizeUsername = (value) => String(value || "").trim().toLowerCase();

export const isValidUsername = (value) =>
  typeof value === "string" &&
  value.length >= 3 &&
  value.length <= 24 &&
  USERNAME_PATTERN.test(value);

export const createUniqueUsername = async (UserModel, name) => {
  const base =
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 17) || "student";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${base}${randomBytes(3).toString("hex")}`;
    if (!(await UserModel.exists({ username: candidate }))) return candidate;
  }

  throw new Error("Could not allocate a unique username.");
};
