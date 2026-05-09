from flask import Flask, request, jsonify
import requests
import moviepy.editor as mp
import whisper
from deep_translator import GoogleTranslator
from TTS.api import TTS
import os

app = Flask(__name__)

model = whisper.load_model("base")
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")

@app.route("/process", methods=["POST"])
def process():

    data = request.json
    video_url = data["videoUrl"]

    video_data = requests.get(video_url).content
    open("input.mp4", "wb").write(video_data)

    video = mp.VideoFileClip("input.mp4")

    video.audio.write_audiofile("audio.mp3")

    text = model.transcribe("audio.mp3")["text"]

    khmer = GoogleTranslator(source="en", target="km").translate(text)

    tts.tts_to_file(
        text=khmer,
        speaker_wav="voice.wav",
        language="km",
        file_path="khmer.wav"
    )

    final = video.set_audio(mp.AudioFileClip("khmer.wav"))
    final.write_videofile("output.mp4")

    return jsonify({
        "khmer": khmer,
        "outputVideo": "https://your-domain/output.mp4"
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
