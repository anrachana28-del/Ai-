from flask import Flask, request, jsonify
import subprocess
import os

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/")
def home():
    return "AI Video System Running 🚀"

@app.route("/process", methods=["POST"])
def process():

    input_path = os.path.join(UPLOAD_FOLDER, "input.mp4")
    output_path = os.path.join(UPLOAD_FOLDER, "output.mp4")

    # save video
    file = request.files["video"]
    file.save(input_path)

    # 🔥 FFmpeg optimize (low RAM for Render)
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-vf", "scale=640:360",
        "-preset", "ultrafast",
        "-y",
        output_path
    ]

    subprocess.run(cmd)

    # 🧠 TEMP KHMER TEXT (placeholder)
    khmer_text = "វីដេអូបានបំលែងរួចរាល់"

    return jsonify({
        "status": "done",
        "khmer": khmer_text,   # ✅ FIXED (IMPORTANT)
        "outputVideo": "/files/output.mp4"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
