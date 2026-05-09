const express = require("express");
const multer = require("multer");
const axios = require("axios");
const http = require("http");
const cors = require("cors");
require("dotenv").config();

const { bucket } = require("./firebase");
const { init, progress } = require("./socket");

const app = express();
const server = http.createServer(app);

init(server);

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("video"), async (req, res) => {

    try {
        const fileName = Date.now() + ".mp4";
        const firebasePath = "videos/" + fileName;

        progress(10, "Uploading...");

        await bucket.upload(req.file.path, {
            destination: firebasePath,
            metadata: { contentType: "video/mp4" }
        });

        const file = bucket.file(firebasePath);
        await file.makePublic();

        const videoUrl = `https://storage.googleapis.com/${bucket.name}/${firebasePath}`;

        progress(40, "AI Processing...");

        const result = await axios.post(process.env.PYTHON_API, {
            videoUrl
        });

        progress(100, "Done");

        res.json({
            outputVideo: result.data.outputVideo,
            text: result.data.khmer
        });

    } catch (err) {
        console.log(err);
        res.status(500).send("error");
    }
});

server.listen(process.env.PORT, () => {
    console.log("Server running");
});
