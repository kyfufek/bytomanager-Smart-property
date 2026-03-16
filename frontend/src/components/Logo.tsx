import { Building2 } from "lucide-react";

export function Logo({ showText = true }: { showText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
        <Building2 className="h-5 w-5 text-primary-foreground" />
      </div>
      {showText && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Bytomanager
        </span>
      )}
    </div>
  );
}
