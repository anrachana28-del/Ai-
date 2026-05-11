const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const FormData = require("form-data");
require("dotenv").config();

const app = express();

/* =========================
   SAFE CORS + JSON
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   UPLOAD FOLDER SAFE
========================= */
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/* =========================
   MULTER
========================= */
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 10 * 1024 * 1024 }
});

/* =========================
   FIREBASE SAFE INIT (FIXED)
========================= */
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_KEY || "{}");

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

} catch (err) {
    console.log("Firebase init skipped or error:", err.message);
}

const db = admin.firestore ? admin.firestore() : null;

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
    res.send("AI Video Server Running 🚀");
});

/* =========================
   SAVE FUNCTION
========================= */
async function saveToFirebase(original, khmer, videoUrl) {
    if (!db) return;

    try {
        await db.collection("ai_videos").add({
            original,
            khmer,
            videoUrl,
            createdAt: Date.now()
        });
    } catch (err) {
        console.log("Firebase save error:", err.message);
    }
}

/* =========================
   UPLOAD API
========================= */
app.post("/upload", upload.single("video"), async (req, res) => {

    let filePath = req.file?.path;

    try {

        if (!filePath) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        if (!process.env.PYTHON_API) {
            return res.status(500).json({ error: "PYTHON_API missing" });
        }

        let videoUrl = null;
        let khmerText = "";

        /* =========================
           CALL PYTHON SAFELY
        ========================= */
        try {
            const form = new FormData();
            form.append("video", fs.createReadStream(filePath));

            const result = await axios.post(
                process.env.PYTHON_API,
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 300000
                }
            );

            videoUrl = result.data.outputVideo;
            khmerText = result.data.khmer || "";

        } catch (err) {
            console.log("Python error:", err.message);
        }

        /* =========================
           AUTO SAVE FIREBASE
        ========================= */
        await saveToFirebase(
            "original text",
            khmerText,
            videoUrl
        );

        /* =========================
           CLEAN FILE
        ========================= */
        fs.unlink(filePath, () => {});

        return res.json({
            status: "ok",
            outputVideo: videoUrl,
            khmer: khmerText
        });

    } catch (err) {

        console.log("UPLOAD ERROR:", err.message);

        if (filePath) {
            fs.unlink(filePath, () => {});
        }

        return res.status(500).json({
            error: "Server crash",
            message: err.message
        });
    }
});

/* =========================
   START SERVER (RENDER SAFE)
========================= */
const PORT = process.env.PORT || 1000;

app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
