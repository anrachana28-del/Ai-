const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
require("dotenv").config();
const FormData = require("form-data");

const app = express();

/* =========================
   FIREBASE INIT
========================= */
admin.initializeApp({
    credential: admin.credential.cert(require("./firebase-key.json"))
});

const db = admin.firestore();

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

/* =========================
   MULTER
========================= */
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 10 * 1024 * 1024 }
});

/* =========================
   SAVE TO FIREBASE (AUTO)
========================= */
async function saveToFirebase(original, khmer, videoUrl) {
    await db.collection("ai_videos").add({
        original: original,
        khmer: khmer,
        videoUrl: videoUrl,
        createdAt: Date.now()
    });
}

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
    res.send("AI Video System Running 🚀");
});

/* =========================
   UPLOAD + AI + AUTO SAVE
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

        /* =========================
           CALL PYTHON AI
        ========================= */
        let result;

        try {
            const form = new FormData();
            form.append("video", fs.createReadStream(filePath));

            result = await axios.post(
                process.env.PYTHON_API,
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 300000
                }
            );

        } catch (err) {
            console.log("Python error:", err.message);
            result = { data: { outputVideo: null, khmer: "failed" } };
        }

        const videoUrl = result.data.outputVideo;
        const khmerText = result.data.khmer || "";

        /* =========================
           AUTO SAVE FIREBASE
        ========================= */
        await saveToFirebase(
            "original video text",
            khmerText,
            videoUrl
        );

        /* =========================
           CLEAN FILE
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
   START SERVER
========================= */
const PORT = process.env.PORT || 1000;

app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
