from flask import Flask, request, jsonify
import subprocess
import os
import whisper
from googletrans import Translator

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Lazy load models (IMPORTANT for Render stability)
model = None
translator = Translator()

def get_whisper_model():
    global model
    if model is None:
        model = whisper.load_model("base")
    return model


@app.route("/")
def home():
    return "AI Translator Running 🚀"


@app.route("/process", methods=["POST"])
def process():
    try:
        # Validate file
        if "video" not in request.files:
            return jsonify({"status": "error", "message": "No video file uploaded"}), 400

        file = request.files["video"]

        video_path = os.path.join(UPLOAD_FOLDER, "input.mp4")
        audio_path = os.path.join(UPLOAD_FOLDER, "audio.wav")

        file.save(video_path)

        # STEP 1: extract audio (ffmpeg)
        subprocess.run([
            "ffmpeg", "-i", video_path,
            "-ar", "16000",
            "-ac", "1",
            audio_path,
            "-y"
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # STEP 2: speech to text (Whisper)
        whisper_model = get_whisper_model()
        result = whisper_model.transcribe(audio_path)
        text = result.get("text", "")

        # STEP 3: translate to Khmer
        translated = translator.translate(text, dest="km").text

        return jsonify({
            "status": "done",
            "originalText": text,
            "khmer": translated
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# IMPORTANT: Render uses PORT env variable
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
