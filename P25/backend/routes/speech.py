# This module handles speech-related routes, including uploading audio, saving transcripts, and generating summaries.
from flask import Flask, request, jsonify, Blueprint
from .audio_helpers import transcribe_with_assemblyai
from flask_cors import CORS
import datetime
from models import db, User, Meeting, Material, Message
import google.generativeai as genai
import os
from .auth import get_structured_meeting_prompt


# Create a Flask blueprint for speech endpoints
speech_bp = Blueprint("speech", __name__)
# Store transcripts temporarily in memory (for debugging or quick reference)
transcript_list = []

# This endpoint accepts an uploaded audio file, transcribes it using AssemblyAI, and returns the transcript.
@speech_bp.route("/upload-audio", methods=["POST"])
def upload_audio():
    file = request.files["audio"]
    transcript = transcribe_with_assemblyai(file)
    return jsonify({"transcript": transcript})

# This endpoint saves the processed transcript to the database, replaces speaker names if mapped,
# and triggers meeting summary generation via Gemini AI.
@speech_bp.route("/save-transcript", methods=["POST"])
def save_transcript():
    data = request.json
    speaker_map = data.get("speaker_map", {})
    transcript = data.get("transcript", "")
    meeting_id = data.get("meeting_id", None)
    user_id = data.get("user_id", None)
    user_name = data.get("user_name", None)


    # Update speaker names according to the provided mapping
    new_transcript = transcript
    for speaker, custom_name in speaker_map.items():
        import re
        escaped_speaker = re.escape(speaker)
        pattern = re.compile(escaped_speaker + r":", re.MULTILINE)
        new_transcript = pattern.sub(custom_name + ":", new_transcript)
    
    # Store the transcript in-memory with a timestamp
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_transcript = f"{timestamp}\n{new_transcript}"
    transcript_list.append(new_transcript)


    # Store the transcript as meeting material in the database
    material = Material(
        user_id=user_id,
        meeting_id=meeting_id,
        filename="voice_meeting",
        content=new_transcript,
        timestamp=datetime.datetime.now()
    )
    db.session.add(material)
    # Add a message entry to inform the user of meeting completion
    complete_time = datetime.datetime.now().strftime("%I:%M %p %d %B %Y")
    user_msg = Message(
        user_id=user_id,
        meeting_id=meeting_id,
        speaker=user_name,
        content=f"You have completed a voice meeting on {complete_time}",
        is_summary=False,
        timestamp=datetime.datetime.now()
    )
    db.session.add(user_msg)

    # Generate a structured meeting summary using the Gemini API
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        model = genai.GenerativeModel(model_name="models/gemini-3.8-flash")
        
        meeting_prompt = get_structured_meeting_prompt()
        full_prompt = f"""{meeting_prompt}

## Meeting Material Content:
{new_transcript}

Please analyze the above meeting material and generate a comprehensive meeting summary following the format specified above. Identify whether this is an internal team meeting or a guidance meeting based on the content, then apply the appropriate format."""

        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=1500,
                temperature=0.3,
            )
        )
        summary = response.text

        summary_msg = Message(
            user_id=user_id,
            meeting_id=meeting_id,
            speaker="agent",
            content=summary,
            is_summary=False,
            timestamp=datetime.datetime.now()
        )
        db.session.add(summary_msg)
        db.session.commit()

    except Exception as e:
        print("❌ Gemini summarization failed:", e)


    # Write the transcript to a local file for record-keeping
    with open("transcript_record.txt", "a", encoding="utf-8") as f:
        f.write("==== New Transcript ====\n")
        f.write(new_transcript + "\n\n")
    return jsonify({"msg": "保存成功！"})
