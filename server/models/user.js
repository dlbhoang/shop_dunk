const crypto = require("crypto");
const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");

// Định nghĩa schema cho người dùng
const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Vui lòng nhập họ và tên của bạn"],
    },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
    dateOfBirth: {
      type: Date,
    },
    email: {
      type: String,
      required: [true, "Vui lòng nhập email của bạn"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Vui lòng cung cấp một email hợp lệ"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Vui lòng nhập số điện thoại của bạn"],
      unique: true,
      validate: {
        validator: function (value) {
          return validator.isMobilePhone(value, "vi-VN");
        },
        message: "Vui lòng cung cấp một số điện thoại hợp lệ",
      },
    },
    username: {
      type: String,
      required: [true, "Vui lòng nhập tên đăng nhập của bạn"],
    },
    photo: {
      type: String,
      default: "default.jpg",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    password: {
      type: String,
      required: [true, "Vui lòng cung cấp mật khẩu"],
      minLength: [8, "Mật khẩu phải có ít nhất 8 ký tự"],
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, "Vui lòng xác nhận mật khẩu"],
      validate: {
        // Chỉ hoạt động khi CREATE và SAVE
        validator: function (el) {
          return el === this.password;
        },
        message: "Mật khẩu không khớp!",
      },
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware trước khi lưu người dùng
userSchema.pre("save", async function (next) {
  // Nếu mật khẩu không thay đổi, chuyển sang middleware tiếp theo
  if (!this.isModified("password")) return next();

  // Mã hóa mật khẩu với cost là 12
  this.password = await bcrypt.hash(this.password, 12);

  // Xóa trường passwordConfirm
  this.passwordConfirm = undefined;
  next();
});

// Middleware trước khi lưu người dùng
userSchema.pre("save", function (next) {
  // Nếu mật khẩu không thay đổi hoặc đây là một người dùng mới, chuyển sang middleware tiếp theo
  if (!this.isModified("password") || this.isNew) return next();

  // Thiết lập thời gian thay đổi mật khẩu
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Phương thức kiểm tra mật khẩu đúng hay sai
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Phương thức kiểm tra xem mật khẩu đã thay đổi sau khi token JWT được cấp phát hay không
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }

  return false;
};

// Phương thức tạo token reset mật khẩu
userSchema.methods.createPasswordResetToken = function () {
  // Tạo token reset
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Mã hóa token reset và lưu vào database
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  console.log({ resetToken }, this.passwordResetToken);

  // Thiết lập thời gian hết hạn của token reset
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

// Tạo model người dùng
const User = mongoose.model("User", userSchema);
module.exports = User;
