const express = require("express");
const multer = require("multer");
const axios = require("axios");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

/* SAFE UPLOAD FOLDER */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

/* HEALTH */
app.get("/", (req, res) => {
    res.send("AI Server Running 🚀");
});

/* UPLOAD API */
app.post("/upload", upload.single("video"), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {

        /* 1. UPLOAD TO CLOUDINARY */
        const cloudForm = new FormData();

        cloudForm.append("file", fs.createReadStream(req.file.path));
        cloudForm.append("upload_preset", process.env.CLOUDINARY_PRESET);

        const cloudRes = await axios.post(
            `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD}/video/upload`,
            cloudForm,
            { headers: cloudForm.getHeaders() }
        );

        const videoUrl = cloudRes.data.secure_url;

        /* 2. SEND TO PYTHON AI */
        const result = await axios.post(process.env.PYTHON_API, {
            videoUrl
        });

        /* 3. CLEAN TEMP FILE */
        fs.unlink(req.file.path, () => {});

        res.json({
            outputVideo: result.data.outputVideo || videoUrl,
            text: result.data.khmer || "Done"
        });

    } catch (err) {

        console.log("ERROR:", err.message);

        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }

        res.status(500).json({
            error: "Server error",
            message: err.message
        });
    }
});

/* START SERVER */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running on", PORT);
});
