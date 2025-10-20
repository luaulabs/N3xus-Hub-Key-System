const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fetch = require('node-fetch'); // npm install node-fetch@2

const app = express();
app.use(cors());
app.use(express.json());

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1429841011928203367/u36rNHK3sQcjM4XYe_MbMOKo54zWUZm4Nm8q3RnBMPFvX_-5-2q6jF5hMw5zGErX7pNP"; // Replace with your webhook
const KEY_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

let currentKey = generateKey();
let lastGenerated = Date.now();

function generateKey() {
    return `KEY-${uuidv4().toUpperCase()}`;
}

async function sendToDiscord(key) {
    if (!DISCORD_WEBHOOK) return;
    try {
        await fetch(DISCORD_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: `New Key Generated: ${key}` })
        });
    } catch (err) {
        console.error("Failed to send Discord webhook:", err);
    }
}

// Generate first key on startup
sendToDiscord(currentKey);

// Automatically refresh key every 12 hours
setInterval(() => {
    currentKey = generateKey();
    lastGenerated = Date.now();
    console.log("New key generated:", currentKey);
    sendToDiscord(currentKey);
}, KEY_TTL_MS);

// GET /key -> return current key
app.get('/key', (req, res) => {
    res.json({ key: currentKey });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Key API running on port ${PORT}`));