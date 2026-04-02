// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IWrappedToken
 * @dev Interface for WrappedToken contract
 */
interface IWrappedToken {
    function mint(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
}