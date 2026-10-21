import React, { useState } from "react";
import { Card, CardBody, Button, Input, Row, Col } from "reactstrap";
import TranscriptDisplay from "./TranscriptDisplay";

export default function SpeakerNameForm({ speakers, onSubmit, onCancel, setIsProcessing, transcript, audioUrl }) {
  const [names, setNames] = useState(
    Object.fromEntries(speakers.map(s => [s, ""]))
  );

  const handleChange = (speaker, value) => {
    setNames(prev => ({ ...prev, [speaker]: value }));
  };

  const handleSubmit = () => {
    setIsProcessing && setIsProcessing(true);
    onSubmit(names);
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      background: "rgba(0,0,0,0.18)", zIndex: 1200,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <Card style={{ width: "98%", maxWidth: 1200, borderRadius: 8, boxShadow: "0 2px 18px #ddd", maxHeight: "96vh", overflow: "auto" }}>
        <CardBody style={{ padding: "3rem 2.5rem" }}>
          <Row>

            {/* Left Col: Audio and transcript */}
            <Col md={7} xs={12} className="d-flex flex-column align-items-center justify-content-center">
              {/* <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center" }}> */}
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <h5 className="mb-3" style={{ textAlign: "center" }}>Meeting Recording</h5>
                {audioUrl && (
                  <div style={{ width: "100%", margin: "0 0 24px 0", display: "flex", alignItems: "center" }}>
                    <audio controls src={audioUrl} style={{ width: "100%", minWidth: 320, maxWidth: 600 }} />
                    <a
                      href={audioUrl}
                      download="recording.webm"
                      style={{ marginLeft: 16, fontSize: 30, color: "#007bff" }}
                      title="Download Recording"
                    >
                      <i className="ri-arrow-down-circle-line"></i>
                    </a>
                  </div>
                )}
                {transcript && (
                  <div style={{ width: "100%" }}>
                    <h5 className="mb-3" style={{ textAlign: "center" }}>Transcript Preview</h5>
                    <TranscriptDisplay transcript={transcript} />
                  </div>
                )}
              </div>
            </Col>

            {/* Right Col: Speaker name input and confirm */}
            <Col md={5} xs={12} className="d-flex flex-column justify-content-center align-items-center">
              <div style={{ width: "100%" }}>
                <h5 className="mb-4" style={{ fontWeight: 700, textAlign: "center" }}>Please Enter Names for Speakers</h5>
                <div style={{ marginBottom: 18, width: "100%" }}>
                  {speakers.map(spk => (
                    <Row className="align-items-center mb-2 justify-content-center" key={spk}>
                      <Col xs="auto" className="p-0">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: 18, minWidth: 60 }}>{spk}</span>
                          <Input
                            type="text"
                            value={names[spk]}
                            required
                            onChange={e => handleChange(spk, e.target.value)}
                            className="form-control form-control-lg bg-light border-light rounded-3 ms-2"
                            style={{ width: 160, minWidth: 80, maxWidth: 200, display: "inline-block" }}
                            placeholder="Enter name"
                          />
                        </div>
                      </Col>
                    </Row>
                  ))}
                </div>
                <Row className="justify-content-center">
                  <Col xs="auto">
                    <Button color="primary" size="lg" className="me-2" onClick={handleSubmit}>Confirm</Button>
                    {/* <Button color="secondary" size="lg" onClick={onCancel}>Cancel</Button> */}
                  </Col>
                </Row>
              </div>
            </Col>

          </Row>
        </CardBody>
      </Card>
    </div>
  );
}