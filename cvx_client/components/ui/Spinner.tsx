"use client";

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`spinner${size === "lg" ? " spinner-lg" : ""}`} />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <Spinner size="lg" />
    </div>
  );
}
