// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "./JubileeIndex.sol";

/**
 * @title JETHs
 * @dev Jubilee ETH Staking Index.
 */
contract JETHs is JubileeIndex {
    constructor(
        address _weth,
        address _vault,
        address _usdi
    )
        JubileeIndex("Jubilee ETH Staking Index", "jETHs", _weth, _vault, _usdi)
    {}

    function _swapToUSDi(uint256 amountIn) internal override returns (uint256) {
        if (router == address(0)) return 0;

        address[] memory path = new address[](2);
        path[0] = address(asset);
        path[1] = usdi;

        IERC20(address(asset)).approve(router, amountIn);

        uint256[] memory amounts = IRouter(router).swapExactTokensForTokens(
            amountIn,
            0,
            path,
            address(this),
            block.timestamp
        );

        return amounts[amounts.length - 1];
    }
}
