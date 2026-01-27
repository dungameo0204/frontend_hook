import { ethers } from 'ethers';
import { ADDRESSES } from '../constants'; // Đảm bảo import đúng đường dẫn

export const getSortedTokens = () => {
    const tA = ADDRESSES.TOKEN_A;
    const tB = ADDRESSES.TOKEN_B;
    
    // So sánh địa chỉ để sắp xếp (Case insensitive)
    return tA.toLowerCase() < tB.toLowerCase() 
        ? { currency0: tA, currency1: tB } 
        : { currency0: tB, currency1: tA };
};

export const createPoolKey = () => {
    const { currency0, currency1 } = getSortedTokens();
    
    return {
        currency0,
        currency1,
        fee: 3000,
        tickSpacing: 60,
        // QUAN TRỌNG: Phải lấy Hook từ file constants
        hooks: ADDRESSES.HOOK 
    };
};