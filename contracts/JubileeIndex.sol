// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IVault {
    function deposit(
        uint256 assets,
        address receiver
    ) external returns (uint256);
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
}

interface IRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/**
 * @title JubileeIndex
 * @dev Base contract for yield-bearing index tokens.
 * Wraps an underlying vault and provides a claimYield() function.
 */
abstract contract JubileeIndex is ERC20, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    IVault public immutable vault;
    address public immutable usdi;
    address public router;

    uint256 public lastPricePerShare; // In asset decimals

    event YieldClaimed(uint256 amountAsset, uint256 amountUSDi);

    constructor(
        string memory _name,
        string memory _symbol,
        address _asset,
        address _vault,
        address _usdi
    ) ERC20(_name, _symbol) {
        asset = IERC20(_asset);
        vault = IVault(_vault);
        usdi = _usdi;
        lastPricePerShare = 1e18; // Default 1:1 if not set
    }

    function setRouter(address _router) external onlyOwner {
        router = _router;
    }

    function deposit(uint256 amount) external {
        asset.safeTransferFrom(msg.sender, address(this), amount);
        asset.safeApprove(address(vault), amount);
        uint256 shares = vault.deposit(amount, address(this));
        _mint(msg.sender, shares);
    }

    function withdraw(uint256 shares) external {
        _burn(msg.sender, shares);
        vault.withdraw(
            vault.convertToAssets(shares),
            msg.sender,
            address(this)
        );
    }

    /**
     * @dev Calculates and extracts yield since last claim.
     * Swaps yield for USDi and returns it.
     */
    function claimYield() external returns (uint256) {
        uint256 totalShares = totalSupply();
        if (totalShares == 0) return 0;

        uint256 currentPricePerShare = vault.convertToAssets(1e18); // Assuming 18 decimals
        if (currentPricePerShare <= lastPricePerShare) return 0;

        uint256 profitPerShare = currentPricePerShare - lastPricePerShare;
        uint256 totalProfitAssets = (profitPerShare * totalShares) / 1e18;

        if (totalProfitAssets > 0) {
            // Withdraw profit from vault
            uint256 withdrawn = vault.withdraw(
                totalProfitAssets,
                address(this),
                address(this)
            );

            // Swap WBTC -> USDi
            uint256 usdiAmount = _swapToUSDi(withdrawn);

            // Transfer USDi to caller (YieldRouter)
            IERC20(usdi).safeTransfer(msg.sender, usdiAmount);

            lastPricePerShare = currentPricePerShare;
            emit YieldClaimed(withdrawn, usdiAmount);
            return usdiAmount;
        }

        return 0;
    }

    function _swapToUSDi(uint256 amountIn) internal virtual returns (uint256);
}
