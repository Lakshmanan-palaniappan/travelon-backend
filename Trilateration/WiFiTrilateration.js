// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// CSV file path
const csvFile = path.join(__dirname, 'wifi_logs.csv');

// Ensure CSV file has a header row
if (!fs.existsSync(csvFile)) {
  fs.writeFileSync(csvFile, 'timestamp,macAddress,signalStrength,lat,lng,accuracy,source\n');
}

// Local AP database (MAC -> lat/lng)
// Local database of APs (MAC -> lat/lng)
const localAPDB = {
  "c2:5b:d8:16:91:fd": { lat: 10.294033, lng: 78.764267 },   // your main AP
  "50:91:e3:f7:a4:27": { lat: 10.294500, lng: 78.764800 },   // ~70m NE
  "7a:8c:b5:7f:ec:e2": { lat: 10.293700, lng: 78.763900 },   // ~100m SW
  "dc:ea:e7:34:0a:a2": { lat: 10.295000, lng: 78.764400 },   // ~120m N
  "78:8c:b5:5f:ec:e4": { lat: 10.293300, lng: 78.765100 }    // ~180m SE
};


// RSSI → distance
function rssiToDistance(rssi, A = -40, n = 2.5) {
  return Math.pow(10, (A - rssi) / (10 * n));
}

// Lat/Lon <-> XY helpers
const R = 6371000;
function latLonToXY(lat, lon, lat0, lon0) {
  const deg2rad = Math.PI / 180;
  const x = (lon - lon0) * deg2rad * R * Math.cos(lat0 * deg2rad);
  const y = (lat - lat0) * deg2rad * R;
  return { x, y };
}
function xyToLatLon(x, y, lat0, lon0) {
  const deg2rad = Math.PI / 180;
  const lat = lat0 + (y / R) / deg2rad;
  const lon = lon0 + (x / (R * Math.cos(lat0 * deg2rad))) / deg2rad;
  return { lat, lon };
}

// Trilateration
function trilaterate(apPositions, distances) {
  if (apPositions.length < 3) throw new Error('Need ≥3 APs');

  const ref = apPositions[0];
  const xy = apPositions.map(p => latLonToXY(p.lat, p.lng, ref.lat, ref.lng));
  const d = distances;

  const A = [], b = [];
  for (let i = 1; i < xy.length; i++) {
    const xi = xy[i].x, yi = xy[i].y, x1 = xy[0].x, y1 = xy[0].y;
    A.push([2 * (xi - x1), 2 * (yi - y1)]);
    b.push(d[0] ** 2 - d[i] ** 2 + xi ** 2 - x1 ** 2 + yi ** 2 - y1 ** 2);
  }

  const AtA = [[0, 0], [0, 0]], Atb = [0, 0];
  for (let i = 0; i < A.length; i++) {
    AtA[0][0] += A[i][0] * A[i][0];
    AtA[0][1] += A[i][0] * A[i][1];
    AtA[1][0] += A[i][1] * A[i][0];
    AtA[1][1] += A[i][1] * A[i][1];
    Atb[0] += A[i][0] * b[i];
    Atb[1] += A[i][1] * b[i];
  }

  const det = AtA[0][0] * AtA[1][1] - AtA[0][1] * AtA[1][0];
  const inv = [
    [AtA[1][1] / det, -AtA[0][1] / det],
    [-AtA[1][0] / det, AtA[0][0] / det]
  ];
  const solX = inv[0][0] * Atb[0] + inv[0][1] * Atb[1];
  const solY = inv[1][0] * Atb[0] + inv[1][1] * Atb[1];

  const { lat, lon } = xyToLatLon(solX, solY, ref.lat, ref.lng);
  return { lat, lng: lon, accuracy: 30 };
}

// =======================
// ENDPOINTS
// =======================

// Calculate location
// Calculate location
app.post('/get-location', (req, res) => {
  const { wifiAccessPoints } = req.body;
  if (!wifiAccessPoints || wifiAccessPoints.length === 0) {
    return res.status(400).json({ error: 'wifiAccessPoints required' });
  }

  const knownAPs = [], distances = [], usedAPs = [];
  for (const ap of wifiAccessPoints) {
    const mac = (ap.macAddress || ap.bssid || '').toLowerCase();
    if (localAPDB[mac]) {
      knownAPs.push(localAPDB[mac]);
      distances.push(rssiToDistance(ap.signalStrength ?? ap.level));
      usedAPs.push({ ...ap, macAddress: mac });
    }
  }

  let result = null;
  let source = "unknown";

  try {
    if (knownAPs.length >= 3) {
      result = trilaterate(knownAPs, distances);
      source = "local-trilateration";
    } else if (knownAPs.length === 1) {
      result = { ...knownAPs[0], accuracy: 500 };
      source = "single-ap";
    } else {
      return res.status(404).json({ error: 'Not enough known APs' });
    }

    const timestamp = new Date().toISOString();

    // ✅ Log final estimated device location
    const deviceRow = `${timestamp},device,-,${result.lat},${result.lng},${result.accuracy},${source}\n`;
    fs.appendFileSync(csvFile, deviceRow);

    // ✅ Log only the APs that were used in calculation
    usedAPs.forEach(ap => {
      const mac = ap.macAddress;
      const rssi = ap.signalStrength ?? ap.level;
      const apLat = localAPDB[mac].lat;
      const apLng = localAPDB[mac].lng;

      const row = `${timestamp},${mac},${rssi},${apLat},${apLng},${result.accuracy},used-ap\n`;
      fs.appendFileSync(csvFile, row);
    });

    // ✅ Log other APs as raw-scan (for reference)
    wifiAccessPoints.forEach(ap => {
      const mac = (ap.macAddress || ap.bssid || '').toLowerCase();
      if (!localAPDB[mac]) {
        const rssi = ap.signalStrength ?? ap.level;
        const row = `${timestamp},${mac},${rssi},,,,"raw-scan"\n`;
        fs.appendFileSync(csvFile, row);
      }
    });

    res.json({ location: result, source, usedAPs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Save scan only (no location calculation)
app.post('/save-scan', (req, res) => {
  const { wifiAccessPoints } = req.body;
  if (!wifiAccessPoints || wifiAccessPoints.length === 0) {
    return res.status(400).json({ error: 'wifiAccessPoints required' });
  }

  const timestamp = new Date().toISOString();
  wifiAccessPoints.forEach(ap => {
    const mac = (ap.macAddress || ap.bssid || '').toLowerCase();
    const rssi = ap.signalStrength ?? ap.level;
    const row = `${timestamp},${mac},${rssi},,,,"raw-scan"\n`;
    fs.appendFileSync(csvFile, row);
  });

  res.json({ message: 'Scan saved successfully' });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
app.listen(3000, () => console.log("Server running on port 3000"));
