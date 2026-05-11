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
   UPLOAD CONFIG
========================= */
const upload = multer({ dest: "uploads/" });

/* =========================
   CLOUDINARY
========================= */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/* =========================
   FIREBASE SAFE INIT
========================= */
let db = null;

try {
    const serviceAccount = {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
    };

    if (serviceAccount.project_id && serviceAccount.private_key) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        db = admin.firestore();
        console.log("🔥 Firebase connected");
    }

} catch (e) {
    console.log("Firebase error:", e.message);
}

/* =========================
   SAVE FUNCTION
========================= */
async function saveToFirebase(originalText, khmerText, videoUrl) {
    if (!db) return;

    try {
        await db.collection("ai_videos").add({
            original: originalText,
            khmer: khmerText,
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
   MAIN UPLOAD ROUTE
========================= */
app.post("/upload", upload.single("video"), async (req, res) => {

    const filePath = req.file?.path;

    try {

        if (!filePath) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        /* =========================
           1. CLOUDINARY UPLOAD
        ========================= */
        const cloud = await cloudinary.uploader.upload(filePath, {
            resource_type: "video"
        });

        const videoUrl = cloud.secure_url;

        /* =========================
           2. CALL PYTHON AI
        ========================= */
        let khmerText = "";
        let originalText = "";

        try {
            const result = await axios.post(
                process.env.PYTHON_API,
                { videoUrl },
                { timeout: 600000 }
            );

            console.log("PYTHON RESPONSE:", result.data);

            khmerText = result.data?.khmer || "no khmer text";
            originalText = result.data?.originalText || "";

        } catch (err) {
            console.log("Python error:", err.response?.data || err.message);

            khmerText = "translation failed";
            originalText = "";
        }

        /* =========================
           3. SAVE FIREBASE
        ========================= */
        await saveToFirebase(originalText, khmerText, videoUrl);

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
            originalText,
            khmer: khmerText
        });

    } catch (err) {

        console.log("UPLOAD ERROR:", err.message);

        if (filePath) fs.unlink(filePath, () => {});

        return res.status(500).json({
            error: "Server error",
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
