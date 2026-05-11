const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
require("dotenv").config();

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

/* Upload folder */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/* Multer config */
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 10 * 1024 * 1024 }
});

/* Health check */
app.get("/", (req, res) => {
    res.send("AI Server Running 🚀");
});

/* Static files (IMPORTANT FOR VIDEO) */
app.use("/files", express.static("uploads"));

/* Upload API */
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

        } catch (err) {
            console.log("Python error:", err.message);
        }

        /* clean file */
        fs.unlink(filePath, () => {});

        /* SAFE RESPONSE (NO FAKE STRING) */
        return res.json({
            status: "ok",
            outputVideo: videoUrl || null,
            message: "Done"
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

/* Start server */
const PORT = process.env.PORT || 1000;
app.listen(PORT, () => {
    console.log("Server running on", PORT);
});
