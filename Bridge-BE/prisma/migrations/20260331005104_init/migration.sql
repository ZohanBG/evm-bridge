-- CreateIndex
CREATE INDEX "bridge_events_eventType_is_processed_chainId_idx" ON "bridge_events"("eventType", "is_processed", "chainId");
