// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LioClaim.sol";

contract TheLio is LioClaim {
    event BusinessVolumeUpdated(address indexed user, uint256 leftBusiness, uint256 rightBusiness, uint256 freshBusiness, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _treasury, address _paymentAsset, uint256 _minimumInvestment) external initializer {
        __LioCore_init(_treasury, _paymentAsset, _minimumInvestment);
        __LioTreasury_init();

        uint256 unit = businessUnit;
        // THE LIOX weekly rewards. Thresholds are TOTAL team business; the
        // 50/50 leg ratio is enforced in computeCurrentTier, which matches on
        // min(leftLeg, rightLeg) * 2.
        setWeeklyTier(0, 5000 * unit, 25 * unit, true);
        setWeeklyTier(1, 10000 * unit, 50 * unit, true);
        setWeeklyTier(2, 25000 * unit, 110 * unit, true);
        setWeeklyTier(3, 50000 * unit, 150 * unit, true);
        setWeeklyTier(4, 100000 * unit, 300 * unit, true);
        setWeeklyTier(5, 200000 * unit, 750 * unit, true);

        setExpenseTier(0, 10000 * unit, 250 * unit, true);
        setExpenseTier(1, 25000 * unit, 1000 * unit, true);
        setExpenseTier(2, 50000 * unit, 2500 * unit, true);
        setExpenseTier(3, 100000 * unit, 5000 * unit, true);

        setTourReward(0, "Thailand", 10000 * unit, true);
        setTourReward(1, "Bali", 25000 * unit, true);
        setTourReward(2, "Russia", 50000 * unit, true);
        setTourReward(3, "Switzerland", 100000 * unit, true);
        planConfigurationLocked = true;
    }

    function activateInvestor(address referrer, uint256 amount) external payable whenNotPaused nonReentrant {
        activateInvestment(referrer, amount);
        assignReferral(msg.sender, referrer);
        issueDirectReferralReward(msg.sender, referrer, amount);
    }

    function updateUserBusiness(address user, uint256 leftVolume, uint256 rightVolume, uint256 freshVolume) external onlyRole(OPERATOR_ROLE) {
        users[user].leftBusiness = leftVolume;
        users[user].rightBusiness = rightVolume;
        users[user].freshBusiness = freshVolume;
        emit BusinessVolumeUpdated(user, leftVolume, rightVolume, freshVolume, block.timestamp);
    }

    function claimForUser(address user) external whenNotPaused {
        claimROI(user);
    }

    function claimWeeklyForUser(address user) external whenNotPaused {
        claimWeeklyReward(user);
    }

    function withdrawRewards() external whenNotPaused nonReentrant {
        uint256 amount = users[msg.sender].claimableBalance;
        require(amount > 0, "TheLio: no rewards");
        users[msg.sender].claimableBalance = 0;
        users[msg.sender].totalClaimed += amount;
        _settleLiability(msg.sender, amount);
    }

    function getCurrentTier(address user) external view returns (uint256) {
        return computeCurrentTier(user);
    }

    function getUserProfile(address user) external view returns (UserProfile memory) {
        return users[user];
    }
}
