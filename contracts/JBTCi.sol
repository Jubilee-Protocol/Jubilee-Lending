// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "./JubileeIndex.sol";

/**
 * @title JBTCi
 * @dev Jubilee Bitcoin Index.
 */
contract JBTCi is JubileeIndex {
    constructor(
        address _wbtc,
        address _vault,
        address _usdi
    ) JubileeIndex("Jubilee Bitcoin Index", "jBTCi", _wbtc, _vault, _usdi) {}

    function _swapToUSDi(uint256 amountIn) internal override returns (uint256) {
        if (router == address(0)) return 0; // Or handle differently for simulation

        address[] memory path = new address[](2);
        path[0] = address(asset);
        path[1] = usdi;

        IERC20(address(asset)).approve(router, amountIn);

        uint256[] memory amounts = IRouter(router).swapExactTokensForTokens(
            amountIn,
            0, // Slippage should be handled or passed
            path,
            address(this),
            block.timestamp
        );

        return amounts[amounts.length - 1];
    }
}
