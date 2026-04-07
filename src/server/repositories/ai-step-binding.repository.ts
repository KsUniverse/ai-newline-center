import type { AiStepBinding, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { AiStep } from "@/types/ai-config";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const defaultSteps: AiStep[] = ["TRANSCRIBE", "DECOMPOSE", "REWRITE"];

class AiStepBindingRepository {
  private async runTransaction<T>(
    db: DatabaseClient,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if ("$transaction" in db) {
      return db.$transaction(action);
    }

    return action(db);
  }

  async findAll(db: DatabaseClient = prisma): Promise<AiStepBinding[]> {
    return db.aiStepBinding.findMany({
      orderBy: { step: "asc" },
    });
  }

  async findByStep(step: AiStep, db: DatabaseClient = prisma): Promise<AiStepBinding | null> {
    return db.aiStepBinding.findUnique({ where: { step } });
  }

  async replaceAll(
    bindings: Array<{ step: AiStep; modelConfigId: string | null }>,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await this.runTransaction(db, async (tx: Prisma.TransactionClient) => {
      await tx.aiStepBinding.deleteMany({});
      await tx.aiStepBinding.createMany({
        data: bindings.map((binding) => ({
          step: binding.step,
          modelConfigId: binding.modelConfigId,
        })),
      });
    });
  }

  async ensureDefaults(db: DatabaseClient = prisma): Promise<void> {
    const existing = await this.findAll(db);
    const missingSteps = defaultSteps.filter(
      (step) => !existing.some((binding) => binding.step === step),
    );

    if (missingSteps.length === 0) return;

    await db.aiStepBinding.createMany({
      data: missingSteps.map((step) => ({
        step,
        modelConfigId: null,
      })),
      skipDuplicates: true,
    });
  }
}

export const aiStepBindingRepository = new AiStepBindingRepository();
