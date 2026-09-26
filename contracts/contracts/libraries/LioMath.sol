// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library LioMath {
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    function bpsOf(uint256 amount, uint256 bps) internal pure returns (uint256) {
        if (amount == 0 || bps == 0) {
            return 0;
        }
        return (amount * bps) / BPS_DENOMINATOR;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function safeSub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(a >= b, "LioMath: underflow");
        return a - b;
    }
}
