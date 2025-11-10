import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// ✅ MongoDB connection reuse
let isConnected = false;
async function connectToDB() {
  if (isConnected) return;
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
  }
}

// ✅ Define schema & model
const rfSchema = new mongoose.Schema({
  frequency: Number,
  signalStrength: Number,
  classification: String,
  timestamp: Date,
});

const RFReading =
  mongoose.models.RFReading || mongoose.model("RFReading", rfSchema);

// ✅ Main API function
export default async function handler(req, res) {
  // ✅ CORS Headers (for Flutter Web + external access)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  await connectToDB();

  // ✅ Handle POST (save data)
  if (req.method === "POST") {
    try {
      const newReading = new RFReading(req.body);
      await newReading.save();
      return res
        .status(200)
        .json({ success: true, message: "✅ Data saved successfully" });
    } catch (err) {
      console.error("❌ Save error:", err.message);
      return res
        .status(500)
        .json({ success: false, error: "Database save failed" });
    }
  }

  // ✅ Handle GET (status check)
  if (req.method === "GET") {
    return res
      .status(200)
      .json({ message: "✅ RF Cloud API is running!" });
  }

  // ✅ Other methods not allowed
  return res.status(405).json({ message: "Only GET, POST, OPTIONS allowed" });
}
