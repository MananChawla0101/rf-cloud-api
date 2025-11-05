import { MongoClient } from "mongodb";

const uri = "mongodb+srv://Manan:CSlab@768@clusterrad.421lxwv.mongodb.net/"; // same as in your Flutter code
const client = new MongoClient(uri);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {
    const { frequency, signalStrength, classification, timestamp } = req.body;

    if (!frequency || !signalStrength || !classification) {
      return res.status(400).json({ message: "Missing data fields" });
    }

    await client.connect();
    const db = client.db("radiationDB");
    const collection = db.collection("rf_data");

    await collection.insertOne({
      frequency,
      signalStrength,
      classification,
      timestamp: timestamp || new Date().toISOString(),
    });

    res.status(200).json({ message: "Data inserted successfully" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    await client.close();
  }
}
