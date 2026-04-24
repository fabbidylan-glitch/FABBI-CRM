import { IntakeShell } from "./intake-chrome";

// Route-segment layout for every /intake/* page. Wraps them in the branded
// fabbi.co-matching chrome so the public intake flow reads as one continuous
// experience with the marketing site. Dashboard routes (outside /intake)
// keep their current CRM styling.
export default function IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <IntakeShell>{children}</IntakeShell>;
}
