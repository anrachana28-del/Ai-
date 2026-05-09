const express = require("express");
const multer = require("multer");
const axios = require("axios");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { bucket } = require("./firebase");
const { init, progress } = require("./socket");

const app = express();
const server = http.createServer(app);

init(server);

app.use(cors());
app.use(express.json());

/* =========================
   SAFE UPLOAD FOLDER FIX
========================= */
const uploadDir = path.join(__dirname, "uploads");

// prevent crash (important fix)
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    dest: uploadDir,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit (optional safe)
    }
});

/* =========================
   UPLOAD API
========================= */
app.post("/upload", upload.single("video"), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({ error: "No video uploaded" });
    }

    try {
        const fileName = Date.now() + ".mp4";
        const firebasePath = "videos/" + fileName;

        progress(10, "Uploading to Firebase...");

        // Upload to Firebase
        await bucket.upload(req.file.path, {
            destination: firebasePath,
            metadata: {
                contentType: "video/mp4"
            }
        });

        const file = bucket.file(firebasePath);
        await file.makePublic();

        const videoUrl =
            `https://storage.googleapis.com/${bucket.name}/${firebasePath}`;

        progress(40, "AI Processing...");

        // Call Python AI
        const result = await axios.post(process.env.PYTHON_API, {
            videoUrl
        });

        progress(100, "Done");

        // CLEAN TEMP FILE (VERY IMPORTANT)
        fs.unlink(req.file.path, () => {});

        res.json({
            outputVideo: result.data.outputVideo,
            text: result.data.khmer
        });

    } catch (err) {
        console.error("UPLOAD ERROR:", err);

        // clean file even if error
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }

        res.status(500).json({
            error: "Server error",
            message: err.message
        });
    }
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});
