// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only USDT-style token for local and public test networks.
/// @dev Anyone can mint. Never deploy or use this contract on mainnet.
contract TestUSDT is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 6;

    constructor() ERC20("Test USDT", "tUSDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address recipient, uint256 amount) external {
        require(recipient != address(0), "TestUSDT: zero recipient");
        _mint(recipient, amount);
    }

    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
