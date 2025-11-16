-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "table" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "group" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);
