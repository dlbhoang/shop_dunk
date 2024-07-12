const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");

const User = require("../models/user");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const sendEmail = require("../utils/email");

// Hàm tạo JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRATION,
  });
};

// Hàm tạo và gửi token kèm theo phản hồi
const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  // Xóa mật khẩu khỏi kết quả trả về
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

// Đăng ký người dùng mới
exports.signup = catchAsync(async (req, res, next) => {
  const {
    fullName,
    gender,
    dateOfBirth,
    email,
    phoneNumber,
    username,
    password,
    passwordConfirm,
  } = req.body;

  const newUser = await User.create({
    fullName,
    gender,
    dateOfBirth,
    email,
    phoneNumber,
    username,
    password,
    passwordConfirm,
  });

  createSendToken(newUser, 201, req, res);
});

// Đăng nhập người dùng
exports.login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;

  // Kiểm tra nếu không có tên đăng nhập hoặc mật khẩu
  if (!username || !password) {
    return next(new AppError("Please provide username and password!", 400));
  }

  // Tìm người dùng với tên đăng nhập hoặc email
  const user = await User.findOne({
    $or: [{ username: username }, { email: username }],
  }).select("+password");

  // Kiểm tra mật khẩu
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  createSendToken(user, 200, req, res);
});

// Đăng xuất người dùng
exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};

// Bảo vệ các route cần xác thực
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Lấy token và kiểm tra sự tồn tại của nó
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }

  // 2) Xác minh token
  const decoded = await promisify(jwt.verify)(
    token,
    process.env.JWT_SECRET_KEY
  );

  // 3) Kiểm tra người dùng có tồn tại
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401
      )
    );
  }

  // 4) Kiểm tra người dùng có thay đổi mật khẩu sau khi token được phát hành
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again.", 401)
    );
  }

  // CẤP QUYỀN TRUY CẬP ROUTE ĐƯỢC BẢO VỆ
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Giới hạn quyền truy cập theo vai trò
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    next();
  };
};

// Quên mật khẩu
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Lấy người dùng dựa trên email đã gửi
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError("There is no user with email address", 404));
  }

  // 2) Tạo token đặt lại mật khẩu ngẫu nhiên
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;
  try {
    sendEmail({
      email: user.email,
      subject: "Your password reset token (valid for 10 min)",
      message,
      resetToken,
    });

    res.status(200).json({
      success: "success",
      data: {
        resetToken,
      },
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError("There was an error sending the email. Try again later!"),
      500
    );
  }
});

// Đặt lại mật khẩu
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Lấy người dùng dựa trên token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) Nếu token chưa hết hạn và có người dùng, đặt mật khẩu mới
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Cập nhật thuộc tính changedPasswordAt cho người dùng
  // 4) Đăng nhập người dùng, gửi JWT
  createSendToken(user, 200, req, res);
});

// Cập nhật mật khẩu
exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Lấy người dùng từ collection
  const user = await User.findById(req.user.id).select("+password");

  // 2) Kiểm tra nếu mật khẩu hiện tại là đúng
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }

  // 3) Nếu đúng, cập nhật mật khẩu
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // 4) Đăng nhập người dùng, gửi JWT
  createSendToken(user, 200, req, res);
});
