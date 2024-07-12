const mongoose = require("mongoose");

// Định nghĩa schema cho nhận xét
const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Nhận xét phải có người dùng"],
    },
    product: {
      type: mongoose.Schema.ObjectId,
      ref: "Product",
      required: [true, "Nhận xét phải có sản phẩm"],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: [true, "Nhận xét phải có đánh giá"],
    },
    comment: {
      type: String,
      required: [true, "Nhận xét phải có nội dung"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Tạo model nhận xét
const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;
