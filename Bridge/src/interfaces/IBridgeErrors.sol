// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IBridgeErrors
 * @dev Custom errors with context parameters for Bridge contract.
 */
interface IBridgeErrors {
    // Amount errors
    error InvalidAmount(uint256 provided, uint256 minimum);
    error FeeExceedsMaximum(uint256 fee, uint256 maxFee);
    error InvalidFee(uint256 fee, uint256 amount);

    // Address errors
    error InvalidTokenAddress(address provided);
    error InvalidRecipient(address provided);

    // Chain errors
    error SameChainId(uint256 chainId);
    error InvalidChainId(uint256 chainId);

    // Token registry errors
    error WrappedTokenNotRegistered(address token, uint256 targetChainId);

    // Transaction state errors
    error TransactionAlreadyProcessed(bytes32 txHash);
    error TransactionAlreadySubmitted(bytes32 txHash);
    error TransactionNotSubmitted(bytes32 txHash);

    // Access control errors
    error NotOwner(address caller);
    error NotValidator(address caller);
    error NotPendingOwner(address caller);
    error InsufficientBalance(uint256 available, uint256 required);

    // Validator consensus errors
    error AlreadyVoted(bytes32 txHash, address validator);
    error InvalidRequiredVotes(uint256 required, uint256 validatorCount);

    // State errors
    error BridgePaused();
    error BridgeNotPaused();
    error CooldownNotElapsed(address user, uint256 secondsRemaining);
}
