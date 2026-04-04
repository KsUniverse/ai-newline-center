import type {
  Prisma,
  PrismaClient,
  Transcription,
  TranscriptionStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type TranscriptionWithOrg = Prisma.TranscriptionGetPayload<{
  include: {
    video: {
      include: {
        account: true;
      };
    };
  };
}>;

export interface CreateTranscriptionData {
  videoId: string;
  aiModel: string;
}

export interface UpdateTranscriptionStatusData {
  status: TranscriptionStatus;
  originalText?: string;
  errorMessage?: string | null;
}

class TranscriptionRepository {
  async findByVideoId(
    videoId: string,
    db: DatabaseClient = prisma,
  ): Promise<TranscriptionWithOrg | null> {
    return db.transcription.findUnique({
      where: { videoId },
      include: {
        video: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  async findById(id: string, db: DatabaseClient = prisma): Promise<TranscriptionWithOrg | null> {
    return db.transcription.findUnique({
      where: { id },
      include: {
        video: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  async create(
    data: CreateTranscriptionData,
    db: DatabaseClient = prisma,
  ): Promise<Transcription> {
    return db.transcription.create({
      data,
    });
  }

  async updateStatus(
    id: string,
    data: UpdateTranscriptionStatusData,
    db: DatabaseClient = prisma,
  ): Promise<Transcription> {
    return db.transcription.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.originalText !== undefined ? { originalText: data.originalText } : {}),
        ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
      },
    });
  }

  async updateEditedText(
    id: string,
    editedText: string | null,
    db: DatabaseClient = prisma,
  ): Promise<Transcription> {
    return db.transcription.update({
      where: { id },
      data: { editedText },
    });
  }

  async reset(id: string, aiModel: string, db: DatabaseClient = prisma): Promise<Transcription> {
    return db.transcription.update({
      where: { id },
      data: {
        status: "PENDING",
        aiModel,
        originalText: null,
        editedText: null,
        errorMessage: null,
      },
    });
  }
}

export const transcriptionRepository = new TranscriptionRepository();
