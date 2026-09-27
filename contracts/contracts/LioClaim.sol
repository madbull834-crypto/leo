// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LioTreasury.sol";
import "./libraries/LioMath.sol";

abstract contract LioClaim is LioTreasury {
    mapping(address => mapping(uint256 => bool)) public claimPeriodUsed;

    event InvestmentClaimed(
        address indexed user,
        uint256 grossAmount,
        uint256 deduction,
        uint256 netAmount,
        uint256 timestamp,
        uint256 periodId
    );

    function claimMonthlyInvestment(address user, uint256 periodId) external whenNotPaused {
        require(msg.sender == user || hasRole(OPERATOR_ROLE, msg.sender), "LioClaim: unauthorized caller");
        require(!claimPeriodUsed[user][periodId], "LioClaim: already claimed for period");
        uint256 beforeClaimed = users[user].roiClaimed;
        uint256 beforePaid = users[user].totalClaimed;
        claimROI(user);
        uint256 grossAmount = users[user].roiClaimed - beforeClaimed;
        uint256 netAmount = users[user].totalClaimed - beforePaid;
        uint256 deduction = grossAmount - netAmount;
        claimPeriodUsed[user][periodId] = true;
        emit InvestmentClaimed(user, grossAmount, deduction, netAmount, block.timestamp, periodId);
    }
}
