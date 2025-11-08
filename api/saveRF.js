import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Connect to MongoDB Atlas (once)
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

// Define schema & model
const rfSchema = new mongoose.Schema({
  frequency: Number,
  signalStrength: Number,
  classification: String,
  timestamp: Date,
});

const RFReading = mongoose.models.RFReading || mongoose.model("RFReading", rfSchema);

// Main API function (Vercel automatically handles the request)
export default async function handler(req, res) {
  await connectToDB();

  if (req.method === "POST") {
    try {
      const newReading = new RFReading(req.body);
      await newReading.save();
      return res.status(200).json({ success: true, message: "Data saved" });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // For testing from browser
  if (req.method === "GET") {
    return res.status(200).json({ message: "✅ RF Cloud API is running!" });
  }

  // Only POST and GET allowed
  return res.status(405).json({ message: "Only POST and GET allowed" });
}
