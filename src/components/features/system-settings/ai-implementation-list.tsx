"use client";

import type { AiImplementationDTO } from "@/types/ai-config";
import { Badge } from "@/components/ui/badge";

interface AiImplementationListProps {
  implementations: AiImplementationDTO[];
}

export function AiImplementationList({ implementations }: AiImplementationListProps) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm">
      <div className="space-y-1.5">
        <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">
          Implementations
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-foreground/95">可用实现方式</h2>
        <p className="text-sm leading-6 text-muted-foreground/80">
          页面只展示实现名称、支持步骤与可用状态，不展示任何敏感密钥。
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {implementations.map((implementation) => {
          const missingKeys = implementation.missingEnvKeys ?? implementation.requiredEnvKeys ?? [];
          return (
            <article
              key={implementation.key}
              className="rounded-2xl border border-border/60 bg-background/80 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium text-foreground/95">{implementation.name}</h3>
                <Badge variant={implementation.available ? "secondary" : "outline"} className="text-2xs">
                  {implementation.available ? "可用" : "未就绪"}
                </Badge>
              </div>
              {implementation.provider ? (
                <p className="mt-2 text-sm text-muted-foreground/80">{implementation.provider}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {implementation.supportedSteps.map((step) => (
                  <Badge key={step} variant="secondary" className="text-2xs">
                    {step}
                  </Badge>
                ))}
              </div>
              {!implementation.available && missingKeys.length > 0 ? (
                <p className="mt-3 text-xs leading-5 text-muted-foreground/75">
                  缺少环境变量：{missingKeys.join("、")}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
