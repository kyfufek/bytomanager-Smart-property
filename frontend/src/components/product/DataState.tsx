import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DataStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "empty" | "error";
};

export function DataState({
  title,
  description,
  actionLabel,
  onAction,
  variant = "empty",
}: DataStateProps) {
  const Icon = variant === "error" ? AlertCircle : Inbox;

  return (
    <Card className="card-shadow border-dashed">
      <CardContent className="p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Icon className={`h-5 w-5 ${variant === "error" ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {actionLabel && onAction ? (
          <Button variant={variant === "error" ? "outline" : "cta"} size="sm" className="mt-4" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
