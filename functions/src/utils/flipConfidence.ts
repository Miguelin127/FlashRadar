export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export function getConfidenceLevel(confidence: number): {
  level: ConfidenceLevel;
  label: string;
  color: string;
} {
  if (confidence >= 80) {
    return {
      level: "HIGH",
      label: "High Confidence",
      color: "#00C853",
    };
  }

  if (confidence >= 55) {
    return {
      level: "MEDIUM",
      label: "Medium Confidence",
      color: "#FFB300",
    };
  }

  return {
    level: "LOW",
    label: "Low Confidence",
    color: "#D32F2F",
  };
}
