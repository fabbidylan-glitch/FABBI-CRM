import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Dynamically rendered Apple touch icon. iOS applies its own rounded-corner
 * mask to touch icons, so we render the solid square + white "F" and let
 * the OS round it. The gradient matches the main SVG icon.
 */
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
          backgroundImage: "linear-gradient(135deg, #005bf7 0%, #123b96 100%)",
          color: "white",
          fontSize: 128,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        F
      </div>
    ),
    { ...size }
  );
}
