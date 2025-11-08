// api/saveRF.js
import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI; // We'll set this in step 3

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {
    const { frequency, signalStrength, classification, timestamp } = req.body;

    if (!frequency || !signalStrength || !classification || !timestamp) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Connect to MongoDB Atlas
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("radiationDB");
    const collection = db.collection("rf_data");

    // Insert new reading
    await collection.insertOne({
      frequency,
      signalStrength,
      classification,
      timestamp,
    });

    await client.close();

    return res.status(200).json({ message: "Data saved successfully ✅" });
  } catch (error) {
    console.error("❌ API error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}
