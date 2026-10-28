import Post from "../models/Post.js";
import User from "../models/User.js";

export const accessiblePostFilter = (user, postId = undefined) => {
  const visibility = [
    { visibility: "public" },
    {
      visibility: "campus",
      institution: user.institution,
      campus: user.campus,
    },
    { visibility: "private", author: user._id },
  ];
  return {
    isDeleted: { $ne: true },
    ...(postId ? { _id: postId } : {}),
    $or: visibility,
  };
};

export const findAccessiblePost = async (user, postId) => {
  const restrictedAuthors = await User.find({ isRestricted: true }).distinct("_id");
  return Post.findOne({
    ...accessiblePostFilter(user, postId),
    author: { $nin: restrictedAuthors },
  });
};
