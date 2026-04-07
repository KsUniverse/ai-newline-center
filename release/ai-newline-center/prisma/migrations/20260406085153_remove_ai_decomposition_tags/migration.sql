/*
  Warnings:

  - You are about to drop the `ai_decomposition_annotation_tags` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_decomposition_annotation_tags" DROP CONSTRAINT "ai_decomposition_annotation_tags_annotationId_fkey";

-- DropForeignKey
ALTER TABLE "ai_decomposition_annotation_tags" DROP CONSTRAINT "ai_decomposition_annotation_tags_organizationId_fkey";

-- DropTable
DROP TABLE "ai_decomposition_annotation_tags";
