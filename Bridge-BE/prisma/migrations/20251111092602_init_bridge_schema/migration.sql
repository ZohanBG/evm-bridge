-- CreateEnum
CREATE TYPE "BridgeEventType" AS ENUM ('TOKEN_LOCKED', 'TOKEN_CLAIMED', 'TOKEN_BURNED', 'TOKEN_RELEASED');

-- CreateTable
CREATE TABLE "bridge_events" (
    "id" TEXT NOT NULL,
    "eventType" "BridgeEventType" NOT NULL,
    "chainId" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "transactionHash" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "relayerAddress" TEXT,
    "amount" TEXT NOT NULL,
    "fee" TEXT,
    "nonce" BIGINT,
    "targetChainId" INTEGER,
    "sourceChainId" INTEGER,
    "is_processed" BOOLEAN NOT NULL DEFAULT false,
    "blockTimestamp" TIMESTAMP(3) NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txHash" TEXT NOT NULL,
    "gasUsed" BIGINT,
    "gasPrice" TEXT,

    CONSTRAINT "bridge_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexer_checkpoints" (
    "chainId" INTEGER NOT NULL,
    "last_processed_block" BIGINT NOT NULL DEFAULT 0,
    "last_processed_log_index" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,

    CONSTRAINT "indexer_checkpoints_pkey" PRIMARY KEY ("chainId")
);

-- CreateTable
CREATE TABLE "witness_submissions" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceChainId" INTEGER NOT NULL,
    "targetChainId" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedTxHash" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "witness_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bridge_events_chainId_blockNumber_logIndex_idx" ON "bridge_events"("chainId", "blockNumber", "logIndex");

-- CreateIndex
CREATE INDEX "bridge_events_eventType_is_processed_idx" ON "bridge_events"("eventType", "is_processed");

-- CreateIndex
CREATE INDEX "bridge_events_fromAddress_idx" ON "bridge_events"("fromAddress");

-- CreateIndex
CREATE INDEX "bridge_events_toAddress_idx" ON "bridge_events"("toAddress");

-- CreateIndex
CREATE INDEX "bridge_events_txHash_idx" ON "bridge_events"("txHash");

-- CreateIndex
CREATE INDEX "bridge_events_tokenAddress_idx" ON "bridge_events"("tokenAddress");

-- CreateIndex
CREATE INDEX "bridge_events_blockTimestamp_idx" ON "bridge_events"("blockTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "bridge_events_transactionHash_logIndex_chainId_key" ON "bridge_events"("transactionHash", "logIndex", "chainId");

-- CreateIndex
CREATE UNIQUE INDEX "witness_submissions_txHash_key" ON "witness_submissions"("txHash");

-- CreateIndex
CREATE INDEX "witness_submissions_sourceChainId_targetChainId_idx" ON "witness_submissions"("sourceChainId", "targetChainId");

-- CreateIndex
CREATE INDEX "witness_submissions_confirmed_idx" ON "witness_submissions"("confirmed");
