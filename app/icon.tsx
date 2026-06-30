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
          background: "linear-gradient(135deg, #f3da8b, #d9b75a 45%, #a87c24)",
          color: "#1a1206",
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
