import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5BD14",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#131318" strokeWidth="2" />
          <circle cx="12" cy="12" r="5.5" stroke="#131318" strokeWidth="2" />
          <circle cx="12" cy="12" r="1.6" fill="#131318" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
