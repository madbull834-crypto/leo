// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../TheLio.sol";

/// @dev Test-only implementation used to prove that proxy upgrades preserve state.
/// @custom:oz-upgrades-unsafe-allow missing-initializer
contract TheLioV2 is TheLio {
    function version() external pure returns (uint256) {
        return 2;
    }
}
