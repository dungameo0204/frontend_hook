export const ADDRESSES = {
    // Core Uniswap V4
    POOL_MANAGER: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543", 
    MODIFY_LIQUIDITY_ROUTER: "0x0C478023803a644c94c4CE1C1e7b9A087e411B0A", 
    SWAP_ROUTER: "0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe",
    
    // Contracts của bạn
    HOOK: "0x3db1d799191009c27a88d5ea3c34eaccec41bfc0", 
    POOL_READER: "0xaf60b5ad63380f6998dadfc6175a3baaccf2b682", 
    POSITION_MANAGER: "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4",

    // Tokens
    TOKEN_A: "0x304Ff272DdA5679F094f4901DDEd793181307677",
    TOKEN_B: "0xD35a09879ab006d10fb3e3eb3c78BAbA3D88C674",
    PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
};
export const ACTIONS = {
  MINT_POSITION: 4,
  DECREASE_LIQUIDITY: 2,
  SETTLE_PAIR: 7, // Trả tiền nợ (Nạp vào)
  TAKE_PAIR: 8,   // Nhận tiền về (Rút ra)
  BURN_POSITION: 6 // Đốt NFT (nếu rút hết)
};

export const ABIS = {
    ERC20: [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function balanceOf(address account) external view returns (uint256)"
    ],
    PERMIT2: [
        "function approve(address token, address spender, uint160 amount, uint48 expiration) external"
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
    ],
    POSITION_MANAGER: [
    // Hàm ghi (Write)
    "function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable",
    
    // Hàm đọc (Read) - ERC721 Standard
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    
    // Hàm đọc dữ liệu vị thế V4
    "function getPoolAndPositionInfo(uint256 tokenId) view returns ((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, (bytes25 poolId, int24 tickLower, int24 tickUpper, bool hasSubscriber) info)",
    "function getPositionLiquidity(uint256 tokenId) view returns (uint128 liquidity)",
    
    // Event để quét NFT
    "event Transfer(address indexed from, address indexed to, uint256 indexed id)"
  ]
};