// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILioCore {
    function paymentAsset() external view returns (address);
    function treasury() external view returns (address);
    function minimumInvestment() external view returns (uint256);
    function directReferralBps() external view returns (uint256);
    function claimDeductionBps() external view returns (uint256);
    function lockDuration() external view returns (uint256);
    function isPaused() external view returns (bool);
    function hasRole(bytes32 role, address account) external view returns (bool);
}
