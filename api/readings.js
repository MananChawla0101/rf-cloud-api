// api/readings.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connection reuse for serverless (avoid reconnecting on each call)
let isConnected = false;
async function connectToDB() {
  if (isConnected) return;
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable not set');
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // recommended minimal options for serverless
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

// Schema
const rfSchema = new mongoose.Schema({
  frequency_hz: { type: Number, required: true },
  signal_dbm: { type: Number, required: true },
  classification: { type: String, default: 'UNKNOWN' },
  timestamp: { type: Date, default: Date.now },
  // optional fields you may add later:
  // location: { lat: Number, lon: Number },
  // screen_time_seconds: Number,
  // weather: Object,
}, { strict: true });

const RFReading = mongoose.models.RFReading || mongoose.model('RFReading', rfSchema);

// Helper: normalize a document for client (timestamp -> ms)
function normalizeDoc(doc) {
  return {
    frequency_hz: doc.frequency_hz,
    signal_dbm: doc.signal_dbm,
    classification: doc.classification,
    timestamp: (doc.timestamp instanceof Date) ? doc.timestamp.getTime() : doc.timestamp,
  };
}

export default async function handler(req, res) {
  // CORS headers (allowing all origins; restrict in production if needed)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectToDB();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Database connection failed' });
  }

  // POST -> Save a reading
  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      // Accept multiple possible field names (robustness)
      const frequency_hz = Number(body.frequency_hz ?? body.frequency ?? body.freq_hz);
      const signal_dbm = Number(body.signal_dbm ?? body.signalStrength ?? body.signal_dbm ?? body.signal);
      const classification = (body.classification ?? 'UNKNOWN').toString();
      const timestampMs = body.timestamp ? Number(body.timestamp) : Date.now();
      const timestamp = new Date(timestampMs);

      if (!isFinite(frequency_hz) || !isFinite(signal_dbm)) {
        return res.status(400).json({ success: false, message: 'Invalid numeric fields (frequency_hz, signal_dbm)' });
      }

      const doc = new RFReading({ frequency_hz, signal_dbm, classification, timestamp });
      await doc.save();

      return res.status(201).json({ success: true, message: 'Saved', data: normalizeDoc(doc) });
    } catch (err) {
      console.error('❌ POST save error:', err);
      return res.status(500).json({ success: false, message: 'Save failed' });
    }
  }

  // GET -> Fetch readings (with optional from/to/limit/sort)
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
        if (fromMs && isFinite(fromMs)) filter.timestamp.$gte = new Date(fromMs);
        if (toMs && isFinite(toMs)) filter.timestamp.$lte = new Date(toMs);
      }

      const docs = await RFReading.find(filter).sort(sort).limit(limit).lean().exec();

      const data = docs.map(normalizeDoc);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('❌ GET fetch error:', err);
      return res.status(500).json({ success: false, message: 'Fetch failed' });
    }
  }

  // other methods not allowed
  return res.status(405).json({ success: false, message: 'Only GET, POST, OPTIONS allowed' });
}
