import News from "../models/News.js";

export const createNews = async (req, res) => {
  try {
    const { title, content, image, institution, campus } = req.body;

    if (!title || !content || !institution || !campus) {
      return res.status(400).json({
        message: "Title, content, institution and campus are required",
      });
    }

    const news = await News.create({
      title,
      content,
      image,
      institution,
      campus,
      author: req.user._id,
    });

    res.status(201).json({
      message: "News created successfully",
      news,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create news",
      error: error.message,
    });
  }
};

export const getCampusNews = async (req, res) => {
  try {
    const news = await News.find({
      institution: req.user.institution,
      campus: req.user.campus,
      isPublished: true,
    })
      .populate("author", "name")
      .sort({ createdAt: -1 });

    res.json({
      news,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch campus news",
      error: error.message,
    });
  }
};
