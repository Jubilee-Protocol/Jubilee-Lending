// Contract addresses for Base Sepolia V2
export const CONTRACTS = {
  wBTC: "0x2815d17EbF603899aae2917fF12C519D4dFE6Fec" as const,
  jUSDi: "0x3c2F7D11508F7C7D9E41eD38fa33CbEcd55f4A66" as const,
  JUBL: "0xEB70EFca1B973A06699B019677af0ed20B1Dd9F1" as const,
  BTCOracle: "0xef1318f2cb63122c2eaCe1d27c8CC779276967d9" as const,
  OracleAggregator: "0xba231f0ac0E64BAddaFDA14c5c9aA46F00Dc46cB" as const,
  CollateralManager: "0x7038573cf240F91D3aE2aC1bfF9E93bb38C6861F" as const,
  JubileeLending: "0x308BdECdF60339De562ADC6b097fEc166e8F5c08" as const,
  YieldRouter: "0x52719D9EC4599f8eaaF29eDaeb5032a3Ae692f52" as const,
  LiquidationEngine: "0x61117e61c496B664E34c10a89405f7e255D0AFE0" as const,
  JUBLBoost: "0x978E766eBd39Ff68bcfcC1f354c43793134ba4d1" as const,
  JUBLEmissions: "0x5621041428e189373Fa11049c51b3E6B7bA9288a" as const,
  ChoiceYield: "0xb910D598d6300Aa126b61191b4B5E1a3582d72e2" as const,
  FirstFruitsFund: "0x50b7f68651c3115443CFb89f63381A286cD0508f" as const,
  FeeCollector: "0x3eDbf4c88Bade91BbA48B971cD5DEC9c79d0C666" as const,
  EmergencyModule: "0x14E431331A2B719038d67DB2FCf5f9bA1b2586dC" as const,
  JubileeTimelock: "0xb10aE30983c574084fAAF9bAd7F05480EBd9F83c" as const,
};

// Minimal ABIs — only the functions we call from the frontend
export const LENDING_ABI = [
  "function depositCollateral(address asset, uint256 amount) external",
  "function borrow(uint256 loanId, uint256 amount) external",
  "function repay(uint256 loanId, uint256 amount) external",
  "function addCollateral(uint256 loanId, uint256 amount) external",
  "function withdrawCollateral(uint256 loanId, uint256 amount) external",
  "function loans(uint256) view returns (uint256 id, address borrower, address collateralAsset, uint256 collateralAmount, uint256 borrowedAmount, bool active)",
  "function loanCounter() view returns (uint256)",
  "function userLoans(address, uint256) view returns (uint256)",
  "function maxBorrowPerTx() view returns (uint256)",
] as const;

export const COLLATERAL_MANAGER_ABI = [
  "function getCollateralValue(address asset, uint256 amount) view returns (uint256)",
  "function calculateHealthFactor(uint256 borrowedValue, uint256 collateralValue, uint256 collateralFactor) pure returns (uint256)",
  "function getBoostedCollateralFactor(address user, address asset) view returns (uint256)",
  "function collateralFactors(address) view returns (uint256)",
] as const;

export const ORACLE_ABI = [
  "function getLatestPrice(address asset) view returns (uint256)",
] as const;

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

export const JUBL_BOOST_ABI = [
  "function stake(uint256 amount) external",
  "function unstake(uint256 amount) external",
  "function stakedBalance(address) view returns (uint256)",
  "function getBoostLevel(address user) view returns (uint256)",
] as const;

export const JUBL_EMISSIONS_ABI = [
  "function earned(address user) view returns (uint256)",
  "function claim() external",
  "function totalEmitted() view returns (uint256)",
  "function currentEmissionRate() view returns (uint256)",
] as const;

export const CHOICE_YIELD_ABI = [
  "function claimable(address user, address asset) view returns (uint256)",
  "function claim(address asset) external",
] as const;

export const TOKENS = {
  wBTC: { symbol: "wBTC", name: "Wrapped BTC", decimals: 18, address: CONTRACTS.wBTC },
  jUSDi: { symbol: "jUSDi", name: "Jubilee USD Index", decimals: 18, address: CONTRACTS.jUSDi },
  JUBL: { symbol: "JUBL", name: "Jubilee Token", decimals: 18, address: CONTRACTS.JUBL },
};
