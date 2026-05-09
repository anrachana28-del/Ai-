from flask import Flask, request, jsonify
import requests
import moviepy.editor as mp
import whisper
from deep_translator import GoogleTranslator
from TTS.api import TTS
import os
import uuid

import cloudinary
import cloudinary.uploader

app = Flask(__name__)

# ===== AI MODELS =====
model = whisper.load_model("base")
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")

# ===== CLOUDINARY CONFIG =====
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET")
)

# ===== UPLOAD FUNCTION =====
def upload_to_cloudinary(file_path):
    result = cloudinary.uploader.upload(
        file_path,
        resource_type="video"
    )
    return result["secure_url"]

# ===== API =====
@app.route("/process", methods=["POST"])
def process():

    data = request.json
    video_url = data["videoUrl"]

    uid = str(uuid.uuid4())

    input_path = f"/tmp/{uid}.mp4"
    audio_path = f"/tmp/{uid}.mp3"
    voice_path = f"/tmp/{uid}_voice.wav"
    output_path = f"/tmp/{uid}_out.mp4"

    try:

        # 1. Download video
        video_data = requests.get(video_url).content
        open(input_path, "wb").write(video_data)

        # 2. Extract audio
        video = mp.VideoFileClip(input_path)
        video.audio.write_audiofile(audio_path)

        # 3. Speech to text
        text = model.transcribe(audio_path)["text"]

        # 4. Translate to Khmer
        khmer = GoogleTranslator(source="en", target="km").translate(text)

        # 5. TTS (voice)
        tts.tts_to_file(
            text=khmer,
            speaker_wav="voice.wav",
            language="en",
            file_path=voice_path
        )

        # 6. Merge audio + video
        final = video.set_audio(mp.AudioFileClip(voice_path))
        final.write_videofile(output_path, codec="libx264", audio_codec="aac")

        # 7. Upload final video to Cloudinary
        output_url = upload_to_cloudinary(output_path)

        return jsonify({
            "khmer": khmer,
            "outputVideo": output_url
        })

    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({
            "error": "Processing failed",
            "message": str(e)
        }), 500


# ===== RUN =====
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
