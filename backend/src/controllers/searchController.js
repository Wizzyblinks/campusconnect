import Group from "../models/Group.js";
import MarketplaceListing from "../models/MarketplaceListing.js";
import News from "../models/News.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import { accessiblePostFilter } from "../services/postAccess.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchCampusConnect = async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (query.length < 2 || query.length > 80) {
      return res.status(400).json({ message: "Enter between 2 and 80 characters to search." });
    }
    const page = Number(req.query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 1000) {
      return res.status(400).json({ message: "Choose a valid search page." });
    }
    const pattern = new RegExp(escapeRegex(query), "i");
    const skip = (page - 1) * 10;
    const searchPostFilter = accessiblePostFilter(req.user);
    searchPostFilter.author = { $nin: await User.find({ isRestricted: true }).distinct("_id") };
    searchPostFilter.$and = [{ $or: [{ text: pattern }, { hashtags: pattern }] }];

    const [users, posts, news, groups, listings] = await Promise.all([
      User.find({
        _id: { $ne: req.user._id },
        role: "student",
        isRestricted: { $ne: true },
        emailVerified: { $ne: false },
        "privacy.discoverable": { $ne: false },
        "privacy.profileVisibility": { $ne: "private" },
        $or: [
          { "privacy.profileVisibility": "public" },
          {
            institution: req.user.institution,
            campus: req.user.campus,
            "privacy.profileVisibility": { $ne: "private" },
          },
        ],
        name: pattern,
      })
        .select("name institution campus profile.avatar profile.bio profile.department privacy.profileVisibility")
        .populate("institution", "name shortName campuses")
        .sort({ name: 1 })
        .skip(skip)
        .limit(10)
        .lean(),
      Post.find(searchPostFilter)
        .select("text media author institution campus visibility createdAt")
        .populate("author", "name profile.avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(10)
        .lean(),
      News.find({
        isPublished: true,
        institution: req.user.institution,
        campus: req.user.campus,
        $or: [{ title: pattern }, { content: pattern }],
      })
        .select("title content image campus createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(10)
        .lean(),
      Group.find({
        status: "ACTIVE",
        institution: req.user.institution,
        campus: req.user.campus,
        $and: [
          {
            $or: [
              { isPrivate: { $ne: true } },
              { isPrivate: true, "members.user": req.user._id },
            ],
          },
          {
            $or: [{ name: pattern }, { description: pattern }],
          },
        ],
      })
        .select("name description image campus members")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(10)
        .lean(),
      MarketplaceListing.find({
        status: "active",
        stock: { $gt: 0 },
        institution: req.user.institution,
        campus: req.user.campus,
        $or: [{ title: pattern }, { description: pattern }, { category: pattern }],
      })
        .select("title description price images category seller")
        .populate("seller", "name profile.avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(10)
        .lean(),
    ]);

    const campuses = (institution) => institution?.campuses || [];
    return res.json({
      query,
      page,
      results: {
        students: users.map((person) => ({
          id: person._id,
          name: person.name,
          avatar: person.profile?.avatar || "",
          bio: person.profile?.bio || "",
          department: person.profile?.department || "",
          institution: person.institution?.name || "",
          campus: campuses(person.institution).find((item) =>
            String(item._id) === String(person.campus),
          )?.name || "",
        })),
        posts: posts.map((post) => ({
          ...post,
          canEdit: String(post.author?._id) === String(req.user._id),
        })),
        news,
        groups: groups.map((group) => ({ ...group, memberCount: group.members?.length || 0, members: undefined })),
        marketplace: listings,
      },
    });
  } catch (error) {
    console.error("Campus Connect search failed:", error.message);
    return res.status(500).json({ message: "We couldn't complete your search. Please try again." });
  }
};
