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

    # save file
    file = request.files["video"]
    file.save(input_path)

    # 🔥 FFmpeg (NO RAM CRASH)
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-vf", "scale=640:360",
        "-preset", "ultrafast",
        "-y",
        output_path
    ]

    subprocess.run(cmd)

    return jsonify({
        "status": "done",
        "video": "/files/output.mp4"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
