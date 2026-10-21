import React, { useState, useRef, useEffect } from "react";
import { Button, Input, Row, Col, Modal, ModalHeader, ModalBody, ModalFooter } from "reactstrap";
import TranscriptDisplay from "./TranscriptDisplay";
import SpeakerNameForm from "./SpeakerNameForm";
// import AlertModal from "../../../../components/AlertModal";
import VoiceModal from "../../../../components/voiceModal";

export default function RecordingModal({
  onClose,
  setIsSending,
  meetingId,
  userId,
  username,
  onFetchMessages,
  setShowModal
}) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [speakers, setSpeakers] = useState([]);
  const [showSpeakerForm, setShowSpeakerForm] = useState(false);
  const [customizedTranscript, setCustomizedTranscript] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);
  const handleCloseAttempt = () => {
    if (isRecording || audioUrl) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new window.MediaRecorder(stream);
    mediaRecorderRef.current.ondataavailable = (e) => {
      audioChunks.current.push(e.data);
    };
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunks.current, { type: "audio/webm" });
      setAudioUrl(URL.createObjectURL(blob));
      const formData = new FormData();
      formData.append("audio", blob);
      const res = await fetch("http://localhost:5002/api/upload-audio", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setTranscript(data.transcript);
    };
    audioChunks.current = [];
    mediaRecorderRef.current.start();
    setIsRecording(true);
    setIsPaused(false);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (!isPaused) {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      } else {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      }
    }
  };

  const stopRecording = () => {
    setIsProcessing(true);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (transcript) {
      const regex = /Speaker [A-Z]:/g;
      const foundSpeakers = transcript.match(regex);
      if (foundSpeakers) {
        const uniqueSpeakers = Array.from(new Set(foundSpeakers));
        setSpeakers(uniqueSpeakers);
        setShowSpeakerForm(true);
      } else {
        setCustomizedTranscript(null);
        setShowSpeakerForm(false);
      }
    } else {
      setShowSpeakerForm(false);
      setSpeakers([]);
      setCustomizedTranscript(null);
    }
  }, [transcript]);

  useEffect(() => {
    if (showSpeakerForm) {
      setIsProcessing(false);
    }
  }, [showSpeakerForm]);

  const handleSpeakerSubmit = async (names) => {
    setIsProcessing(true);
    let newTranscript = transcript;
    Object.entries(names).forEach(([speaker, customName]) => {
      const escapedSpeaker = speaker.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedSpeaker, "g");
      newTranscript = newTranscript.replace(regex, customName + ":");
    });
    setCustomizedTranscript(newTranscript);
    setShowSpeakerForm(false);

    try {
      setIsSending(true);
      const response = await fetch("http://localhost:5002/api/save-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker_map: names,
          transcript: newTranscript,
          meeting_id: meetingId,
          user_id: userId,
          user_name: username,
        }),
      });
      setIsSending(false);
      if (response.ok) {
        onFetchMessages();
        setShowModal(false);
      } else {
        console.error("Failed to save transcript.");
      }
    } catch (error) {
      setIsSending(false);
      console.error("Error saving transcript:", error);
    }
    setIsProcessing(false);
  };

  const handleSpeakerCancel = () => {
    setCustomizedTranscript(null);
    setShowSpeakerForm(false);
  };

  return (
    <>
    <Modal isOpen={true} toggle={handleCloseAttempt} size="lg" centered style={{ zIndex: 1050, maxWidth: 900, width: "98%" }} backdrop="static" keyboard={false}>
      <ModalHeader toggle={handleCloseAttempt} style={{marginLeft: 18}}>
        Voice Meeting
      </ModalHeader>
      <ModalBody style={{ padding: "3rem 2.5rem", maxHeight: "90vh" }}>
        <Row className="mb-4" style={{ justifyContent: "center" }}>
          <Col xs="auto" className="d-flex gap-3">
            {!isRecording && (
              <Button
                color="primary"
                className="btn-lg font-size-16"
                onClick={startRecording}
              >
                <i className="ri-mic-fill me-2"></i>Start Meeting
              </Button>
            )}
            {isRecording && (
              <>
                <Button
                  color="warning"
                  className="btn-lg font-size-16"
                  onClick={pauseRecording}
                >
                  {isPaused ? <i className="ri-play-fill me-2"></i> : <i className="ri-pause-fill me-2"></i>}
                  {isPaused ? "Continue" : "Pause"}
                </Button>
                <Button
                  color="danger"
                  className="btn-lg font-size-16"
                  onClick={stopRecording}
                >
                  <i className="ri-stop-circle-fill me-2"></i>Finish
                </Button>
              </>
            )}
          </Col>
        </Row>
        {showSpeakerForm && (
          <Row>
            <Col>
              <SpeakerNameForm
                speakers={speakers}
                onSubmit={handleSpeakerSubmit}
                onCancel={handleSpeakerCancel}
                setIsProcessing={setIsProcessing}
                transcript={customizedTranscript || transcript}
                audioUrl={audioUrl}
              />
            </Col>
          </Row>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={handleCloseAttempt} className="btn-lg">
          Close
        </Button>
      </ModalFooter>
      {isProcessing && (
        <div style={{
          position: "fixed",
          zIndex: 2000,
          top: 0, left: 0, width: "100vw", height: "100vh",
          background: "rgba(255,255,255,0.75)",
          display: "flex", justifyContent: "center", alignItems: "center"
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <div className="spinner-border text-primary" style={{ width: 72, height: 72 }} />
            <div style={{ marginTop: 20, fontSize: 22, color: "#333", fontWeight: 600 }}>Processing...</div>
          </div>
        </div>
      )}
    </Modal>

    <VoiceModal
      isOpen={showCloseConfirm}
      toggle={() => setShowCloseConfirm(false)}
      title="Confirm Close"
      message="Closing will discard your current recording. Are you sure?"
      onConfirm={() => {
        setShowCloseConfirm(false);
        onClose();
      }}
    />
    </>
  );
}