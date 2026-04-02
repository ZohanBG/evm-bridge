// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IBridgeEvents
 * @dev Events for the Bridge contract.
 */
interface IBridgeEvents {
    // --- Core Bridge Events ---

    event TokenLocked(
        address indexed token,
        address indexed from,
        uint256 amount,
        uint256 fee,
        uint256 indexed targetChainId,
        uint256 sourceChainId,
        uint256 nonce,
        bytes32 txHash
    );

    event TokenClaimed(
        address indexed wrappedToken,
        address indexed to,
        uint256 amount,
        uint256 fee,
        address relayer,
        uint256 sourceChainId,
        uint256 targetChainId,
        bytes32 indexed txHash
    );

    event TokenBurned(
        address indexed wrappedToken,
        address indexed from,
        uint256 amount,
        uint256 fee,
        uint256 indexed targetChainId,
        uint256 sourceChainId,
        uint256 nonce,
        bytes32 txHash
    );

    event TokenReleased(
        address indexed token,
        address indexed to,
        uint256 amount,
        uint256 fee,
        address relayer,
        uint256 sourceChainId,
        uint256 targetChainId,
        bytes32 indexed txHash
    );

    // --- Registry Events ---

    event WrappedTokenRegistered(
        address indexed originalToken,
        address indexed wrappedToken,
        uint256 sourceChainId,
        uint256 indexed targetChainId
    );

    // --- Validator Events ---

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event ValidatorVoted(bytes32 indexed txHash, address indexed validator, uint256 voteCount);
    event WitnessSubmitted(bytes32 indexed txHash);

    // --- Ownership Events ---

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // --- Config Events ---

    event RequiredVotesUpdated(uint256 oldRequired, uint256 newRequired);
    event FeeBpsUpdated(uint256 newFeeBps);
    event MinFeeUpdated(uint256 newMinFee);
    event CooldownUpdated(uint256 newCooldown);

    // --- Emergency Events ---

    event BridgePausedEvent();
    event BridgeUnpausedEvent();
    event EmergencyWithdrawal(address indexed token, address indexed to, uint256 amount);
}
