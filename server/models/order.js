const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: "string",
    },
    orderNumber: {
      type: String,
      unique: true,
    },
    orderDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Pending", "InTransit", "Delivered"],
      default: "Pending",
    },
    customer: {
      fullName: String,
      phoneNumber: String,
      email: String,
    },
    shippingAddress: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["Stripe", "VNPay", "CreditCard"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Unpaid", "Paid"],
      default: "Pending",
    },
    products: [
      {
        productItem: {
          type: mongoose.Schema.ObjectId,
          ref: "Product",
          required: true,
        },
        color: String,
        quantity: {
          type: Number,
          required: true,
        },
        unitPrice: {
          type: Number,
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const Order = this.constructor;
    // Tìm số hóa đơn cao nhất trong cơ sở dữ liệu
    const highestOrder = await Order.findOne({}, { orderNumber: 1 }).sort({
      orderNumber: -1,
    });

    this.orderNumber = highestOrder
      ? parseInt(highestOrder.orderNumber, 10) + 1
      : 1;
  }

  next();
});

orderSchema.pre("save", function (next) {
  if (!this.orderDate) {
    this.orderDate = new Date();
  }

  next();
});

// orderSchema.pre("save", function (next) {
//   const totalAmount = this.products.reduce((acc, product) => {
//     return acc + product.quantity * product.unitPrice;
//   }, 0);

//   this.totalAmount = totalAmount;

//   next();
// });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;