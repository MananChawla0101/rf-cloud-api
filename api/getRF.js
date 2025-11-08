import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Only GET allowed" });
  }

  try {
    await client.connect();
    const db = client.db("test"); // or your database name
    const collection = db.collection("rf_readings");

    // Fetch the 20 latest readings
    const data = await collection.find().sort({ timestamp: -1 }).limit(20).toArray();

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Error fetching data:", error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    await client.close();
  }
}
