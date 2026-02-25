// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IjUSDi {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

interface ICollateralManager {
    function getCollateralValue(
        address asset,
        uint256 amount
    ) external view returns (uint256);
    function calculateHealthFactor(
        uint256 borrowedValue,
        uint256 collateralValue,
        uint256 collateralFactor
    ) external pure returns (uint256);
    function collateralFactors(address asset) external view returns (uint256);
    function getBoostedCollateralFactor(
        address user,
        address asset
    ) external view returns (uint256);
}

interface IYieldRouter {
    function routeYieldToRepayment(
        uint256 loanId,
        uint256 yieldAmount
    ) external;
}

/**
 * @title JubileeLending
 * @dev Main lending logic - deposit, borrow, repay.
 * Interest-free lending powered by collateral yield.
 */
contract JubileeLending is Pausable, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Loan {
        uint256 id;
        address borrower;
        address collateralAsset;
        uint256 collateralAmount;
        uint256 borrowedAmount; // in USDi (assuming stablecoin lending)
        bool active;
    }

    ICollateralManager public collateralManager;
    IYieldRouter public yieldRouter;
    address public liquidationEngine;
    address public jUSDi; // The borrowed asset
    address public treasury; // Jubilee Protocol Treasury (Multisig)

    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public userLoans;
    mapping(address => uint256) public lastBorrowTime;
    uint256 public loanCounter;
    uint256 public totalBorrowed;
    uint256 public borrowCooldown = 1 minutes; // Configurable cooldown
    uint256 public maxBorrowPerTx = 100_000e18; // 100k jUSDi max per tx

    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        address collateralAsset,
        uint256 amount
    );
    event CollateralDeposited(uint256 indexed loanId, uint256 amount);
    event Borrowed(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount
    );
    event Repaid(
        uint256 indexed loanId,
        address indexed repayer,
        uint256 amount
    );
    event CollateralWithdrawn(uint256 indexed loanId, uint256 amount);
    event Liquidated(
        uint256 indexed loanId,
        address indexed liquidator,
        uint256 amountRepaid,
        uint256 collateralSeized
    );
    event TreasuryUpdated(address indexed newTreasury);

    constructor(
        address _collateralManager,
        address _yieldRouter,
        address _jusdi,
        address _treasury
    ) {
        require(_collateralManager != address(0), "Invalid collateral manager"); // L-01
        require(_jusdi != address(0), "Invalid jUSDi"); // L-01
        require(_treasury != address(0), "Invalid treasury"); // L-01
        collateralManager = ICollateralManager(_collateralManager);
        yieldRouter = IYieldRouter(_yieldRouter);
        jUSDi = _jusdi;
        treasury = _treasury;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setLiquidationEngine(
        address _liquidationEngine
    ) external onlyOwner {
        liquidationEngine = _liquidationEngine;
    }

    function setYieldRouter(address _yieldRouter) external onlyOwner {
        yieldRouter = IYieldRouter(_yieldRouter);
    }

    function depositCollateral(
        address asset,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(
            collateralManager.collateralFactors(asset) > 0,
            "Unsupported asset"
        );

        // Transfer collateral from user
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        loanCounter++;
        loans[loanCounter] = Loan({
            id: loanCounter,
            borrower: msg.sender,
            collateralAsset: asset,
            collateralAmount: amount,
            borrowedAmount: 0,
            active: true
        });
        userLoans[msg.sender].push(loanCounter);

        emit LoanCreated(loanCounter, msg.sender, asset, amount);
    }

    function borrow(
        uint256 loanId,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");
        require(loan.borrower == msg.sender, "Not borrower");
        require(amount > 0, "Amount must be > 0");
        require(amount <= maxBorrowPerTx, "Exceeds max borrow per tx");
        require(
            block.timestamp >= lastBorrowTime[msg.sender] + borrowCooldown,
            "Borrow cooldown active"
        );

        lastBorrowTime[msg.sender] = block.timestamp;

        uint256 newBorrowedAmount = loan.borrowedAmount + amount;
        uint256 collateralValue = collateralManager.getCollateralValue(
            loan.collateralAsset,
            loan.collateralAmount
        );
        uint256 collateralFactor = collateralManager.getBoostedCollateralFactor(
            msg.sender,
            loan.collateralAsset
        );

        uint256 healthFactor = collateralManager.calculateHealthFactor(
            newBorrowedAmount,
            collateralValue,
            collateralFactor
        );
        require(healthFactor >= 1e18, "Insufficient health factor");

        loan.borrowedAmount = newBorrowedAmount;
        totalBorrowed += amount;

        IjUSDi(jUSDi).mint(msg.sender, amount);

        emit Borrowed(loanId, msg.sender, amount);
    }

    function repay(uint256 loanId, uint256 amount) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");
        require(amount > 0, "Amount must be > 0");

        uint256 actualRepayment = amount > loan.borrowedAmount
            ? loan.borrowedAmount
            : amount;

        IERC20(jUSDi).safeTransferFrom(
            msg.sender,
            address(this),
            actualRepayment
        );
        IjUSDi(jUSDi).burn(actualRepayment);

        loan.borrowedAmount -= actualRepayment;
        totalBorrowed -= actualRepayment;

        if (loan.borrowedAmount == 0) {
            // Loan fully repaid
        }

        emit Repaid(loanId, msg.sender, actualRepayment);
    }

    function withdrawCollateral(
        uint256 loanId,
        uint256 amount
    ) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");
        require(loan.borrower == msg.sender, "Not borrower");
        require(amount > 0, "Amount must be > 0");
        require(amount <= loan.collateralAmount, "Insufficient collateral");

        uint256 remainingCollateral = loan.collateralAmount - amount;
        if (loan.borrowedAmount > 0) {
            uint256 collateralValue = collateralManager.getCollateralValue(
                loan.collateralAsset,
                remainingCollateral
            );
            uint256 collateralFactor = collateralManager
                .getBoostedCollateralFactor(msg.sender, loan.collateralAsset);
            uint256 healthFactor = collateralManager.calculateHealthFactor(
                loan.borrowedAmount,
                collateralValue,
                collateralFactor
            );
            require(
                healthFactor >= 1e18,
                "Withdrawal would violate health factor"
            );
        }

        loan.collateralAmount = remainingCollateral;
        IERC20(loan.collateralAsset).safeTransfer(msg.sender, amount);

        if (loan.collateralAmount == 0 && loan.borrowedAmount == 0) {
            loan.active = false;
        }

        emit CollateralWithdrawn(loanId, amount);
    }

    // Function for YieldRouter to call
    function applyYieldRepayment(uint256 loanId, uint256 amount) external {
        require(msg.sender == address(yieldRouter), "Only yield router");
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");

        uint256 actualRepayment = amount > loan.borrowedAmount
            ? loan.borrowedAmount
            : amount;

        if (actualRepayment > 0) {
            IERC20(jUSDi).safeTransferFrom(
                msg.sender,
                address(this),
                actualRepayment
            );
            IjUSDi(jUSDi).burn(actualRepayment);

            loan.borrowedAmount -= actualRepayment;
            totalBorrowed -= actualRepayment;
        }

        emit Repaid(loanId, msg.sender, actualRepayment);
    }

    function liquidateLoan(
        uint256 loanId,
        address liquidator,
        uint256 debtToRepay // Liquidator specifies how much they want to repay
    ) external returns (uint256 collateralToLiquidator) {
        require(msg.sender == liquidationEngine, "Only liquidation engine");
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");

        // Ensure they don't repay more than owed
        if (debtToRepay > loan.borrowedAmount) {
            debtToRepay = loan.borrowedAmount;
        }

        // H-02 Fix: Partial Liquidation Support
        // We calculate collateral to seize based on the REPAID amount, not total debt.

        uint256 collateralPrice = collateralManager.getCollateralValue(
            loan.collateralAsset,
            1e18
        );
        // Bonus: 5% to Liquidator, 1% to Protocol Reserve (Total 6% penalty)
        uint256 liquidationBonus = 0.05e18;
        uint256 protocolFee = 0.01e18;
        uint256 totalPenalty = liquidationBonus + protocolFee;

        // valueToSeize = debtRepaid * (1 + penalty)
        uint256 valueToSeize = (debtToRepay * (1e18 + totalPenalty)) / 1e18;
        uint256 collateralSeized = (valueToSeize * 1e18) / collateralPrice;

        // Check if user has enough collateral for this specific repayment amount
        require(
            collateralSeized <= loan.collateralAmount,
            "Insufficient collateral for full liquidation"
        );

        // Split Seized Collateral
        uint256 valueToLiquidator = (debtToRepay * (1e18 + liquidationBonus)) /
            1e18;
        collateralToLiquidator = (valueToLiquidator * 1e18) / collateralPrice;
        uint256 collateralToProtocol = collateralSeized -
            collateralToLiquidator;

        // ── EFFECTS (state updates BEFORE external calls) ──
        loan.collateralAmount -= collateralSeized;
        loan.borrowedAmount -= debtToRepay;
        totalBorrowed -= debtToRepay;

        if (loan.borrowedAmount == 0 && loan.collateralAmount == 0) {
            loan.active = false;
        }

        // ── INTERACTIONS (external calls AFTER state updates) ──
        IERC20(jUSDi).safeTransferFrom(liquidator, address(this), debtToRepay);
        IjUSDi(jUSDi).burn(debtToRepay);
        IERC20(loan.collateralAsset).safeTransfer(
            liquidator,
            collateralToLiquidator
        );
        IERC20(loan.collateralAsset).safeTransfer(
            treasury,
            collateralToProtocol
        );

        emit Liquidated(loanId, liquidator, debtToRepay, collateralSeized);

        return collateralToLiquidator;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Checks if a user is healthy across all their loans.
     * Used by JUBLBoost to verify that unstaking doesn't cause liquidatability.
     */
    function isHealthy(address user) public view returns (bool) {
        uint256[] storage userLoanIds = userLoans[user];
        for (uint256 i = 0; i < userLoanIds.length; i++) {
            Loan storage loan = loans[userLoanIds[i]];
            if (!loan.active || loan.borrowedAmount == 0) continue;

            uint256 collateralValue = collateralManager.getCollateralValue(
                loan.collateralAsset,
                loan.collateralAmount
            );
            uint256 collateralFactor = collateralManager
                .getBoostedCollateralFactor(user, loan.collateralAsset);
            uint256 hf = collateralManager.calculateHealthFactor(
                loan.borrowedAmount,
                collateralValue,
                collateralFactor
            );

            if (hf < 1e18) return false;
        }
        return true;
    }
}
