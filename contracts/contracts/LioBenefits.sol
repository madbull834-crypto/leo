// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LioTeamRewards.sol";

abstract contract LioBenefits is LioTeamRewards {
    struct ExpenseTier {
        uint256 threshold;
        uint256 benefit;
        bool enabled;
    }

    struct TourReward {
        string name;
        uint256 target;
        bool enabled;
    }

    mapping(uint256 => ExpenseTier) public expenseTiers;
    mapping(uint256 => TourReward) public tourRewards;
    mapping(address => uint256) public currentExpenseTier;
    mapping(address => uint256) public claimedExpenseBenefit;
    mapping(address => mapping(uint256 => bool)) public tourQualified;

    event ExpenseBenefitQualified(address indexed user, uint256 threshold, uint256 amount, uint256 timestamp);
    event TourRewardQualified(address indexed user, string tourName, uint256 target, uint256 timestamp);

    function setExpenseTier(uint256 index, uint256 threshold, uint256 benefit, bool enabled) public onlyRole(REWARD_MANAGER_ROLE) {
        require(!planConfigurationLocked, "LioBenefits: plan configuration locked");
        expenseTiers[index] = ExpenseTier({ threshold: threshold, benefit: benefit, enabled: enabled });
    }

    function setTourReward(uint256 index, string memory name, uint256 target, bool enabled) public onlyRole(REWARD_MANAGER_ROLE) {
        require(!planConfigurationLocked, "LioBenefits: plan configuration locked");
        tourRewards[index] = TourReward({ name: name, target: target, enabled: enabled });
    }

    function updateFreshBusiness(address user, uint256 amount) public onlyRole(OPERATOR_ROLE) {
        users[user].freshBusiness += amount;
    }

    function qualifyExpenseBenefit(address user) public {
        require(msg.sender == user || hasRole(OPERATOR_ROLE, msg.sender), "LioBenefits: unauthorized caller");
        uint256 fresh = users[user].freshBusiness;
        uint256 selected = 0;
        for (uint256 i = 0; i < 4; i++) {
            if (expenseTiers[i].enabled && fresh >= expenseTiers[i].threshold) {
                selected = i + 1;
            }
        }

        if (selected == 0) return;
        if (selected <= currentExpenseTier[user]) return;
        uint256 amount = expenseTiers[selected - 1].benefit;
        uint256 incrementalAmount = amount - claimedExpenseBenefit[user];
        currentExpenseTier[user] = selected;
        claimedExpenseBenefit[user] = amount;
        users[user].claimableBalance += incrementalAmount;
        _recordLiability(incrementalAmount);
        emit ExpenseBenefitQualified(user, expenseTiers[selected - 1].threshold, incrementalAmount, block.timestamp);
    }

    function qualifyTourReward(address user, uint256 index) public {
        require(msg.sender == user || hasRole(OPERATOR_ROLE, msg.sender), "LioBenefits: unauthorized caller");
        TourReward memory reward = tourRewards[index];
        require(reward.enabled, "LioBenefits: reward disabled");
        require(!tourQualified[user][index], "LioBenefits: already qualified");
        require(directBusiness[user] >= reward.target, "LioBenefits: target not met");
        tourQualified[user][index] = true;
        emit TourRewardQualified(user, reward.name, reward.target, block.timestamp);
    }
}
