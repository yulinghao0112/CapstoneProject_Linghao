import asyncio
import websockets
from google.cloud import speech
from flask import Flask
from datetime import datetime
import os
import json

# 导入数据库模型
from models import db, Message
from config import Config  # 你原来使用的数据库配置

# Google API 凭证
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "google-creds.json"

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

speech_client = speech.SpeechClient()

async def recognize(websocket, path):
    init = await websocket.recv()
    try:
        meta = json.loads(init)
        user_id = meta["user_id"]
        meeting_id = meta["meeting_id"]
    except:
        await websocket.send(json.dumps({"error": "Missing user_id or meeting_id"}))
        return

    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="en-US",
        enable_speaker_diarization=True,
        diarization_speaker_count=2,
        enable_automatic_punctuation=True,
    )
    streaming_config = speech.StreamingRecognitionConfig(
        config=config,
        interim_results=True,
    )

    async def audio_generator():
        while True:
            try:
                chunk = await websocket.recv()
                yield speech.StreamingRecognizeRequest(audio_content=chunk)
            except websockets.exceptions.ConnectionClosed:
                break

    async with app.app_context():
        try:
            responses = speech_client.streaming_recognize(streaming_config, audio_generator())
            async for response in responses:
                for result in response.results:
                    if not result.is_final:
                        continue
                    alt = result.alternatives[0]
                    text = alt.transcript
                    speaker = f"Speaker {alt.words[0].speaker_tag}" if alt.words else "Speaker"

                    message = Message(
                        user_id=user_id,
                        meeting_id=meeting_id,
                        timestamp=datetime.utcnow(),
                        speaker=speaker,
                        content=text,
                        is_summary=False,
                    )
                    db.session.add(message)
                    db.session.commit()

                    await websocket.send(json.dumps({
                        "text": text,
                        "speaker": speaker
                    }))
        except Exception as e:
            await websocket.send(json.dumps({"error": str(e)}))

async def main():
    print("🎙 Speech-to-Text WebSocket Server running on ws://localhost:8765")
    async with websockets.serve(recognize, "0.0.0.0", 8765):
        await asyncio.Future()  # 永远阻塞，直到强制退出

if __name__ == "__main__":
    asyncio.run(main())