import { ImageResponse } from "next/og";

// Favicon gerado: "Z" dourado da marca Zefer em um quadrado arredondado.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#10352A",
          color: "#C9A84C",
          fontSize: 46,
          fontWeight: 800,
          borderRadius: 14,
        }}
      >
        Z
      </div>
    ),
    size,
  );
}
