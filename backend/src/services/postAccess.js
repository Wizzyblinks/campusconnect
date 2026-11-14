import Post from "../models/Post.js";
import FollowRequest from "../models/FollowRequest.js";
import HiddenPost from "../models/HiddenPost.js";
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

export const hiddenPrivateProfileAuthors = async (user) => {
  const followedAuthors = await FollowRequest.distinct("following", {
    follower: user._id,
    status: "ACCEPTED",
  });
  return User.distinct("_id", {
    "privacy.profileVisibility": "private",
    _id: { $ne: user._id, $nin: followedAuthors },
  });
};

export const findAccessiblePost = async (user, postId) => {
  if (await HiddenPost.exists({ user: user._id, post: postId })) {
    return null;
  }
  const [restrictedAuthors, hiddenAuthors] = await Promise.all([
    User.find({ isRestricted: true }).distinct("_id"),
    hiddenPrivateProfileAuthors(user),
  ]);
  return Post.findOne({
    ...accessiblePostFilter(user, postId),
    author: { $nin: [...restrictedAuthors, ...hiddenAuthors] },
  });
};
