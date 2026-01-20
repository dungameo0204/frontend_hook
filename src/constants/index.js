export const ADDRESSES = {
    // Core Uniswap V4
    POOL_MANAGER: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543", 
    MODIFY_LIQUIDITY_ROUTER: "0x0C478023803a644c94c4CE1C1e7b9A087e411B0A", 
    SWAP_ROUTER: "0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe",
    
    // Contracts của bạn
    HOOK: "0x3db1d799191009c27a88D5Ea3C34EaCcec41BFc0", 
    POOL_READER: "0xaf60b5ad63380f6998dadfc6175a3baaccf2b682", 

    // Tokens
    TOKEN_A: "0xbAF2A40E52745a008deD548A99D0B92550b54B64",
    TOKEN_B: "0xEb631ce13729Ad868D133cB42671061F128bf148",
};

export const ABIS = {
    ERC20: [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function balanceOf(address account) external view returns (uint256)"
    ],
    MODIFY_LIQUIDITY: [
        "function modifyLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external returns (int256 delta0, int256 delta1)"
    ],
    HOOK: [
        "function earned((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, int24 tickLower, int24 tickUpper, address owner, bytes32 salt) external view returns (uint256)"
    ],
    SWAP: [
        "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, (bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) external payable returns (int256 delta0, int256 delta1)"
    ],
    POOL_READER: [
        "function getSlot0((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
    ]
};