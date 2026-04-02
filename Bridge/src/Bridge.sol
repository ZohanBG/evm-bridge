// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IWrappedToken} from "./interfaces/IWrappedToken.sol";
import {IBridgeEvents} from "./interfaces/IBridgeEvents.sol";
import {IBridgeErrors} from "./interfaces/IBridgeErrors.sol";
import {BridgeInternal} from "./libraries/BridgeInternal.sol";

/**
 * @title Bridge
 * @notice Multi-chain token bridge supporting N destination chains per deployment.
 *
 * Security properties:
 *  - Ownable2Step: ownership transfer requires explicit acceptance by the new owner
 *  - Multi-validator consensus: N-of-M threshold before a witness is accepted
 *  - Pausable + emergency withdrawal: owner can freeze and drain locked tokens
 *  - Rate limiting: per-user cooldown period
 *  - Slippage guard: users set maxFee to cap unexpected fee changes
 *  - Supply tracking: locked amounts are tracked per token
 *  - Checks-Effects-Interactions: state updated before all external calls
 */
contract Bridge is ReentrancyGuard, IBridgeEvents, IBridgeErrors {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum TxStatus { None, Submitted, Processed }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    // Transaction witness state machine
    mapping(bytes32 => TxStatus) public transactionStatuses;

    // Multi-validator consensus: votes per txHash
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    mapping(bytes32 => uint256) public voteCount;

    // Multi-chain token registry
    // lockRoutes[targetChainId][originalToken] = wrappedToken (used by lock)
    mapping(uint256 => mapping(address => address)) public lockRoutes;
    // burnRoutes[wrappedToken] = originalToken (used by burn)
    mapping(address => address) public burnRoutes;

    // Access control
    address public owner;
    address public pendingOwner;
    mapping(address => bool) public isValidator;
    uint256 public validatorCount;

    // Config
    uint256 public immutable CHAIN_ID;
    uint256 public feeBps;        // 0–1000 (0%–10%)
    uint256 public minFeeAmount;  // absolute floor for fee
    uint256 public requiredVotes; // threshold for witness submission
    uint256 public cooldownPeriod; // seconds between bridge ops per user

    // State tracking
    bool public paused;
    uint256 public globalNonce;
    mapping(address => uint256) public lastBridgeTime;
    mapping(address => uint256) public totalLocked; // locked original tokens per address

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    modifier onlyValidator() {
        if (!isValidator[msg.sender]) revert NotValidator(msg.sender);
        _;
    }

    modifier validAmount(uint256 amount) {
        if (amount == 0) revert InvalidAmount(amount, 1);
        _;
    }

    modifier validAddress(address addr) {
        if (addr == address(0)) revert InvalidTokenAddress(addr);
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert BridgePaused();
        _;
    }

    modifier respectsCooldown() {
        if (cooldownPeriod > 0) {
            uint256 elapsed = block.timestamp - lastBridgeTime[msg.sender];
            if (elapsed < cooldownPeriod) {
                revert CooldownNotElapsed(msg.sender, cooldownPeriod - elapsed);
            }
        }
        lastBridgeTime[msg.sender] = block.timestamp;
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _owner          Initial owner address.
     * @param _chainId        Chain ID of the network this bridge is deployed on.
     * @param _requiredVotes  Validator consensus threshold (e.g. 2 for 2-of-3).
     * @param _feeBps         Fee in basis points charged to the gasless relayer path.
     * @param _minFeeAmount   Absolute minimum fee in token units.
     */
    constructor(
        address _owner,
        uint256 _chainId,
        uint256 _requiredVotes,
        uint256 _feeBps,
        uint256 _minFeeAmount
    ) {
        if (_owner == address(0)) revert InvalidTokenAddress(_owner);
        if (_chainId == 0) revert InvalidChainId(_chainId);
        if (_feeBps > 1000) revert InvalidFee(_feeBps, 1000); // cap at 10%

        owner = _owner;
        CHAIN_ID = _chainId;
        requiredVotes = _requiredVotes == 0 ? 1 : _requiredVotes;
        feeBps = _feeBps;
        minFeeAmount = _minFeeAmount;
    }

    // -------------------------------------------------------------------------
    // Ownership (2-step)
    // -------------------------------------------------------------------------

    /**
     * @notice Initiates an ownership transfer. The new owner must call acceptOwnership().
     */
    function transferOwnership(address _newOwner) external onlyOwner validAddress(_newOwner) {
        pendingOwner = _newOwner;
        emit OwnershipTransferStarted(owner, _newOwner);
    }

    /**
     * @notice Completes ownership transfer. Must be called by the pending owner.
     */
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner(msg.sender);
        address previous = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, owner);
    }

    // -------------------------------------------------------------------------
    // Validator Management
    // -------------------------------------------------------------------------

    function addValidator(address _validator) external onlyOwner validAddress(_validator) {
        if (!isValidator[_validator]) {
            isValidator[_validator] = true;
            validatorCount++;
            emit ValidatorAdded(_validator);
        }
    }

    function removeValidator(address _validator) external onlyOwner validAddress(_validator) {
        if (isValidator[_validator]) {
            isValidator[_validator] = false;
            validatorCount--;
            emit ValidatorRemoved(_validator);
            // Keep requiredVotes within bounds
            if (validatorCount > 0 && requiredVotes > validatorCount) {
                emit RequiredVotesUpdated(requiredVotes, validatorCount);
                requiredVotes = validatorCount;
            }
        }
    }

    function setRequiredVotes(uint256 _required) external onlyOwner {
        if (_required == 0 || _required > validatorCount) {
            revert InvalidRequiredVotes(_required, validatorCount);
        }
        uint256 old = requiredVotes;
        requiredVotes = _required;
        emit RequiredVotesUpdated(old, _required);
    }

    // -------------------------------------------------------------------------
    // Fee / Config Management
    // -------------------------------------------------------------------------

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 1000) revert InvalidFee(_feeBps, 1000);
        feeBps = _feeBps;
        emit FeeBpsUpdated(_feeBps);
    }

    function setMinFeeAmount(uint256 _minFee) external onlyOwner {
        minFeeAmount = _minFee;
        emit MinFeeUpdated(_minFee);
    }

    function setCooldownPeriod(uint256 _cooldown) external onlyOwner {
        cooldownPeriod = _cooldown;
        emit CooldownUpdated(_cooldown);
    }

    // -------------------------------------------------------------------------
    // Token Registration
    // -------------------------------------------------------------------------

    /**
     * @notice Register the lock route: locking `originalToken` targeting `targetChainId`
     *         produces `wrappedToken` on the destination chain.
     */
    function registerLockRoute(
        uint256 targetChainId,
        address originalToken,
        address wrappedToken
    ) external onlyOwner validAddress(originalToken) validAddress(wrappedToken) {
        if (targetChainId == CHAIN_ID) revert SameChainId(targetChainId);
        lockRoutes[targetChainId][originalToken] = wrappedToken;
        emit WrappedTokenRegistered(originalToken, wrappedToken, CHAIN_ID, targetChainId);
    }

    /**
     * @notice Register the burn route: burning `wrappedToken` on this chain unlocks
     *         `originalToken` on the source chain.
     */
    function registerBurnRoute(
        address wrappedToken,
        address originalToken
    ) external onlyOwner validAddress(wrappedToken) validAddress(originalToken) {
        burnRoutes[wrappedToken] = originalToken;
    }

    // -------------------------------------------------------------------------
    // Pause / Emergency
    // -------------------------------------------------------------------------

    function pause() external onlyOwner {
        paused = true;
        emit BridgePausedEvent();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit BridgeUnpausedEvent();
    }

    /**
     * @notice Allows owner to withdraw locked tokens when bridge is paused.
     *         This provides an emergency exit for user funds.
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner validAddress(token) validAddress(to) {
        if (!paused) revert BridgeNotPaused();
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdrawal(token, to, amount);
    }

    // -------------------------------------------------------------------------
    // Validator: submitWitness (N-of-M consensus)
    // -------------------------------------------------------------------------

    /**
     * @notice Validator casts a vote for a cross-chain transaction hash.
     *         Once `requiredVotes` threshold is reached, status becomes Submitted.
     */
    function submitWitness(bytes32 txHash) external onlyValidator {
        if (transactionStatuses[txHash] == TxStatus.Processed) {
            revert TransactionAlreadyProcessed(txHash);
        }
        if (transactionStatuses[txHash] == TxStatus.Submitted) {
            revert TransactionAlreadySubmitted(txHash);
        }
        if (hasVoted[txHash][msg.sender]) revert AlreadyVoted(txHash, msg.sender);

        // Effects before any state reads that could influence re-entrancy
        hasVoted[txHash][msg.sender] = true;
        uint256 votes = voteCount[txHash] + 1;
        voteCount[txHash] = votes;

        emit ValidatorVoted(txHash, msg.sender, votes);

        if (votes >= requiredVotes) {
            transactionStatuses[txHash] = TxStatus.Submitted;
            emit WitnessSubmitted(txHash);
        }
    }

    // -------------------------------------------------------------------------
    // Lock — source chain
    // -------------------------------------------------------------------------

    /**
     * @notice Lock original tokens on this chain to bridge them to `targetChainId`.
     * @param token         Original ERC-20 token to lock.
     * @param targetChainId Destination chain ID.
     * @param amount        Amount to bridge (fee will be deducted from this).
     * @param maxFee        Maximum acceptable fee (slippage guard). Use 0 to skip check.
     * @return txHash       The witness hash validators must submit on the destination chain.
     */
    function lock(
        address token,
        uint256 targetChainId,
        uint256 amount,
        uint256 maxFee
    )
        external
        nonReentrant
        whenNotPaused
        validAddress(token)
        validAmount(amount)
        respectsCooldown
        returns (bytes32 txHash)
    {
        if (targetChainId == CHAIN_ID) revert SameChainId(targetChainId);

        address wrappedToken = lockRoutes[targetChainId][token];
        if (wrappedToken == address(0)) revert WrappedTokenNotRegistered(token, targetChainId);

        // Interactions last — but safeTransferFrom must come before we compute the txHash
        // because the txHash depends on the amount (which is user-supplied and validated above).
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Effects
        totalLocked[token] += amount;

        (uint256 fee, bytes32 calculatedTxHash) = BridgeInternal.prepareBridgeTx(
            wrappedToken,
            msg.sender,
            amount,
            feeBps,
            minFeeAmount,
            maxFee,
            CHAIN_ID,
            targetChainId,
            globalNonce
        );

        emit TokenLocked(token, msg.sender, amount, fee, targetChainId, CHAIN_ID, globalNonce, calculatedTxHash);
        globalNonce++;
        return calculatedTxHash;
    }

    // -------------------------------------------------------------------------
    // Claim — destination chain
    // -------------------------------------------------------------------------

    /**
     * @notice Claim wrapped tokens after a lock has been witnessed on this chain.
     * @param wrappedToken  Wrapped token address on this chain.
     * @param to            Recipient of (amount - fee).
     * @param amount        Exact amount from the original lock event.
     * @param fee           Exact fee from the original lock event.
     * @param sourceChainId Chain ID where the lock occurred.
     * @param nonce         Nonce from the original lock event.
     */
    function claim(
        address wrappedToken,
        address to,
        uint256 amount,
        uint256 fee,
        uint256 sourceChainId,
        uint256 nonce
    )
        external
        nonReentrant
        whenNotPaused
        validAddress(wrappedToken)
        validAmount(amount)
    {
        if (to == address(0)) revert InvalidRecipient(to);
        if (sourceChainId == CHAIN_ID) revert SameChainId(sourceChainId);

        bytes32 txHash = keccak256(
            abi.encodePacked(wrappedToken, to, amount, fee, sourceChainId, nonce, CHAIN_ID)
        );

        // Effects first
        if (transactionStatuses[txHash] != TxStatus.Submitted) revert TransactionNotSubmitted(txHash);
        transactionStatuses[txHash] = TxStatus.Processed;

        // Interaction last
        BridgeInternal.processClaimOrRelease(wrappedToken, to, amount, fee, true, msg.sender);
        emit TokenClaimed(wrappedToken, to, amount, fee, msg.sender, sourceChainId, CHAIN_ID, txHash);
    }

    // -------------------------------------------------------------------------
    // Burn — destination chain
    // -------------------------------------------------------------------------

    /**
     * @notice Burn wrapped tokens on this chain to bridge them back to `targetChainId`.
     * @param wrappedToken  Wrapped token to burn.
     * @param targetChainId Chain ID to release original tokens on.
     * @param amount        Amount to bridge back.
     * @param maxFee        Maximum acceptable fee (slippage guard). Use 0 to skip check.
     * @return txHash       The witness hash validators must submit on the source chain.
     */
    function burn(
        address wrappedToken,
        uint256 targetChainId,
        uint256 amount,
        uint256 maxFee
    )
        external
        nonReentrant
        whenNotPaused
        validAddress(wrappedToken)
        validAmount(amount)
        respectsCooldown
        returns (bytes32 txHash)
    {
        if (targetChainId == CHAIN_ID) revert SameChainId(targetChainId);

        address originalToken = burnRoutes[wrappedToken];
        if (originalToken == address(0)) revert WrappedTokenNotRegistered(wrappedToken, targetChainId);

        // Burn before computing fee — CEI pattern
        IWrappedToken(wrappedToken).burnFrom(msg.sender, amount);

        (uint256 fee, bytes32 calculatedTxHash) = BridgeInternal.prepareBridgeTx(
            originalToken,
            msg.sender,
            amount,
            feeBps,
            minFeeAmount,
            maxFee,
            CHAIN_ID,
            targetChainId,
            globalNonce
        );

        emit TokenBurned(wrappedToken, msg.sender, amount, fee, targetChainId, CHAIN_ID, globalNonce, calculatedTxHash);
        globalNonce++;
        return calculatedTxHash;
    }

    // -------------------------------------------------------------------------
    // Release — source chain
    // -------------------------------------------------------------------------

    /**
     * @notice Release original tokens after a burn has been witnessed on this chain.
     * @param token         Original token to release.
     * @param to            Recipient of (amount - fee).
     * @param amount        Exact amount from the original burn event.
     * @param fee           Exact fee from the original burn event.
     * @param sourceChainId Chain ID where the burn occurred.
     * @param nonce         Nonce from the original burn event.
     */
    function release(
        address token,
        address to,
        uint256 amount,
        uint256 fee,
        uint256 sourceChainId,
        uint256 nonce
    )
        external
        nonReentrant
        whenNotPaused
        validAddress(token)
        validAmount(amount)
    {
        if (to == address(0)) revert InvalidRecipient(to);
        if (sourceChainId == CHAIN_ID) revert SameChainId(sourceChainId);

        bytes32 txHash = keccak256(
            abi.encodePacked(token, to, amount, fee, sourceChainId, nonce, CHAIN_ID)
        );

        // Effects first
        if (transactionStatuses[txHash] != TxStatus.Submitted) revert TransactionNotSubmitted(txHash);
        transactionStatuses[txHash] = TxStatus.Processed;
        if (totalLocked[token] >= amount) {
            totalLocked[token] -= amount; // full amount leaves the bridge (fee + recipient share)
        }

        // Interaction last
        BridgeInternal.processClaimOrRelease(token, to, amount, fee, false, msg.sender);
        emit TokenReleased(token, to, amount, fee, msg.sender, sourceChainId, CHAIN_ID, txHash);
    }
}
