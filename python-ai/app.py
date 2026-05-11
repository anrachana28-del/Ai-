from flask import Flask, request, jsonify
import subprocess
import os
import whisper
from googletrans import Translator

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# load AI model
model = whisper.load_model("base")
translator = Translator()

@app.route("/")
def home():
    return "AI Translator Running 🚀"

@app.route("/process", methods=["POST"])
def process():

    try:
        video_path = os.path.join(UPLOAD_FOLDER, "input.mp4")
        audio_path = os.path.join(UPLOAD_FOLDER, "audio.wav")

        file = request.files["video"]
        file.save(video_path)

        # 🎧 STEP 1: extract audio
        subprocess.run([
            "ffmpeg", "-i", video_path,
            "-ar", "16000",
            "-ac", "1",
            audio_path,
            "-y"
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 🧠 STEP 2: speech to text
        result = model.transcribe(audio_path)
        text = result["text"]

        # 🌍 STEP 3: translate to Khmer
        translated = translator.translate(text, dest="km").text

        return jsonify({
            "status": "done",
            "originalText": text,
            "khmer": translated
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "khmer": "translation failed",
            "message": str(e)
        })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
