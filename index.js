import express from "express";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// 🧠 Replace this with your actual MongoDB Atlas connection string
const mongoUri = "mongodb+srv://Manan:CSlab@768@clusterrad.421lxwv.mongodb.net/";
await mongoose.connect(mongoUri);

// Define schema & model
const rfSchema = new mongoose.Schema({
  frequency: Number,
  signalStrength: Number,
  classification: String,
  timestamp: String
});
const RFReading = mongoose.model("RFReading", rfSchema);

// POST endpoint for Flutter
app.post("/rfdata", async (req, res) => {
  try {
    const data = req.body;
    const newReading = new RFReading(data);
    await newReading.save();
    res.status(200).json({ success: true, message: "Data saved" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ RF Cloud API is running");
});

// For local testing:
app.listen(3000, () => console.log("Server running on port 3000"));
