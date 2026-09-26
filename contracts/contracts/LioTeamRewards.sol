// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LioReferral.sol";

abstract contract LioTeamRewards is LioReferral {
    struct WeeklyTier {
        uint256 threshold;
        uint256 reward;
        bool enabled;
    }

    mapping(uint256 => WeeklyTier) public weeklyTiers;
    mapping(address => uint256) public lastWeeklyRewardTimestamp;
    mapping(address => uint256) public totalWeeklyRewards;
    mapping(address => mapping(uint256 => bool)) public weeklyClaimed;

    event WeeklyRewardAccrued(address indexed user, uint256 amount, uint256 weekId, uint256 timestamp);
    event WeeklyRewardClaimed(address indexed user, uint256 amount, uint256 weekId, uint256 timestamp);

    function setWeeklyTier(uint256 tierIndex, uint256 threshold, uint256 reward, bool enabled) public onlyRole(REWARD_MANAGER_ROLE) {
        require(!planConfigurationLocked, "LioTeamRewards: plan configuration locked");
        weeklyTiers[tierIndex] = WeeklyTier({ threshold: threshold, reward: reward, enabled: enabled });
    }

    function currentWeek() public view returns (uint256) {
        return block.timestamp / 7 days;
    }

    function computeCurrentTier(address user) public view returns (uint256) {
        uint256 leftSide = users[user].leftBusiness;
        uint256 rightSide = users[user].rightBusiness;
        uint256 current = 0;
        uint256 maxTier = 5;
        for (uint256 i = 0; i < maxTier; i++) {
            if (weeklyTiers[i].enabled) {
                uint256 matchedBusiness = (leftSide < rightSide ? leftSide : rightSide) * 2;
                if (matchedBusiness >= weeklyTiers[i].threshold) {
                    current = i + 1;
                }
            }
        }
        return current;
    }

    function accrueWeeklyReward(address user) public {
        require(msg.sender == user || hasRole(OPERATOR_ROLE, msg.sender), "LioTeamRewards: unauthorized caller");
        require(users[user].active, "LioTeamRewards: inactive user");
        uint256 weekId = currentWeek();
        if (weeklyClaimed[user][weekId]) return;

        uint256 tier = computeCurrentTier(user);
        if (tier == 0) return;

        WeeklyTier memory rewardTier = weeklyTiers[tier - 1];
        uint256 amount = rewardTier.reward;
        users[user].teamRewards += amount;
        users[user].claimableBalance += amount;
        _recordLiability(amount);
        totalWeeklyRewards[user] += amount;
        lastWeeklyRewardTimestamp[user] = block.timestamp;
        weeklyClaimed[user][weekId] = true;

        emit WeeklyRewardAccrued(user, amount, weekId, block.timestamp);
    }

    function claimWeeklyReward(address user) public {
        require(msg.sender == user || hasRole(OPERATOR_ROLE, msg.sender), "LioTeamRewards: unauthorized caller");
        require(users[user].active, "LioTeamRewards: inactive user");
        uint256 weekId = currentWeek();
        if (weeklyClaimed[user][weekId]) {
            revert("LioTeamRewards: already claimed for week");
        }
        uint256 amount = rewardTierAmount(user);
        require(amount > 0, "LioTeamRewards: tier not qualified");
        accrueWeeklyReward(user);
        users[user].claimableBalance -= amount;
        users[user].totalClaimed += amount;
        _settleLiability(user, amount);
        emit WeeklyRewardClaimed(user, amount, weekId, block.timestamp);
    }

    function rewardTierAmount(address user) internal view returns (uint256) {
        uint256 tier = computeCurrentTier(user);
        return tier == 0 ? 0 : weeklyTiers[tier - 1].reward;
    }
}
