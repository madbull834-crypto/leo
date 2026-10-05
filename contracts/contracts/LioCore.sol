// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract LioCore is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant REWARD_MANAGER_ROLE = keccak256("REWARD_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    uint256 public constant TREASURY_ALLOCATION_BPS = 5_000;

    address public treasury;
    address public paymentAsset;
    uint256 public minimumInvestment;
    uint256 public directReferralBps;
    uint256 public claimDeductionBps;
    uint256 public lockDuration;
    uint256 public roiMinBps;
    uint256 public roiMaxBps;
    uint256 public roiStrategyId;
    uint256 public currentWeekId;
    uint256 public businessUnit;
    bool public planConfigurationLocked;
    uint256 public totalLiabilities;
    uint256 public treasuryBalance;

    event ConfigurationUpdated(bytes32 indexed key, uint256 oldValue, uint256 newValue, uint256 timestamp);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury, uint256 timestamp);
    event PaymentAssetUpdated(address indexed oldAsset, address indexed newAsset, uint256 timestamp);
    event InvestmentAllocatedToTreasury(
        address indexed investor,
        address indexed treasuryWallet,
        address indexed asset,
        uint256 depositAmount,
        uint256 treasuryAmount,
        uint256 timestamp
    );

    function __LioCore_init(address _treasury, address _paymentAsset, uint256 _minimumInvestment) internal onlyInitializing {
        require(_treasury != address(0), "LioCore: zero treasury");
        require(_minimumInvestment > 0, "LioCore: zero minimum");
        require(_minimumInvestment % 100 == 0, "LioCore: minimum must represent $100");

        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(REWARD_MANAGER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);

        treasury = _treasury;
        paymentAsset = _paymentAsset;
        minimumInvestment = _minimumInvestment;
        businessUnit = _minimumInvestment / 100;
        directReferralBps = 500;
        claimDeductionBps = 500;
        lockDuration = 183 days;
        roiMinBps = 800;
        roiMaxBps = 3200;
        roiStrategyId = 1;
        currentWeekId = 0;
    }

    function setUintConfig(bytes32 key, uint256 value) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldValue = _readUintConfig(key);
        _writeUintConfig(key, value);
        emit ConfigurationUpdated(key, oldValue, value, block.timestamp);
    }

    function setAddressConfig(bytes32 key, address value) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address oldValue = _readAddressConfig(key);
        _writeAddressConfig(key, value);
        emit ConfigurationUpdated(bytes32(abi.encodePacked(key)), 0, 0, block.timestamp);
        if (key == keccak256("treasury")) {
            emit TreasuryUpdated(oldValue, value, block.timestamp);
        }
        if (key == keccak256("paymentAsset")) {
            emit PaymentAssetUpdated(oldValue, value, block.timestamp);
        }
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function isPaused() public view returns (bool) {
        return paused();
    }

    function _readUintConfig(bytes32 key) internal view returns (uint256 value) {
        if (key == keccak256("minimumInvestment")) return minimumInvestment;
        if (key == keccak256("directReferralBps")) return directReferralBps;
        if (key == keccak256("claimDeductionBps")) return claimDeductionBps;
        if (key == keccak256("lockDuration")) return lockDuration;
        if (key == keccak256("roiMinBps")) return roiMinBps;
        if (key == keccak256("roiMaxBps")) return roiMaxBps;
        if (key == keccak256("roiStrategyId")) return roiStrategyId;
        if (key == keccak256("currentWeekId")) return currentWeekId;
        revert("LioCore: unknown uint config");
    }

    function _writeUintConfig(bytes32 key, uint256 value) internal {
        if (key == keccak256("minimumInvestment")) {
            require(value == minimumInvestment, "LioCore: fixed $100 minimum");
        }
        else if (key == keccak256("directReferralBps")) {
            require(value == 500, "LioCore: referral must be 5%");
            directReferralBps = value;
        }
        else if (key == keccak256("claimDeductionBps")) {
            require(value == 500, "LioCore: deduction must be 5%");
            claimDeductionBps = value;
        }
        else if (key == keccak256("lockDuration")) {
            require(value == 183 days, "LioCore: lock must be six months");
            lockDuration = value;
        }
        else if (key == keccak256("roiMinBps")) {
            require(value == 800, "LioCore: ROI minimum must be 8%");
            roiMinBps = value;
        }
        else if (key == keccak256("roiMaxBps")) {
            require(value == 3200, "LioCore: ROI maximum must be 32%");
            roiMaxBps = value;
        }
        else if (key == keccak256("roiStrategyId")) roiStrategyId = value;
        else if (key == keccak256("currentWeekId")) currentWeekId = value;
        else revert("LioCore: unknown uint config");
    }

    function _readAddressConfig(bytes32 key) internal view returns (address value) {
        if (key == keccak256("treasury")) return treasury;
        if (key == keccak256("paymentAsset")) return paymentAsset;
        revert("LioCore: unknown address config");
    }

    function _writeAddressConfig(bytes32 key, address value) internal {
        if (key == keccak256("treasury")) {
            require(value != address(0), "LioCore: zero treasury");
            treasury = value;
        }
        else if (key == keccak256("paymentAsset")) {
            require(treasuryBalance == 0 && totalLiabilities == 0, "LioCore: asset in use");
            paymentAsset = value;
        }
        else revert("LioCore: unknown address config");
    }

    function _collectInvestment(uint256 amount) internal {
        if (paymentAsset == address(0)) {
            require(msg.value == amount, "LioCore: incorrect native value");
        } else {
            require(msg.value == 0, "LioCore: native value not accepted");
            IERC20(paymentAsset).safeTransferFrom(msg.sender, address(this), amount);
        }

        uint256 treasuryAmount = (amount * TREASURY_ALLOCATION_BPS) / 10_000;
        uint256 retainedAmount = amount - treasuryAmount;
        _transferAsset(treasury, treasuryAmount);

        // ROI and principal withdrawal remain based on the complete deposit.
        // The deployer can add funds later as individual payouts become due.
        treasuryBalance += retainedAmount;
        totalLiabilities += amount;

        emit InvestmentAllocatedToTreasury(
            msg.sender,
            treasury,
            paymentAsset,
            amount,
            treasuryAmount,
            block.timestamp
        );
    }

    function _recordLiability(uint256 amount) internal {
        totalLiabilities += amount;
    }

    function _settleLiability(address recipient, uint256 amount) internal {
        require(recipient != address(0), "LioCore: zero recipient");
        require(totalLiabilities >= amount, "LioCore: liability underflow");
        require(treasuryBalance >= amount, "LioCore: insufficient treasury");
        totalLiabilities -= amount;
        treasuryBalance -= amount;
        _transferAsset(recipient, amount);
    }

    function _settleDeductedLiability(address recipient, uint256 gross, uint256 net) internal {
        require(totalLiabilities >= gross, "LioCore: liability underflow");
        require(treasuryBalance >= net, "LioCore: insufficient treasury");
        totalLiabilities -= gross;
        treasuryBalance -= net;
        _transferAsset(recipient, net);
    }

    function _transferAsset(address recipient, uint256 amount) internal {
        if (paymentAsset == address(0)) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            require(success, "LioCore: native transfer failed");
        } else {
            IERC20(paymentAsset).safeTransfer(recipient, amount);
        }
    }
}
