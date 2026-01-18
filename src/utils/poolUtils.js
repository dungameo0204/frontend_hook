import { ethers } from 'ethers';
import { ADDRESSES } from '../constants';

// Sắp xếp Token A và Token B (Token có address nhỏ hơn đứng trước)
export const getSortedTokens = () => {
    const tA = ADDRESSES.TOKEN_A;
    const tB = ADDRESSES.TOKEN_B;
    return tA.toLowerCase() < tB.toLowerCase() 
        ? { currency0: tA, currency1: tB } 
        : { currency0: tB, currency1: tA };
};

// Logic tính Pool ID chuẩn Solidity: keccak256(abi.encode(...))
export const getPoolId = (key) => {
    const abiCoder = new ethers.AbiCoder();
    const encoded = abiCoder.encode(
        ['address', 'address', 'uint24', 'int24', 'address'],
        [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
    );
    return ethers.keccak256(encoded);
};

// Helper tạo struct PoolKey nhanh
export const createPoolKey = () => {
    const { currency0, currency1 } = getSortedTokens();
    return {
        currency0,
        currency1,
        fee: 3000,
        tickSpacing: 60,
        hooks: ADDRESSES.HOOK
    };
};