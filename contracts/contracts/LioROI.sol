// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LioInvestment.sol";
import "./libraries/LioMath.sol";

abstract contract LioROI is LioInvestment {
    struct ContinuousRoiStorage {
        mapping(address => uint256) remainder;
    }

    // Namespaced storage keeps per-second rounding state without shifting the
    // existing upgradeable proxy storage layout.
    bytes32 private constant CONTINUOUS_ROI_STORAGE_SLOT = keccak256("thelio.storage.continuous-roi.v1");

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

    event ROIAccrued(address indexed user, uint256 amount, uint256 timestamp, uint256 elapsedSeconds);
    event ROIClaimed(address indexed user, uint256 grossAmount, uint256 deduction, uint256 netAmount, uint256 timestamp, uint256 periodId);
    event UserRoiRateUpdated(address indexed user, uint256 oldBps, uint256 newBps);

    function _continuousRoiStorage() private pure returns (ContinuousRoiStorage storage store) {
        bytes32 slot = CONTINUOUS_ROI_STORAGE_SLOT;
        assembly {
            store.slot := slot
        }
    }

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
        // Settle time earned at the old rate before applying the new rate.
        accrueROI(user);
        lastRoiAccrualTimestamp[user] = block.timestamp;
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

        uint256 monthlyRate = getSelectedMonthlyRoi(user);
        uint256 principal = profile.principal;
        uint256 denominator = 10_000 * MONTH_SECONDS;
        ContinuousRoiStorage storage continuous = _continuousRoiStorage();
        uint256 numerator = (principal * monthlyRate * elapsed) + continuous.remainder[user];
        uint256 accrued = numerator / denominator;
        continuous.remainder[user] = numerator % denominator;
        lastRoiAccrualTimestamp[user] = block.timestamp;

        if (accrued == 0) return;

        roiAccrued[user] += accrued;
        profile.roiAccrued += accrued;
        _recordLiability(accrued);

        emit ROIAccrued(user, accrued, block.timestamp, elapsed);
    }

    function claimROI(address user) public {
        require(msg.sender == user || hasRole(OPERATOR_ROLE, msg.sender), "LioROI: unauthorized caller");
        require(users[user].active, "LioROI: inactive user");
        accrueROI(user);

        uint256 gross = roiAccrued[user] - roiClaimed[user];
        require(gross > 0, "LioROI: nothing to claim");

        uint256 previouslyDeducted = LioMath.bpsOf(roiClaimed[user], claimDeductionBps);
        uint256 cumulativeDeduction = LioMath.bpsOf(roiClaimed[user] + gross, claimDeductionBps);
        uint256 deduction = cumulativeDeduction - previouslyDeducted;
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
