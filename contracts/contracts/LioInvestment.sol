// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LioCore.sol";

abstract contract LioInvestment is LioCore {
    enum AccountStatus {
        Inactive,
        Active,
        Suspended
    }

    struct UserProfile {
        bool active;
        address referrer;
        uint256 activationTimestamp;
        uint256 unlockTimestamp;
        uint256 principal;
        uint256 roiAccrued;
        uint256 roiClaimed;
        uint256 directRewards;
        uint256 teamRewards;
        uint256 leftBusiness;
        uint256 rightBusiness;
        uint256 freshBusiness;
        uint256 claimableBalance;
        uint256 totalClaimed;
        AccountStatus status;
    }

    mapping(address => UserProfile) public users;

    event UserActivated(address indexed user, uint256 amount, uint256 activationTimestamp, uint256 unlockTimestamp);
    event PrincipalWithdrawn(address indexed user, uint256 amount, uint256 timestamp);

    function activateInvestment(address referrer, uint256 amount) internal {
        require(amount >= minimumInvestment, "LioInvestment: below minimum");
        require(!users[msg.sender].active, "LioInvestment: already active");
        require(amount > 0, "LioInvestment: zero amount");

        _collectInvestment(amount);

        uint256 activationTimestamp = block.timestamp;
        uint256 unlockTimestamp = activationTimestamp + lockDuration;

        users[msg.sender] = UserProfile({
            active: true,
            referrer: referrer,
            activationTimestamp: activationTimestamp,
            unlockTimestamp: unlockTimestamp,
            principal: amount,
            roiAccrued: 0,
            roiClaimed: 0,
            directRewards: 0,
            teamRewards: 0,
            leftBusiness: 0,
            rightBusiness: 0,
            freshBusiness: 0,
            claimableBalance: 0,
            totalClaimed: 0,
            status: AccountStatus.Active
        });

        emit UserActivated(msg.sender, amount, activationTimestamp, unlockTimestamp);
    }

    function withdrawPrincipal() external whenNotPaused {
        UserProfile storage user = users[msg.sender];
        require(user.active, "LioInvestment: inactive user");
        require(block.timestamp >= user.unlockTimestamp, "LioInvestment: principal locked");
        require(user.principal > 0, "LioInvestment: no principal");

        uint256 amount = user.principal;
        user.principal = 0;
        user.active = false;
        user.status = AccountStatus.Inactive;

        _settleLiability(msg.sender, amount);

        emit PrincipalWithdrawn(msg.sender, amount, block.timestamp);
    }

    function getUser(address userAddress) external view returns (UserProfile memory) {
        return users[userAddress];
    }

    function isUserActive(address userAddress) external view returns (bool) {
        return users[userAddress].active;
    }
}
