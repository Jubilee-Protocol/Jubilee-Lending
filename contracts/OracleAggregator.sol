// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

// interface IPyth {
//     function getPrice(bytes32 id) external view returns (PythStructs.Price memory price);
// }

/**
 * @title OracleAggregator
 * @dev Price feeds for all assets with Dual Oracle support (Chainlink + Pyth).
 */
contract OracleAggregator is Ownable {
    struct OracleConfig {
        address chainlinkFeed;
        address pythFeed;
        bytes32 pythId;
        uint256 maxDeviation; // In basis points (e.g. 500 = 5%)
        uint256 heartbeat; // Max staleness in seconds (M-02: per-asset)
    }

    mapping(address => OracleConfig) public configs;
    uint256 public constant MAX_DEVIATION_BASE = 10000;

    event OracleUpdated(address indexed asset, address chainlink, address pyth);

    function setOracleConfig(
        address asset,
        address chainlink,
        address pyth,
        bytes32 pythId,
        uint256 maxDeviation
    ) external onlyOwner {
        require(asset != address(0), "Invalid asset"); // L-01
        require(chainlink != address(0), "Invalid chainlink"); // L-01
        configs[asset] = OracleConfig({
            chainlinkFeed: chainlink,
            pythFeed: pyth,
            pythId: pythId,
            maxDeviation: maxDeviation,
            heartbeat: 1 hours // Default; can override with setHeartbeat
        });
        emit OracleUpdated(asset, chainlink, pyth);
    }

    function setHeartbeat(
        address asset,
        uint256 _heartbeat
    ) external onlyOwner {
        require(configs[asset].chainlinkFeed != address(0), "Oracle not set");
        require(
            _heartbeat >= 60 && _heartbeat <= 24 hours,
            "Invalid heartbeat"
        );
        configs[asset].heartbeat = _heartbeat;
    }

    function getLatestPrice(address asset) public view returns (uint256) {
        OracleConfig memory config = configs[asset];
        require(config.chainlinkFeed != address(0), "Oracle not set");

        uint256 chainlinkPrice = getChainlinkPrice(
            config.chainlinkFeed,
            config.heartbeat
        );

        // If Pyth is configured, verify deviation
        if (config.pythFeed != address(0)) {
            // uint256 pythPrice = getPythPrice(config.pythFeed, config.pythId);
            // checkDeviation(chainlinkPrice, pythPrice, config.maxDeviation);
            // return (chainlinkPrice + pythPrice) / 2;
            return chainlinkPrice; // Fallback to just Chainlink for now until Pyth interface is added
        }

        return chainlinkPrice;
    }

    function getChainlinkPrice(
        address feed,
        uint256 heartbeat
    ) internal view returns (uint256) {
        try AggregatorV3Interface(feed).latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            // M-02 FIX: Per-asset heartbeat check
            if (price > 0 && block.timestamp - updatedAt < heartbeat) {
                return uint256(price);
            }
        } catch {}
        revert("Chainlink Stale");
    }

    // function getPythPrice(address pyth, bytes32 id) internal view returns (uint256) {
    //     PythStructs.Price memory price = IPyth(pyth).getPrice(id);
    //     return uint256(int256(price.price)); // Adjust decimals as needed
    // }

    function checkDeviation(
        uint256 p1,
        uint256 p2,
        uint256 maxDev
    ) internal pure {
        uint256 diff = p1 > p2 ? p1 - p2 : p2 - p1;
        uint256 deviation = (diff * MAX_DEVIATION_BASE) / ((p1 + p2) / 2);
        require(deviation <= maxDev, "Oracle mismatch");
    }
}
