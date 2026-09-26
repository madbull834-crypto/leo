// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LioInvestment.sol";
import "./libraries/LioMath.sol";

abstract contract LioROI is LioInvestment {
    struct RoiConfig {
        uint256 minBps;
        uint256 maxBps;
        uint256 strategyId;
    }

    mapping(address => uint256) public lastRoiAccrualTimestamp;
    mapping(address => uint256) public roiAccrued;
    mapping(address => uint256) public roiClaimed;
    mapping(address => uint256) public lastClaimPeriod;
    mapping(address => uint256) public monthlyRoiBps;
    uint256 public constant MONTH_SECONDS = 30 days;

    event ROIAccrued(address indexed user, uint256 amount, uint256 timestamp, uint256 periodId);
    event ROIClaimed(address indexed user, uint256 grossAmount, uint256 deduction, uint256 netAmount, uint256 timestamp, uint256 periodId);
    event UserRoiRateUpdated(address indexed user, uint256 oldBps, uint256 newBps);

    function setRoiConfig(uint256 minBps, uint256 maxBps, uint256 strategyId) external onlyRole(REWARD_MANAGER_ROLE) {
        require(minBps == 800 && maxBps == 3200, "LioROI: plan range is 8%-32%");
        roiMinBps = minBps;
        roiMaxBps = maxBps;
        roiStrategyId = strategyId;
    }

    function getSelectedMonthlyRoi(address user) public view returns (uint256) {
        if (users[user].activationTimestamp == 0) return 0;
        uint256 selected = monthlyRoiBps[user];
        return selected == 0 ? roiMinBps : selected;
    }

    function setUserMonthlyRoi(address user, uint256 bps) external onlyRole(REWARD_MANAGER_ROLE) {
        require(users[user].active, "LioROI: inactive user");
        require(bps >= roiMinBps && bps <= roiMaxBps, "LioROI: rate out of range");
        uint256 oldBps = getSelectedMonthlyRoi(user);
        monthlyRoiBps[user] = bps;
        emit UserRoiRateUpdated(user, oldBps, bps);
    }

    function accrueROI(address user) public {
        UserProfile storage profile = users[user];
        require(profile.active, "LioROI: inactive user");

        uint256 lastTs = lastRoiAccrualTimestamp[user];
        if (lastTs == 0) {
            lastTs = profile.activationTimestamp;
        }

        uint256 elapsed = block.timestamp - lastTs;
        if (elapsed == 0) return;

        uint256 periodMonths = elapsed / MONTH_SECONDS;
        if (periodMonths == 0) return;

        uint256 monthlyRate = getSelectedMonthlyRoi(user);
        uint256 principal = profile.principal;
        uint256 accrued = (principal * monthlyRate * periodMonths) / 10_000 / 1;

        roiAccrued[user] += accrued;
        profile.roiAccrued += accrued;
        _recordLiability(accrued);
        lastRoiAccrualTimestamp[user] = lastTs + (periodMonths * MONTH_SECONDS);

        emit ROIAccrued(user, accrued, block.timestamp, periodMonths);
    }

    function claimROI(address user) public {
        require(msg.sender == user || hasRole(OPERATOR_ROLE, msg.sender), "LioROI: unauthorized caller");
        require(users[user].active, "LioROI: inactive user");
        accrueROI(user);

        uint256 gross = roiAccrued[user] - roiClaimed[user];
        require(gross > 0, "LioROI: nothing to claim");

        uint256 deduction = LioMath.bpsOf(gross, claimDeductionBps);
        uint256 net = gross - deduction;
        uint256 period = lastClaimPeriod[user] + 1;

        roiClaimed[user] += gross;
        users[user].roiClaimed += gross;
        users[user].totalClaimed += net;
        lastClaimPeriod[user] = period;

        _settleDeductedLiability(user, gross, net);

        emit ROIClaimed(user, gross, deduction, net, block.timestamp, period);
    }
}
