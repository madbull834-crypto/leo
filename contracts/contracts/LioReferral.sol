// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LioROI.sol";
import "./libraries/LioMath.sol";

abstract contract LioReferral is LioROI {
    mapping(address => address) public referrerOf;
    mapping(address => address) public leftChildOf;
    mapping(address => address) public rightChildOf;
    mapping(address => bool) public directRewardIssued;
    mapping(address => uint256) public directBusiness;

    event DirectRewardGenerated(
        address indexed user,
        address indexed referrer,
        uint256 amount,
        uint256 timestamp
    );
    event ReferralAssigned(
        address indexed user,
        address indexed referrer,
        address indexed parent,
        uint256 timestamp
    );

    function assignReferral(address user, address referrer) internal {
        require(user != address(0), "LioReferral: zero user");
        require(referrer != user, "LioReferral: self referral");
        require(referrer != address(0), "LioReferral: zero referrer");
        require(users[user].activationTimestamp != 0, "LioReferral: user not active");
        require(
            referrer == treasury || users[referrer].active,
            "LioReferral: referrer must be active"
        );

        if (referrerOf[user] == address(0)) {
            referrerOf[user] = referrer;
            emit ReferralAssigned(user, referrer, referrer, block.timestamp);
        }
    }

    function isReferralEligible(address account) public view returns (bool) {
        return account == treasury || users[account].active;
    }

    function issueDirectReferralReward(address user, address referrer, uint256 investmentAmount) internal {
        require(user != address(0), "LioReferral: invalid user");
        require(referrer != address(0), "LioReferral: invalid referrer");
        require(referrer != user, "LioReferral: self referral");
        require(!directRewardIssued[user], "LioReferral: duplicate reward");

        uint256 rewardAmount = LioMath.bpsOf(investmentAmount, directReferralBps);
        users[referrer].directRewards += rewardAmount;
        directBusiness[referrer] += investmentAmount;
        directRewardIssued[user] = true;
        _recordLiability(rewardAmount);
        users[referrer].totalClaimed += rewardAmount;
        _settleLiability(referrer, rewardAmount);

        emit DirectRewardGenerated(user, referrer, rewardAmount, block.timestamp);
    }

    function setPlacement(address parent, address left, address right) external onlyRole(OPERATOR_ROLE) {
        leftChildOf[parent] = left;
        rightChildOf[parent] = right;
    }

    function hasCycle(address candidate, address target) public view returns (bool) {
        address walker = candidate;
        while (walker != address(0) && walker != target) {
            walker = referrerOf[walker];
        }
        return walker == target;
    }
}
