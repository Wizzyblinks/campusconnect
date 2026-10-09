import Group from "../models/Group.js";
import User from "../models/User.js";
import GroupMessage from "../models/GroupMessage.js";

export const createGroup = async (req, res) => {
  try {
    const { name, description, image, isPrivate } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Group name is required",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.institution || !user.campus) {
      return res.status(400).json({
        message: "Your account is not linked to an institution and campus",
      });
    }

    const group = await Group.create({
      name,
      description: description || "",
      image: image || "",
      institution: user.institution,
      campus: user.campus,
      creator: user._id,
      isPrivate: isPrivate || false,
      members: [
        {
          user: user._id,
          role: "OWNER",
        },
      ],
    });

    res.status(201).json({
      message: "Group created successfully",
      group,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create group",
      error: error.message,
    });
  }
};

export const getGroups = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.institution || !user.campus) {
      return res.status(400).json({
        message: "Your account is not linked to an institution and campus",
      });
    }

    const groups = await Group.find({
      institution: user.institution,
      campus: user.campus,
      status: "ACTIVE",
    })
      .populate("creator", "name email profile.avatar")
      .populate("members.user", "name email profile.avatar")
      .sort({ createdAt: -1 });

    res.json({
      count: groups.length,
      groups,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch groups",
      error: error.message,
    });
  }
};

export const getGroupById = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.institution || !user.campus) {
      return res.status(400).json({
        message: "Your account is not linked to an institution and campus",
      });
    }

    const group = await Group.findById(req.params.id)
      .populate("creator", "name email profile.avatar")
      .populate("members.user", "name email profile.avatar");

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    if (
      group.institution.toString() !== user.institution.toString() ||
      group.campus.toString() !== user.campus.toString()
    ) {
      return res.status(403).json({
        message: "You cannot access this group",
      });
    }

    res.json({
      group,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch group",
      error: error.message,
    });
  }
};

export const joinGroup = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    if (
      group.institution.toString() !== user.institution.toString() ||
      group.campus.toString() !== user.campus.toString()
    ) {
      return res.status(403).json({
        message: "You cannot join a group from another campus",
      });
    }

    if (group.status !== "ACTIVE") {
      return res.status(403).json({
        message: "This group is currently suspended",
      });
    }

    const alreadyMember = group.members.some(
      (member) => member.user.toString() === user._id.toString(),
    );

    if (alreadyMember) {
      return res.status(400).json({
        message: "You are already a member of this group",
      });
    }

    group.members.push({
      user: user._id,
      role: "MEMBER",
    });

    await group.save();

    res.json({
      message: "Joined group successfully",
      groupId: group._id,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to join group",
      error: error.message,
    });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const member = group.members.find(
      (member) => member.user.toString() === req.user._id.toString(),
    );

    if (!member) {
      return res.status(400).json({
        message: "You are not a member of this group",
      });
    }

    if (member.role === "OWNER") {
      return res.status(400).json({
        message: "Owner cannot leave the group. Transfer ownership first.",
      });
    }

    group.members = group.members.filter(
      (member) => member.user.toString() !== req.user._id.toString(),
    );

    await group.save();

    res.json({
      message: "Left group successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to leave group",
      error: error.message,
    });
  }
};

export const appointAdmin = async (req, res) => {
  try {
    const { userId } = req.body;

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const owner = group.members.find(
      (member) => member.user.toString() === req.user._id.toString(),
    );

    if (!owner || owner.role !== "OWNER") {
      return res.status(403).json({
        message: "Only the owner can appoint admins",
      });
    }

    const member = group.members.find(
      (member) => member.user.toString() === userId,
    );

    if (!member) {
      return res.status(404).json({
        message: "User is not a member of this group",
      });
    }

    if (member.role === "OWNER") {
      return res.status(400).json({
        message: "Owner is already the highest role",
      });
    }

    member.role = "ADMIN";

    await group.save();

    res.json({
      message: "Admin appointed successfully",
      group,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to appoint admin",
      error: error.message,
    });
  }
};

export const removeAdmin = async (req, res) => {
  try {
    const { userId } = req.body;

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const owner = group.members.find(
      (member) => member.user.toString() === req.user._id.toString(),
    );

    if (!owner || owner.role !== "OWNER") {
      return res.status(403).json({
        message: "Only the owner can remove admins",
      });
    }

    const member = group.members.find(
      (member) => member.user.toString() === userId,
    );

    if (!member) {
      return res.status(404).json({
        message: "User is not a member of this group",
      });
    }

    if (member.role !== "ADMIN") {
      return res.status(400).json({
        message: "This user is not an admin",
      });
    }

    member.role = "MEMBER";

    await group.save();

    res.json({
      message: "Admin role removed successfully",
      group,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to remove admin",
      error: error.message,
    });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { userId } = req.body;

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const requester = group.members.find(
      (member) => member.user.toString() === req.user._id.toString(),
    );

    if (!requester || !["OWNER", "ADMIN"].includes(requester.role)) {
      return res.status(403).json({
        message: "Only owners and admins can remove members",
      });
    }

    const target = group.members.find(
      (member) => member.user.toString() === userId,
    );

    if (!target) {
      return res.status(404).json({
        message: "User is not a member of this group",
      });
    }

    if (target.role === "OWNER") {
      return res.status(400).json({
        message: "The owner cannot be removed",
      });
    }

    if (target.role === "ADMIN" && requester.role !== "OWNER") {
      return res.status(403).json({
        message: "Only the owner can remove an admin",
      });
    }

    group.members = group.members.filter(
      (member) => member.user.toString() !== userId,
    );

    await group.save();

    res.json({
      message: "Member removed successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to remove member",
      error: error.message,
    });
  }
};

export const transferOwnership = async (req, res) => {
  try {
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return res.status(400).json({
        message: "New owner ID is required",
      });
    }

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const currentOwner = group.members.find(
      (member) => member.user.toString() === req.user._id.toString(),
    );

    if (!currentOwner || currentOwner.role !== "OWNER") {
      return res.status(403).json({
        message: "Only the current owner can transfer ownership",
      });
    }

    const newOwner = group.members.find(
      (member) => member.user.toString() === newOwnerId,
    );

    if (!newOwner) {
      return res.status(404).json({
        message: "New owner must already be a group member",
      });
    }

    if (newOwner.user.toString() === req.user._id.toString()) {
      return res.status(400).json({
        message: "You are already the owner",
      });
    }

    currentOwner.role = "MEMBER";
    newOwner.role = "OWNER";

    group.creator = newOwner.user;

    await group.save();

    res.json({
      message: "Group ownership transferred successfully",
      group,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to transfer ownership",
      error: error.message,
    });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    if (
      group.institution.toString() !== user.institution.toString() ||
      group.campus.toString() !== user.campus.toString()
    ) {
      return res.status(403).json({
        message: "You cannot access this group",
      });
    }

    const isMember = group.members.some(
      (member) => member.user.toString() === user._id.toString(),
    );

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this group",
      });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);

    const skip = (page - 1) * limit;

    const messages = await GroupMessage.find({
      group: group._id,
    })
      .populate("sender", "name email profile.avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await GroupMessage.countDocuments({
      group: group._id,
    });

    res.json({
      groupId: group._id,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      messages,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch group messages",
      error: error.message,
    });
  }
};

export const deleteGroupMessage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const message = await GroupMessage.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    const group = await Group.findById(message.group);

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    if (
      group.institution.toString() !== user.institution.toString() ||
      group.campus.toString() !== user.campus.toString()
    ) {
      return res.status(403).json({
        message: "You cannot access this group",
      });
    }

    const member = group.members.find(
      (member) => member.user.toString() === user._id.toString(),
    );

    if (!member) {
      return res.status(403).json({
        message: "You are not a member of this group",
      });
    }

    const isOwnerOrAdmin = member.role === "OWNER" || member.role === "ADMIN";

    const isMessageOwner = message.sender.toString() === user._id.toString();

    if (!isMessageOwner && !isOwnerOrAdmin) {
      return res.status(403).json({
        message: "You can only delete your own messages",
      });
    }

    await GroupMessage.findByIdAndDelete(message._id);

    const io = req.app.get("io");

    io.to(`group:${group._id}`).emit("group:message-deleted", {
      messageId: message._id,
      groupId: group._id,
    });

    res.json({
      message: "Group message deleted successfully",
      messageId: message._id,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete group message",
      error: error.message,
    });
  }
};

export const sendGroupImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    if (
      group.institution.toString() !== user.institution.toString() ||
      group.campus.toString() !== user.campus.toString()
    ) {
      return res.status(403).json({
        message: "You cannot access this group",
      });
    }

    const isMember = group.members.some(
      (member) => member.user.toString() === user._id.toString(),
    );

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this group",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please upload an image",
      });
    }

    const imageUrl = `/uploads/groups/${req.file.filename}`;

    const newMessage = await GroupMessage.create({
      group: group._id,
      sender: user._id,
      message: imageUrl,
      messageType: "IMAGE",
    });

    const populatedMessage = await GroupMessage.findById(
      newMessage._id,
    ).populate("sender", "name email profile.avatar");

    const io = req.app.get("io");

    io.to(`group:${group._id}`).emit("group:message", {
      message: populatedMessage,
    });

    res.status(201).json({
      message: "Image sent successfully",
      groupMessage: populatedMessage,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to send image",
      error: error.message,
    });
  }
};
