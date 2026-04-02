// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWrappedToken} from "../interfaces/IWrappedToken.sol";
import {IBridgeErrors} from "../interfaces/IBridgeErrors.sol";

library BridgeInternal {
    using SafeERC20 for IERC20;

    /**
     * @notice Prepares bridge transaction data for lock/burn.
     * @param outputToken  The token address on the destination chain.
     * @param user         The user initiating the bridge.
     * @param amount       Token amount (pre-fee).
     * @param feeBps       Fee in basis points (30 = 0.3%).
     * @param minFee       Minimum absolute fee (prevents dust-fee griefing).
     * @param maxFee       Slippage guard: reverts if fee > maxFee (0 = no guard).
     * @param fromChainId  Chain ID where lock/burn happens.
     * @param toChainId    Target chain ID.
     * @param nonce        Global nonce for unique txHash.
     */
    function prepareBridgeTx(
        address outputToken,
        address user,
        uint256 amount,
        uint256 feeBps,
        uint256 minFee,
        uint256 maxFee,
        uint256 fromChainId,
        uint256 toChainId,
        uint256 nonce
    ) internal pure returns (uint256 fee, bytes32 txHash) {
        fee = (amount * feeBps) / 10_000;
        if (fee < minFee) fee = minFee;

        // Slippage protection: user sets an upper bound on acceptable fee
        if (maxFee > 0 && fee > maxFee) {
            revert IBridgeErrors.FeeExceedsMaximum(fee, maxFee);
        }

        // Fee must not consume the full amount
        if (fee >= amount) revert IBridgeErrors.InvalidFee(fee, amount);

        txHash = keccak256(abi.encodePacked(outputToken, user, amount, fee, fromChainId, nonce, toChainId));
    }

    /**
     * @notice Processes claim (mint wrapped) or release (transfer original) logic.
     * @param token      Token to mint/transfer.
     * @param to         Recipient of (amount - fee).
     * @param amount     Total token amount from the source event.
     * @param fee        Fee amount paid to the relayer.
     * @param isWrapped  True = mint (claim), False = transfer (release).
     * @param relayer    Address that submitted the claim/release (receives fee).
     */
    function processClaimOrRelease(
        address token,
        address to,
        uint256 amount,
        uint256 fee,
        bool isWrapped,
        address relayer
    ) internal {
        uint256 recipientAmount = amount - fee;

        if (fee > 0) {
            if (isWrapped) {
                IWrappedToken(token).mint(relayer, fee);
                IWrappedToken(token).mint(to, recipientAmount);
            } else {
                IERC20(token).safeTransfer(relayer, fee);
                IERC20(token).safeTransfer(to, recipientAmount);
            }
        } else {
            if (isWrapped) {
                IWrappedToken(token).mint(to, amount);
            } else {
                IERC20(token).safeTransfer(to, amount);
            }
        }
    }
}
