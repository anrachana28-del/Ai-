from flask import Flask, request, jsonify
import requests
import moviepy.editor as mp
import whisper
from deep_translator import GoogleTranslator
import os
import uuid
import cloudinary
import cloudinary.uploader

app = Flask(__name__)

# ⚠️ lighter model (important for Render)
model = whisper.load_model("tiny")

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET")
)

def upload_to_cloudinary(file_path):
    result = cloudinary.uploader.upload(file_path, resource_type="video")
    return result["secure_url"]

@app.route("/")
def home():
    return "Python AI Running 🚀"

@app.route("/process", methods=["POST"])
def process():

    data = request.json
    video_url = data.get("videoUrl")

    uid = str(uuid.uuid4())

    input_path = f"/tmp/{uid}.mp4"
    audio_path = f"/tmp/{uid}.mp3"
    output_path = f"/tmp/{uid}_out.mp4"

    try:

        # 1. download
        video_data = requests.get(video_url).content
        with open(input_path, "wb") as f:
            f.write(video_data)

        # 2. extract audio
        video = mp.VideoFileClip(input_path)
        video.audio.write_audiofile(audio_path)

        # 3. speech to text
        text = model.transcribe(audio_path)["text"]

        # 4. translate
        khmer = GoogleTranslator(source="en", target="km").translate(text)

        # ❌ REMOVE TTS (this is crash source)

        # 5. just reuse original video
        final = video
        final.write_videofile(output_path, codec="libx264", audio_codec="aac")

        # 6. upload
        output_url = upload_to_cloudinary(output_path)

        return jsonify({
            "khmer": khmer,
            "outputVideo": output_url
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
