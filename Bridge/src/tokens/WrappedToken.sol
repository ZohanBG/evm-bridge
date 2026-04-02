// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWrappedToken} from "../interfaces/IWrappedToken.sol";
import {IBridgeErrors} from "../interfaces/IBridgeErrors.sol";

/**
 * @title WrappedToken
 * @dev Wrapped token representation on destination chain.
 * Implements IWrappedToken to be compatible with Bridge.sol.
 * The Bridge contract is the 'Owner' of this contract.
 *
 * Supply is capped at `maxSupply` to prevent unbounded minting
 * in case the bridge is compromised.
 */
contract WrappedToken is ERC20, Ownable, IWrappedToken {
    address public immutable ORIGINAL_TOKEN;
    uint256 public immutable SOURCE_CHAIN_ID;

    /// @notice Maximum mintable supply (set once at deploy, 0 = unlimited)
    uint256 public immutable maxSupply;

    error SupplyCapExceeded(uint256 currentSupply, uint256 mintAmount, uint256 cap);

    constructor(
        string memory name,
        string memory symbol,
        address originalToken_,
        uint256 sourceChainId_,
        address bridge_,
        uint256 maxSupply_
    ) ERC20(name, symbol) Ownable(bridge_) {
        if (originalToken_ == address(0)) revert IBridgeErrors.InvalidTokenAddress(originalToken_);
        if (sourceChainId_ == 0) revert IBridgeErrors.InvalidChainId(sourceChainId_);
        if (bridge_ == address(0)) revert IBridgeErrors.InvalidTokenAddress(bridge_);

        ORIGINAL_TOKEN = originalToken_;
        SOURCE_CHAIN_ID = sourceChainId_;
        maxSupply = maxSupply_;
    }

    /**
     * @notice Mints new tokens, can only be called by the bridge (Owner).
     * @dev Reverts if minting would exceed maxSupply (when maxSupply > 0).
     */
    function mint(address to, uint256 amount) external override onlyOwner {
        if (maxSupply > 0 && totalSupply() + amount > maxSupply) {
            revert SupplyCapExceeded(totalSupply(), amount, maxSupply);
        }
        _mint(to, amount);
    }

    /**
     * @notice Burns tokens from a user, can only be called by the bridge (Owner).
     * @dev This function is required by IWrappedToken.
     * @param from The user address to burn tokens from.
     * @param amount The amount of tokens to burn.
     */
    function burnFrom(address from, uint256 amount) external override onlyOwner {
        _burn(from, amount);
    }
}
