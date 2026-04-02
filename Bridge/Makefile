.PHONY: all clean reset \
        anvil-a anvil-b anvil-c anvil-all \
        deploy-a deploy-b deploy-c \
        setup-cross-chain \
        deploy-local-all \
        deploy-testnet-a deploy-testnet-b deploy-testnet-c setup-cross-chain-testnet \
        test snapshot

# ============================================================
#  Configuration
# ============================================================

CHAIN_A_PORT  ?= 8545
CHAIN_B_PORT  ?= 8546
CHAIN_C_PORT  ?= 8547
CHAIN_A_ID    ?= 31337
CHAIN_B_ID    ?= 31338
CHAIN_C_ID    ?= 31339

RPC_A         := http://127.0.0.1:$(CHAIN_A_PORT)
RPC_B         := http://127.0.0.1:$(CHAIN_B_PORT)
RPC_C         := http://127.0.0.1:$(CHAIN_C_PORT)

# File where deploy-local-all writes addresses so subsequent steps can read them
ADDR_FILE     := .deploy-addresses

# ============================================================
#  Local Anvil management
# ============================================================

anvil-a:
	@echo ">> Starting Chain A  (chainId $(CHAIN_A_ID), port $(CHAIN_A_PORT))"
	anvil --chain-id $(CHAIN_A_ID) --port $(CHAIN_A_PORT) &

anvil-b:
	@echo ">> Starting Chain B  (chainId $(CHAIN_B_ID), port $(CHAIN_B_PORT))"
	anvil --chain-id $(CHAIN_B_ID) --port $(CHAIN_B_PORT) &

anvil-c:
	@echo ">> Starting Chain C  (chainId $(CHAIN_C_ID), port $(CHAIN_C_PORT))"
	anvil --chain-id $(CHAIN_C_ID) --port $(CHAIN_C_PORT) &

anvil-all:
	@$(MAKE) anvil-a
	@$(MAKE) anvil-b
	@$(MAKE) anvil-c
	@echo ">> Waiting for all chains to initialise..."
	@sleep 2

# ============================================================
#  Individual deployment targets (manual, step-by-step)
# ============================================================

deploy-a:
	@echo ">> Deploying to Chain A ($(RPC_A))"
	forge script script/DeployChainA.s.sol \
		--rpc-url $(RPC_A) \
		--broadcast \
		--slow

deploy-b:
	@echo ">> Deploying to Chain B ($(RPC_B))"
	@echo "   Requires GENERIC_TOKEN_A in .env"
	forge script script/DeployChainB.s.sol \
		--rpc-url $(RPC_B) \
		--broadcast \
		--slow

deploy-c:
	@echo ">> Deploying to Chain C ($(RPC_C))"
	@echo "   Requires GENERIC_TOKEN_A in .env"
	forge script script/DeployChainC.s.sol \
		--rpc-url $(RPC_C) \
		--broadcast \
		--slow

setup-cross-chain:
	@echo ">> Configuring triangle lock routes on Bridge A"
	@echo "   Requires BRIDGE_A, GENERIC_TOKEN_A, WRAPPED_TOKEN_B, WRAPPED_TOKEN_C in .env"
	forge script script/SetupCrossChain.s.sol \
		--rpc-url $(RPC_A) \
		--broadcast \
		--slow

# ============================================================
#  One-command fully-automated local deployment
#
#  This target:
#    1. Starts all 3 Anvil chains
#    2. Deploys Chain A, captures Bridge_A and Token addresses
#    3. Deploys Chain B and C (passing Token address)
#    4. Configures the triangle cross-chain routes
#    5. Writes all addresses to $(ADDR_FILE) and .env.local
# ============================================================

deploy-local-all:
	@echo ""
	@echo "╔══════════════════════════════════════════════════╗"
	@echo "║      Bridge — Full 3-Chain Local Deployment      ║"
	@echo "╚══════════════════════════════════════════════════╝"
	@echo ""

	@# 1. Start chains
	@$(MAKE) anvil-all

	@# 2. Deploy Chain A and capture addresses from forge log output
	@echo ">> [1/4] Deploying Chain A..."
	@forge script script/DeployChainA.s.sol \
		--rpc-url $(RPC_A) --broadcast --slow 2>&1 \
		| tr -d '\r' | tee /tmp/deploy_a.log; \
		BRIDGE_A=$$(grep "Bridge_A" /tmp/deploy_a.log | grep -o '0x[0-9a-fA-F]\{40\}' | head -1); \
		TOKEN_A=$$(grep "GenericToken" /tmp/deploy_a.log | grep -o '0x[0-9a-fA-F]\{40\}' | head -1); \
		echo "BRIDGE_A=$$BRIDGE_A" > $(ADDR_FILE); \
		echo "GENERIC_TOKEN_A=$$TOKEN_A" >> $(ADDR_FILE)

	@echo "   Chain A addresses:"
	@cat $(ADDR_FILE)

	@# 3. Deploy Chain B
	@echo ">> [2/4] Deploying Chain B..."
	@export $$(cat $(ADDR_FILE) | xargs) && \
		forge script script/DeployChainB.s.sol \
			--rpc-url $(RPC_B) --broadcast --slow 2>&1 \
			| tr -d '\r' | tee /tmp/deploy_b.log; \
		BRIDGE_B=$$(grep "Bridge_B" /tmp/deploy_b.log | grep -o '0x[0-9a-fA-F]\{40\}' | head -1); \
		WRAPPED_B=$$(grep "WrappedToken" /tmp/deploy_b.log | grep -o '0x[0-9a-fA-F]\{40\}' | head -1); \
		echo "BRIDGE_B=$$BRIDGE_B" >> $(ADDR_FILE); \
		echo "WRAPPED_TOKEN_B=$$WRAPPED_B" >> $(ADDR_FILE)

	@# 4. Deploy Chain C
	@echo ">> [3/4] Deploying Chain C..."
	@export $$(cat $(ADDR_FILE) | xargs) && \
		forge script script/DeployChainC.s.sol \
			--rpc-url $(RPC_C) --broadcast --slow 2>&1 \
			| tr -d '\r' | tee /tmp/deploy_c.log; \
		BRIDGE_C=$$(grep "Bridge_C" /tmp/deploy_c.log | grep -o '0x[0-9a-fA-F]\{40\}' | head -1); \
		WRAPPED_C=$$(grep "WrappedToken" /tmp/deploy_c.log | grep -o '0x[0-9a-fA-F]\{40\}' | head -1); \
		echo "BRIDGE_C=$$BRIDGE_C" >> $(ADDR_FILE); \
		echo "WRAPPED_TOKEN_C=$$WRAPPED_C" >> $(ADDR_FILE)

	@# 5. Cross-chain setup
	@echo ">> [4/4] Configuring triangle cross-chain routes..."
	@export $$(cat $(ADDR_FILE) | xargs) && \
		forge script script/SetupCrossChain.s.sol \
			--rpc-url $(RPC_A) --broadcast --slow

	@# 6. Write final .env.local for the frontend
	@cp $(ADDR_FILE) ../.env.bridge-addresses
	@echo ""
	@echo "╔══════════════════════════════════════════════════╗"
	@echo "║        Deployment complete!                      ║"
	@echo "╚══════════════════════════════════════════════════╝"
	@echo ""
	@cat $(ADDR_FILE)
	@echo ""
	@echo "All addresses saved to: $(ADDR_FILE)"
	@echo "Copy them to bridge-be/.env and bridge-fe/.env.local"

# ============================================================
#  Public testnet deployment
# ============================================================

deploy-testnet-a:
	@echo ">> Deploying Chain A to testnet ($$CHAIN_A_RPC_URL)"
	forge script script/DeployChainA.s.sol \
		--rpc-url $$CHAIN_A_RPC_URL \
		--broadcast --verify \
		--etherscan-api-key $$CHAIN_A_ETHERSCAN_KEY \
		--chain $$CHAIN_A_ID \
		--slow

deploy-testnet-b:
	@echo ">> Deploying Chain B to testnet ($$CHAIN_B_RPC_URL)"
	forge script script/DeployChainB.s.sol \
		--rpc-url $$CHAIN_B_RPC_URL \
		--broadcast --verify \
		--etherscan-api-key $$CHAIN_B_ETHERSCAN_KEY \
		--chain $$CHAIN_B_ID \
		--slow

deploy-testnet-c:
	@echo ">> Deploying Chain C to testnet ($$CHAIN_C_RPC_URL)"
	forge script script/DeployChainC.s.sol \
		--rpc-url $$CHAIN_C_RPC_URL \
		--broadcast --verify \
		--etherscan-api-key $$CHAIN_C_ETHERSCAN_KEY \
		--chain $$CHAIN_C_ID \
		--slow

setup-cross-chain-testnet:
	forge script script/SetupCrossChain.s.sol \
		--rpc-url $$CHAIN_A_RPC_URL \
		--broadcast \
		--chain $$CHAIN_A_ID \
		--slow

# ============================================================
#  Testing & utilities
# ============================================================

test:
	forge test -vv

snapshot:
	forge snapshot

clean:
	@echo ">> Stopping all Anvil instances..."
	-pkill -f "anvil --chain-id" 2>/dev/null || true
	@rm -f $(ADDR_FILE)
	forge clean

# Stop chains, wipe address file, then do a fresh full deployment
reset: clean
	@echo ">> Waiting for processes to die..."
	@sleep 2
	@$(MAKE) deploy-local-all
