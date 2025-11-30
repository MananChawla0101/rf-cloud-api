// api/readings.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// --------- DB CONNECTION (REUSE) ----------
let isConnected = false;

async function connectToDB() {
  if (isConnected) return;

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable not set');
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // basic recommended options
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

// --------- SCHEMA + MODEL ----------
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

// Normalize doc -> plain JSON for client
function normalizeDoc(doc) {
  return {
    frequency_hz: doc.frequency_hz,
    signal_dbm: doc.signal_dbm,
    classification: doc.classification,
    timestamp:
      doc.timestamp instanceof Date ? doc.timestamp.getTime() : doc.timestamp,
  };
}

// --------- API HANDLER ----------
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ensure DB
  try {
    await connectToDB();
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: 'Database connection failed' });
  }

  // ---------- POST: SAVE READING ----------
  if (req.method === 'POST') {
    try {
      let body = req.body;

      // On Vercel, if Content-Type is application/json,
      // req.body is already an object.
      // But just in case it's a string, try to parse it.
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          console.error('❌ Could not parse JSON body:', body);
          return res
            .status(400)
            .json({ success: false, message: 'Body is not valid JSON' });
        }
      }

      if (!body || typeof body !== 'object') {
        return res
          .status(400)
          .json({ success: false, message: 'Request body must be JSON' });
      }

      // Accept multiple possible field names
      const rawFreq = body.frequency_hz ?? body.frequency ?? body.freq_hz;
      const rawSig =
        body.signal_dbm ?? body.signalStrength ?? body.signal ?? body.s;
      const rawCls = body.classification ?? 'UNKNOWN';
      const rawTs = body.timestamp;

      const frequency_hz = Number(rawFreq);
      const signal_dbm = Number(rawSig);
      const classification = String(rawCls);

      const timestampMs =
        rawTs !== undefined ? Number(rawTs) : Date.now();
      const timestamp = new Date(
        Number.isFinite(timestampMs) ? timestampMs : Date.now()
      );

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
      return res
        .status(500)
        .json({ success: false, message: 'Save failed' });
    }
  }

  // ---------- GET: FETCH READINGS ----------
  if (req.method === 'GET') {
    try {
      const q = req.query || {};

      const fromMs = q.from ? Number(q.from) : null;
      const toMs = q.to ? Number(q.to) : null;
      const limit = Math.min(
        5000,
        Math.max(1, Number(q.limit || 1000))
      );
      const sortParam = String(q.sort ?? 'asc').toLowerCase();
      const sort = sortParam === 'desc' ? { timestamp: -1 } : { timestamp: 1 };

      const filter = {};
      if (fromMs || toMs) {
        filter.timestamp = {};
        if (fromMs && Number.isFinite(fromMs)) {
          filter.timestamp.$gte = new Date(fromMs);
        }
        if (toMs && Number.isFinite(toMs)) {
          filter.timestamp.$lte = new Date(toMs);
        }
      }

      const docs = await RFReading.find(filter)
        .sort(sort)
        .limit(limit)
        .lean()
        .exec();

      const data = docs.map(normalizeDoc);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('❌ GET fetch error:', err);
      return res
        .status(500)
        .json({ success: false, message: 'Fetch failed' });
    }
  }

  // Other methods not allowed
  return res
    .status(405)
    .json({ success: false, message: 'Only GET, POST, OPTIONS allowed' });
}
