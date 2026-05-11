const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
require("dotenv").config();

const app = express();

/* =========================
   BASIC SETUP
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   SAFE UPLOAD FOLDER
========================= */
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/* =========================
   MULTER CONFIG (SAFE)
========================= */
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
    res.send("AI Server Running 🚀");
});

/* =========================
   UPLOAD API (FULL FIXED)
========================= */
app.post("/upload", upload.single("video"), async (req, res) => {

    let filePath = req.file?.path;

    try {

        /* CHECK FILE */
        if (!filePath) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        /* CHECK ENV */
        if (!process.env.PYTHON_API) {
            return res.status(500).json({ error: "PYTHON_API missing in .env" });
        }

        /* =========================
           STEP 1: SEND TO PYTHON
        ========================= */
        let videoUrl = null;
        let result;

        try {
            const form = new FormData();
            form.append("video", fs.createReadStream(filePath));

            result = await axios.post(
                process.env.PYTHON_API,
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 300000 // 5 min
                }
            );

            videoUrl = result.data.outputVideo;

        } catch (err) {
            console.log("Python Error:", err.message);

            // fallback (no crash)
            videoUrl = null;
        }

        /* =========================
           CLEAN TEMP FILE
        ========================= */
        if (filePath) {
            fs.unlink(filePath, () => {});
        }

        /* =========================
           RESPONSE
        ========================= */
        return res.json({
            status: "ok",
            outputVideo: videoUrl || "processing_failed",
            message: result?.data?.khmer || "Done"
        });

    } catch (err) {

        console.log("UPLOAD ERROR:", err.message);

        if (filePath) {
            fs.unlink(filePath, () => {});
        }

        return res.status(500).json({
            error: "Server crashed",
            message: err.message
        });
    }
});

/* =========================
   START SERVER (RENDER FIX)
========================= */
const PORT = process.env.PORT || 1000;

app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
