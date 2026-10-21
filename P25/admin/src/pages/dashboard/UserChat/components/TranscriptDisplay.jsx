import React from "react";

const COLORS = [
  "#E57373", // Speaker 1  Red
  "#64B5F6", // Speaker 2  Blue
  "#81C784", // Speaker 3  Green
  "#FFD54F", // Speaker 4  Yellow
  "#BA68C8", // Speaker 5  Purple
];

export default function TranscriptDisplay({ transcript }) {
  if (!transcript) return null;

  const lines = transcript.split("\n").filter(Boolean);

  return (
    <div style={{
      padding: 24,
      background: "#fafbfc",
      borderRadius: 8,
      fontFamily: "monospace",
      maxHeight: 350,
      overflowY: "auto"
    }}>
      {lines.map((line, i) => {
        const match = line.match(/^Speaker (\d+): (.*)$/);
        if (match) {
          const speaker = parseInt(match[1], 10);
          const text = match[2];
          return (
            <div key={i} style={{
              marginBottom: 8,
              color: "#222"
            }}>
              <span style={{ color: COLORS[(speaker - 1) % COLORS.length], fontWeight: "bold" }}>{`Speaker ${speaker}: `}</span>
              <span style={{ fontWeight: "normal", color: "#222" }}>{text}</span>
            </div>
          );
        }
        return (
          <div key={i} style={{ color: "#222" }}>
            {line}
          </div>
        );
      })}
    </div>
  );
}