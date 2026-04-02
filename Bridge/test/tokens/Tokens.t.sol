// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {GenericToken} from "../../src/tokens/GenericToken.sol";
import {WrappedToken} from "../../src/tokens/WrappedToken.sol";

contract TokenTests is Test {
    GenericToken public genericToken;
    WrappedToken public wrappedToken;

    address public bridgeAddress = address(this);
    address public user = makeAddr("user");
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 1e18;

    function setUp() public {
        genericToken = new GenericToken(
            "Evtim",
            "EVT",
            INITIAL_SUPPLY
        );

        wrappedToken = new WrappedToken(
            "Wrapped Evtim",
            "wEVT",
            address(genericToken),
            1,
            bridgeAddress,
            0 // no supply cap in tests
        );
    }

    function test_GenericToken_Constructor() public view {
        assertEq(genericToken.name(), "Evtim");
        assertEq(genericToken.symbol(), "EVT");
        assertEq(genericToken.totalSupply(), INITIAL_SUPPLY);
        assertEq(genericToken.balanceOf(address(this)), INITIAL_SUPPLY);
    }

    function test_GenericToken_Mint() public {
        uint256 mintAmount = 100 * 1e18;
        
        genericToken.mint(user, mintAmount);

        assertEq(genericToken.balanceOf(user), mintAmount);
        assertEq(genericToken.totalSupply(), INITIAL_SUPPLY + mintAmount);
    }

    function test_WrappedToken_Constructor() public view {
        assertEq(wrappedToken.name(), "Wrapped Evtim");
        assertEq(wrappedToken.symbol(), "wEVT");
        assertEq(wrappedToken.owner(), bridgeAddress);
        assertEq(wrappedToken.totalSupply(), 0);
    }

    function test_WrappedToken_AccessControl() public {
        vm.prank(user);
        vm.expectRevert();
        wrappedToken.mint(user, 100);

        vm.prank(user);
        vm.expectRevert();
        wrappedToken.burnFrom(user, 100);
    }

    function test_WrappedToken_BridgeMintAndBurn() public {
        uint256 mintAmount = 100 * 1e18;
        
        wrappedToken.mint(user, mintAmount);
        
        assertEq(wrappedToken.balanceOf(user), mintAmount);
        assertEq(wrappedToken.totalSupply(), mintAmount);
        
        uint256 burnAmount = 40 * 1e18;
        wrappedToken.burnFrom(user, burnAmount);
        
        assertEq(wrappedToken.balanceOf(user), mintAmount - burnAmount);
        assertEq(wrappedToken.totalSupply(), mintAmount - burnAmount);
    }
}