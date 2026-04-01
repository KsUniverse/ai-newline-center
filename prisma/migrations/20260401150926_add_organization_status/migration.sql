-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE';
