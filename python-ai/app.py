from flask import Flask, request, jsonify
import requests
import os
import uuid
import cloudinary
import cloudinary.uploader

from moviepy.editor import VideoFileClip
import whisper
from deep_translator import GoogleTranslator

app = Flask(__name__)

# =========================
# ⚡ MODEL (LIGHT WEIGHT)
# =========================
model = whisper.load_model("tiny")

# =========================
# ☁️ CLOUDINARY CONFIG
# =========================
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET")
)

# =========================
# UPLOAD FUNCTION
# =========================
def upload_to_cloudinary(file_path):
    try:
        result = cloudinary.uploader.upload(
            file_path,
            resource_type="video"
        )
        return result["secure_url"]
    except Exception as e:
        raise Exception(f"Cloud upload failed: {str(e)}")


# =========================
# HEALTH CHECK
# =========================
@app.route("/")
def home():
    return "Python AI Server Running 🚀"


# =========================
# MAIN PROCESS API
# =========================
@app.route("/process", methods=["POST"])
def process():

    data = request.get_json()

    if not data or "videoUrl" not in data:
        return jsonify({"error": "videoUrl is required"}), 400

    video_url = data["videoUrl"]
    uid = str(uuid.uuid4())

    input_path = f"/tmp/{uid}.mp4"
    audio_path = f"/tmp/{uid}.mp3"
    output_path = f"/tmp/{uid}_out.mp4"

    video = None

    try:
        # =========================
        # 1. DOWNLOAD VIDEO
        # =========================
        video_data = requests.get(video_url, timeout=30).content
        with open(input_path, "wb") as f:
            f.write(video_data)

        # =========================
        # 2. LOAD VIDEO
        # =========================
        video = VideoFileClip(input_path)

        # =========================
        # 3. EXTRACT AUDIO
        # =========================
        video.audio.write_audiofile(audio_path, logger=None)

        # =========================
        # 4. SPEECH TO TEXT
        # =========================
        text = model.transcribe(audio_path)["text"]

        # =========================
        # 5. TRANSLATE TO KHMER
        # =========================
        khmer = GoogleTranslator(source="en", target="km").translate(text)

        # =========================
        # 6. KEEP ORIGINAL VIDEO (NO TTS)
        # =========================
        video.write_videofile(
            output_path,
            codec="libx264",
            audio_codec="aac",
            logger=None
        )

        # =========================
        # 7. UPLOAD RESULT
        # =========================
        output_url = upload_to_cloudinary(output_path)

        return jsonify({
            "text": text,
            "khmer": khmer,
            "outputVideo": output_url
        })

    except Exception as e:
        return jsonify({
            "error": "Processing failed",
            "message": str(e)
        }), 500

    finally:
        # cleanup
        try:
            if os.path.exists(input_path):
                os.remove(input_path)
            if os.path.exists(audio_path):
                os.remove(audio_path)
            if os.path.exists(output_path):
                os.remove(output_path)
            if video:
                video.close()
        except:
            pass


# =========================
# RUN SERVER (RENDER FIX)
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
