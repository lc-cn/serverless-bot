export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center p-6 pt-10">
      <div className="w-full max-w-2xl space-y-6">{children}</div>
    </div>
  );
}
