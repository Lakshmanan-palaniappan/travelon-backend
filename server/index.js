require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');

const app = express();
app.use(bodyParser.json());
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = process.env.CONTRACT_ADDRESS;
const contractABI = [
  
];

const contract = new ethers.Contract(contractAddress, contractABI, wallet);

function computeHash(text) {
  return ethers.keccak256(ethers.toUtf8Bytes(text));
}

app.get('/', (req, res) => res.json({ ok: true }));

/**
 * Register Tourist
 * body: { name, kycType, kycData, approved (bool) }
 * kycData: canonical string (eg: "Aadhaar:1234|itineraryHash:0xabc")
 */
app.post('/tourist', async (req, res) => {
  try {
    const { name, kycType, kycData, approved = false } = req.body;
    if (!name || !kycType || !kycData) return res.status(400).json({ error: "name, kycType and kycData required" });

    const kycHash = computeHash(kycData);
    const tx = await contract.registerTourist(name, kycType, kycHash, approved);
    const receipt = await tx.wait();

    return res.json({ success: true, txHash: receipt.transactionHash, touristTxReceipt: receipt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/tourist/approval', async (req, res) => {
  try {
    const { touristId, approved } = req.body;
    if (!touristId || typeof approved !== 'boolean') return res.status(400).json({ error: "touristId and approved required" });

    const tx = await contract.updateApproval(touristId, approved);
    const receipt = await tx.wait();
    return res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/verify/tourist', async (req, res) => {
  try {
    const { touristId, kycData } = req.body;
    if (!touristId || !kycData) return res.status(400).json({ error: "touristId and kycData required" });

    const kycHash = computeHash(kycData);
    const valid = await contract.verifyTouristKYC(touristId, kycHash);
    return res.json({ valid });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/alert', async (req, res) => {
  try {
    const { touristId, alertData } = req.body;
    if (!touristId || !alertData) return res.status(400).json({ error: "touristId and alertData required" });

    const alertHash = computeHash(alertData);
    const tx = await contract.logAlert(touristId, alertHash);
    const receipt = await tx.wait();
    return res.json({ success: true, txHash: receipt.transactionHash, alertTxReceipt: receipt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/verify/alert', async (req, res) => {
  try {
    const { alertId, alertData } = req.body;
    if (!alertId || !alertData) return res.status(400).json({ error: "alertId and alertData required" });

    const alertHash = computeHash(alertData);
    const valid = await contract.verifyAlert(alertId, alertHash);
    return res.json({ valid });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/agency', async (req, res) => {
  try {
    const { name, approved = false } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const tx = await contract.registerAgency(name, approved);
    const receipt = await tx.wait();
    return res.json({ success: true, txHash: receipt.transactionHash, agencyTxReceipt: receipt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/agency/approval', async (req, res) => {
  try {
    const { agencyId, approved } = req.body;
    if (!agencyId || typeof approved !== 'boolean') return res.status(400).json({ error: "agencyId and approved required" });

    const tx = await contract.updateAgencyApproval(agencyId, approved);
    const receipt = await tx.wait();
    return res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/tourist/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tourist = await contract.tourists(id);
    if (!tourist.id) return res.status(404).json({ error: "Tourist not found" });
    res.json(tourist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/alert/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const alert = await contract.alerts(id);
    if (!alert.alertId) return res.status(404).json({ error: "Alert not found" });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/agency/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const agency = await contract.agencies(id);
    if (!agency.agencyId) return res.status(404).json({ error: "Agency not found" });
    res.json(agency);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /verify/tourist?touristId=1&kycData=Passport:1234|Trip:0xabc
app.get('/verify/tourist', async (req, res) => {
  try {
    const { touristId, kycData } = req.query;
    if (!touristId || !kycData) return res.status(400).json({ error: "touristId and kycData required" });

    const kycHash = computeHash(kycData);
    const valid = await contract.verifyTouristKYC(parseInt(touristId), kycHash);
    res.json({ valid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /verify/alert?alertId=1&alertData=SOS:LocationX
app.get('/verify/alert', async (req, res) => {
  try {
    const { alertId, alertData } = req.query;
    if (!alertId || !alertData) return res.status(400).json({ error: "alertId and alertData required" });

    const alertHash = computeHash(alertData);
    const valid = await contract.verifyAlert(parseInt(alertId), alertHash);
    res.json({ valid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Travelon backend listening on ${PORT}`));
