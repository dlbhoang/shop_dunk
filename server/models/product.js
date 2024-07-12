const mongoose = require("mongoose");
const slugify = require("slugify");

// Định nghĩa schema cho sản phẩm
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Một sản phẩm phải có tên"],
      unique: true,
    },
    slug: String, // Chuỗi slug được tạo từ tên sản phẩm
    rating: {
      type: Number,
      default: 0, // Đánh giá mặc định là 0
    },
    imageCover: {
      type: String,
      required: [true, "Một sản phẩm phải có ảnh bìa"],
    },
    images: [String], // Danh sách các ảnh của sản phẩm
    description: {
      type: String,
      required: true, // Mô tả sản phẩm là bắt buộc
    },
    discount: {
      type: Number,
      default: 0, // Mặc định không có giảm giá
    },
    storageCapacity: {
      type: String,
      required: true, // Dung lượng lưu trữ là bắt buộc
    },
    category: {
      type: String,
      required: true, // Loại sản phẩm là bắt buộc
    },
    colors: [
      {
        name: {
          type: String,
          required: true, // Tên màu là bắt buộc
        },
        price: {
          type: Number,
          required: true, // Giá của màu là bắt buộc
        },
        quantity: {
          type: Number,
          default: 10, // Số lượng mặc định là 10
        },
      },
    ],
    comments: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Comment",
      },
    ], // Danh sách các nhận xét cho sản phẩm
  },
  {
    timestamps: true, // Tự động thêm các trường createdAt và updatedAt
  }
);

// Middleware trước khi lưu sản phẩm
productSchema.pre("save", function (next) {
  // Tạo slug từ tên sản phẩm
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Tạo model sản phẩm
const Product = mongoose.model("Product", productSchema);
module.exports = Product;
