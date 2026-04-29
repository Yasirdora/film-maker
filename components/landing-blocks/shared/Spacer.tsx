export type SpacerSize = "R06" | "R07" | "R08" | "R10" | "R12" | "R14" | "R16" | "R17";

const sizeClasses: Record<SpacerSize, string> = {
  R06: "spacer size-R06",
  R07: "spacer size-R07",
  R08: "spacer size-R08",
  R10: "spacer size-R10",
  R12: "spacer size-R12",
  R14: "spacer size-R14",
  R16: "spacer size-R16",
  R17: "spacer size-R17",
};

export default function Spacer({ size }: { size: SpacerSize }) {
  return (
    <div
      className={sizeClasses[size]}
      role="separator"
      aria-hidden="true"
    />
  );
}
