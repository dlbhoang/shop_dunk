require('dotenv').config();  // Load environment variables from .env file
const mongoose = require("mongoose");

const DB = process.env.DATABASE_NAME;

async function connect() {
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("DB connected successfully");
  } catch (error) {
    console.error("DB connection failure", error);
  }
}

module.exports = { connect };
