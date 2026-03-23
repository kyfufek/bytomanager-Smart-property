import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
