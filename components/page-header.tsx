import * as React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Slot ao lado do título (ex.: botão de ajuda/onboarding). */
  help?: React.ReactNode;
  children?: React.ReactNode;
}

/** Cabeçalho padrão das páginas: título, descrição e ações à direita. */
export function PageHeader({ title, description, help, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {help}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
