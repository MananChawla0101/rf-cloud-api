export default async function handler(req, res) {
  // ✅ Allow all origins (CORS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ Only allow POST for data
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {
    const { frequency, signalStrength, classification, timestamp } = req.body;

    console.log("📡 Incoming RF data:", {
      frequency,
      signalStrength,
      classification,
      timestamp,
    });

    // (Optional: store in database here)
    return res.status(200).json({ message: "Data received successfully" });
  } catch (err) {
    console.error("❌ Server error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
