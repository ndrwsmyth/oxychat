"use client";

interface RadiatingIndicatorProps {
  size?: number;
  className?: string;
}

/**
 * Radiating indicator with concentric circles animation.
 * Used to show thinking/processing state.
 */
export function RadiatingIndicator({
  size = 20,
  className = "",
}: RadiatingIndicatorProps) {
  return (
    <div
      className={`oxy-radiating-indicator ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Center dot */}
        <circle cx="20" cy="20" r="4" className="oxy-radiate-center" />

        {/* Radiating circles */}
        <circle
          cx="20"
          cy="20"
          r="8"
          className="oxy-radiate-ring oxy-radiate-ring-1"
        />
        <circle
          cx="20"
          cy="20"
          r="12"
          className="oxy-radiate-ring oxy-radiate-ring-2"
        />
        <circle
          cx="20"
          cy="20"
          r="16"
          className="oxy-radiate-ring oxy-radiate-ring-3"
        />
      </svg>
    </div>
  );
}
