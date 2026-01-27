import { ethers } from 'ethers';
import { ACTIONS } from '../constants';

export const encodeActions = (actions, params) => {
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(['uint8[]', 'bytes[]'], [actions, params]);
};

// 1. Hàm mã hóa lệnh MINT (Tạo NFT mới)
export const getMintParams = (poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, hookData) => {
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    // Struct khớp với ABI: (PoolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, owner, hookData)
    [
      'tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)',
      'int24', 'int24', 'uint256', 'uint128', 'uint128', 'address', 'bytes'
    ],
    [poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, hookData]
  );
};

// 2. Hàm mã hóa lệnh DECREASE (Rút thanh khoản)
export const getDecreaseParams = (tokenId, liquidity, amount0Min, amount1Min, hookData) => {
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ['uint256', 'uint256', 'uint128', 'uint128', 'bytes'],
    [tokenId, liquidity, amount0Min, amount1Min, hookData]
  );
};

// 3. Hàm mã hóa lệnh BURN (Đốt NFT sau khi rút hết)
export const getBurnParams = (tokenId, amount0Min, amount1Min, hookData) => {
    const abiCoder = new ethers.AbiCoder();
    return abiCoder.encode(
      ['uint256', 'uint128', 'uint128', 'bytes'],
      [tokenId, amount0Min, amount1Min, hookData]
    );
};