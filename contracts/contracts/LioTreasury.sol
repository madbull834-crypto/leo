// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./LioBenefits.sol";

abstract contract LioTreasury is LioBenefits, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    event TreasuryFunded(address indexed asset, uint256 amount, uint256 timestamp);
    event PayoutExecuted(address indexed asset, address indexed recipient, uint256 amount, uint256 timestamp);
    event InsufficientLiquidity(address indexed asset, uint256 required, uint256 available, uint256 timestamp);

    function __LioTreasury_init() internal onlyInitializing {
        __ReentrancyGuard_init();
    }

    function fundTreasury(uint256 amount) external payable {
        require(amount > 0, "LioTreasury: amount invalid");
        if (paymentAsset == address(0)) {
            require(msg.value == amount, "LioTreasury: incorrect native value");
        } else {
            require(msg.value == 0, "LioTreasury: native value not accepted");
            IERC20(paymentAsset).safeTransferFrom(msg.sender, address(this), amount);
        }
        treasuryBalance += amount;
        emit TreasuryFunded(paymentAsset, amount, block.timestamp);
    }

    function getAvailableLiquidity() public view returns (uint256) {
        return treasuryBalance > totalLiabilities ? treasuryBalance - totalLiabilities : 0;
    }

    function isLiquiditySufficient(uint256 amount) public view returns (bool) {
        return getAvailableLiquidity() >= amount;
    }

    function recordLiability(uint256 amount) external onlyRole(TREASURY_ROLE) {
        totalLiabilities += amount;
    }

    function releasePayout(address recipient, uint256 amount) external onlyRole(TREASURY_ROLE) nonReentrant {
        if (amount > getAvailableLiquidity()) {
            emit InsufficientLiquidity(paymentAsset, amount, getAvailableLiquidity(), block.timestamp);
            revert("LioTreasury: insufficient liquidity");
        }

        if (paymentAsset == address(0)) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            require(success, "LioTreasury: native transfer failed");
        } else {
            IERC20(paymentAsset).safeTransfer(recipient, amount);
        }

        treasuryBalance -= amount;
        emit PayoutExecuted(paymentAsset, recipient, amount, block.timestamp);
    }
}
