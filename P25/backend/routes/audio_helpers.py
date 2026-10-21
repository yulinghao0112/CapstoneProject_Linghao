import requests

# AssemblyAI API key for authentication
ASSEMBLYAI_API_KEY = "f3f45436e5c8476ea27e7c0759ba8ffc"

# Uploads an audio file to AssemblyAI, requests transcription with speaker labels, and polls until completion
def transcribe_with_assemblyai(file_obj):
    # Set the request headers with the API key
    headers = {'authorization': ASSEMBLYAI_API_KEY}
    
    # Upload the audio file to AssemblyAI and retrieve a URL
    upload_res = requests.post(
        "https://api.assemblyai.com/v2/upload",
        headers=headers, data=file_obj
    )
    audio_url = upload_res.json()["upload_url"]

    # Configure the transcription request, enabling speaker labels and setting the language code
    json = {
        "audio_url": audio_url,
        "speaker_labels": True,
        "language_code": "en"  
    }
    # Send the transcription request to AssemblyAI
    transcript_res = requests.post(
        "https://api.assemblyai.com/v2/transcript",
        json=json, headers=headers
    )
    transcript_id = transcript_res.json()["id"]

    # Repeatedly check the transcription status until completion or failure
    while True:
        poll_res = requests.get(
            f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
            headers=headers
        )
        data = poll_res.json()
        print("Poll response:", data)
        # Process completed transcription results into speaker-tagged lines
        if data["status"] == "completed":
            lines = []
            for utterance in data.get("utterances", []):
                lines.append(f"Speaker {utterance['speaker']}: {utterance['text']}")
            return "\n".join(lines)
        # Return a failure message if transcription fails
        elif data["status"] == "failed":
            return "Transcription failed."
        # Wait 2 seconds before polling again
        import time; time.sleep(2)