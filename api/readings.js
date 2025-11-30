// api/readings.js
import mongoose from 'mongoose';

// NOTE: On Vercel you do NOT need dotenv here.
// Vercel injects env variables automatically into process.env
// dotenv.config();  // <-- not needed in production / Vercel

// ---------- DB CONNECTION (re-use for serverless) ----------
let isConnected = false;

async function connectToDB() {
  if (isConnected) return;

  const uri = process.env.MONGO_URI; // 👈 make sure this name matches Vercel env

  if (!uri) {
    throw new Error('MONGO_URI environment variable not set');
  }

  try {
    await mongoose.connect(uri, {
      // minimal recommended options
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('✅ Mongoose connected');
  } catch (err) {
    console.error('❌ Mongoose connect error:', err.message);
    throw err;
  }
}

// ---------- SCHEMA & MODEL ----------
const rfSchema = new mongoose.Schema(
  {
    frequency_hz: { type: Number, required: true },
    signal_dbm: { type: Number, required: true },
    classification: { type: String, default: 'UNKNOWN' },
    timestamp: { type: Date, default: Date.now },
  },
  { strict: true }
);

const RFReading =
  mongoose.models.RFReading || mongoose.model('RFReading', rfSchema);

// Convert doc to plain JSON for the client
function normalizeDoc(doc) {
  const ts =
    doc.timestamp instanceof Date ? doc.timestamp.getTime() : Number(doc.timestamp);
  return {
    frequency_hz: doc.frequency_hz,
    signal_dbm: doc.signal_dbm,
    classification: doc.classification,
    timestamp: ts,
  };
}

// ---------- MAIN HANDLER ----------
export default async function handler(req, res) {
  // CORS (you can tighten this later)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1) Ensure DB connection
  try {
    await connectToDB();
  } catch (err) {
    console.error('❌ DB connect failed in handler:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Database connection failed', error: err.message });
  }

  // 2) POST: save one reading
  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      // Accept different field names just in case
      const frequency_hz = Number(
        body.frequency_hz ?? body.frequency ?? body.freq_hz
      );
      const signal_dbm = Number(
        body.signal_dbm ?? body.signalStrength ?? body.signal
      );
      const classification = (body.classification ?? 'UNKNOWN').toString();

      const timestampMs = body.timestamp ? Number(body.timestamp) : Date.now();
      const timestamp = new Date(timestampMs);

      // Basic validation
      if (!Number.isFinite(frequency_hz) || !Number.isFinite(signal_dbm)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid numeric fields (frequency_hz, signal_dbm)',
        });
      }

      const doc = new RFReading({
        frequency_hz,
        signal_dbm,
        classification,
        timestamp,
      });

      await doc.save();

      return res
        .status(201)
        .json({ success: true, message: 'Saved', data: normalizeDoc(doc) });
    } catch (err) {
      console.error('❌ POST save error:', err);
      // expose message to help debug if it still fails
      return res
        .status(500)
        .json({ success: false, message: 'Save failed', error: err.message });
    }
  }

  // 3) GET: fetch readings with optional from/to/limit/sort
  if (req.method === 'GET') {
    try {
      const q = req.query || {};
      const fromMs = q.from ? Number(q.from) : null;
      const toMs = q.to ? Number(q.to) : null;
      const limit = Math.min(5000, Math.max(1, Number(q.limit || 1000)));
      const sortParam = (q.sort ?? 'asc').toString().toLowerCase(); // 'asc' or 'desc'
      const sort = sortParam === 'desc' ? { timestamp: -1 } : { timestamp: 1 };

      const filter = {};
      if (fromMs || toMs) {
        filter.timestamp = {};
        if (fromMs && Number.isFinite(fromMs)) filter.timestamp.$gte = new Date(fromMs);
        if (toMs && Number.isFinite(toMs)) filter.timestamp.$lte = new Date(toMs);
      }

      const docs = await RFReading.find(filter).sort(sort).limit(limit).lean().exec();

      const data = docs.map(normalizeDoc);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('❌ GET fetch error:', err);
      return res
        .status(500)
        .json({ success: false, message: 'Fetch failed', error: err.message });
    }
  }

  // 4) Any other method
  return res
    .status(405)
    .json({ success: false, message: 'Only GET, POST, OPTIONS allowed' });
}
