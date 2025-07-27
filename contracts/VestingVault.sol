// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20Mintable {
    function transfer(address to, uint256 amt) external returns (bool);

    function transferFrom(address from, address to, uint256 amt) external returns (bool);
}

contract VestingVault is Ownable {
    struct Grant {
        uint128 total;      // total tokens granted
        uint128 claimed;    // tokens already claimed
        uint64 start;      // vesting start timestamp
        uint64 cliff;      // cliff seconds after start
        uint64 duration;   // vesting duration in seconds
    }

    IERC20Mintable public immutable token;
    mapping(address => Grant) public grants;

    event GrantAdded(address indexed beneficiary, uint256 amount);
    event TokensClaimed(address indexed beneficiary, uint256 amount);

    constructor(IERC20Mintable _token) Ownable(msg.sender) {
        token = _token;
    }

    /**
     * @notice Adds a new vesting grant for a beneficiary.
     * @dev Can only be called by the contract owner. A beneficiary can only have one grant.
     */
    function addGrant(
        address beneficiary,
        uint128 amount,
        uint64 cliffSeconds,
        uint64 durationSeconds
    ) external onlyOwner {
        require(beneficiary != address(0), "VestingVault: beneficiary is zero address");
        require(amount > 0, "VestingVault: amount must be greater than 0");
        require(durationSeconds > 0, "VestingVault: duration must be greater than 0");
        require(cliffSeconds <= durationSeconds, "VestingVault: cliff cannot be longer than duration");
        require(grants[beneficiary].total == 0, "VestingVault: beneficiary already has a grant");

        grants[beneficiary] = Grant({
            total: amount,
            claimed: 0,
            start: uint64(block.timestamp),
            cliff: uint64(block.timestamp) + cliffSeconds,
            duration: durationSeconds
        });

        emit GrantAdded(beneficiary, amount);
    }

    /**
     * @notice Allows a beneficiary to claim their vested tokens.
     */
    function claim() external {
        uint256 vested = vestedOf(msg.sender);
        require(vested > 0, "VestingVault: no vested tokens to claim");

        Grant storage g = grants[msg.sender];
        uint128 claimable = uint128(vested) - g.claimed;
        require(claimable > 0, "VestingVault: no new tokens to claim");

        g.claimed += claimable;

        emit TokensClaimed(msg.sender, claimable);
        require(token.transfer(msg.sender, claimable), "VestingVault: token transfer failed");
    }

    /**
     * @notice Calculates the total amount of vested tokens for a beneficiary.
     * @return The total number of tokens vested to date.
     */
    function vestedOf(address _beneficiary) public view returns (uint256) {
        Grant memory g = grants[_beneficiary];
        if (g.total == 0) {
            return 0;
        }

        if (block.timestamp < g.cliff) {
            return 0;
        }

        if (block.timestamp >= g.start + g.duration) {
            return g.total;
        }

        uint256 elapsed = block.timestamp - g.start;
        return (uint256(g.total) * elapsed) / g.duration;
    }
}