export const ADDRESSES = {
    // Core Uniswap V4
    POOL_MANAGER: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543", 
    MODIFY_LIQUIDITY_ROUTER: "0x0C478023803a644c94c4CE1C1e7b9A087e411B0A", 
    SWAP_ROUTER: "0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe",
    
    // Contracts của bạn
    HOOK: "0x6516F826230fD1e14457A1DD1833F9Ad51aEFfc0", 
    POOL_READER: "0xaf60b5ad63380f6998dadfc6175a3baaccf2b682", 

    // Tokens
    TOKEN_A: "0x1EE88FcB5048e2Aa6125050EE9B5fB719C3BF95a",
    TOKEN_B: "0xC64Aa5AfFa3624a63E6ca054472608885c122Ade",
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
    POOL_READER: [
        "function getSlot0((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
    ]
};