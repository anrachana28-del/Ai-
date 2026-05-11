const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   UPLOAD FOLDER
========================= */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 50 * 1024 * 1024 }
});

/* =========================
   CLOUDINARY CONFIG
========================= */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/* =========================
   FIREBASE INIT (SAFE)
========================= */
let db = null;

try {
    const serviceAccount = {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
            : undefined
    };

    if (serviceAccount.project_id && serviceAccount.private_key) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        db = admin.firestore();
        console.log("🔥 Firebase connected");
    }

} catch (err) {
    console.log("Firebase init error:", err.message);
}

/* =========================
   SAVE FIREBASE
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
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
    res.send("AI Video System Running 🚀");
});

/* =========================
   UPLOAD + AI PIPELINE
========================= */
app.post("/upload", upload.single("video"), async (req, res) => {

    const filePath = req.file?.path;

    try {

        if (!filePath) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        /* =========================
           1. UPLOAD CLOUDINARY
        ========================= */
        const cloudResult = await cloudinary.uploader.upload(filePath, {
            resource_type: "video"
        });

        const videoUrl = cloudResult.secure_url;

        /* =========================
           2. CALL PYTHON AI
        ========================= */
        let khmerText = "";

        try {
            const result = await axios.post(
                process.env.PYTHON_API,
                { videoUrl },
                { timeout: 300000 }
            );

            console.log("PYTHON RESPONSE:", result.data);

            /* =========================
               SAFE MAPPING (FIX)
            ========================= */
            khmerText =
                result.data?.khmer ||
                result.data?.text ||
                result.data?.result ||
                "no translation";

        } catch (err) {
            console.log("Python error:", err.response?.data || err.message);
            khmerText = "translation failed";
        }

        /* =========================
           3. SAVE FIREBASE
        ========================= */
        await saveToFirebase(
            "video",
            khmerText,
            videoUrl
        );

        /* =========================
           4. CLEAN FILE
        ========================= */
        fs.unlink(filePath, () => {});

        /* =========================
           RESPONSE
        ========================= */
        return res.json({
            status: "ok",
            outputVideo: videoUrl,
            khmer: khmerText
        });

    } catch (err) {

        console.log("UPLOAD ERROR:", err.message);

        if (filePath) fs.unlink(filePath, () => {});

        return res.status(500).json({
            error: "Server crash",
            message: err.message
        });
    }
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});
