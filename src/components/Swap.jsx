import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ADDRESSES, ABIS } from '../constants';
import '../App.css';

const Swap = ({ signer, provider }) => {
  const [amount, setAmount] = useState('1');
  const [estimatedOut, setEstimatedOut] = useState('0.00');
  const [isZeroForOne, setIsZeroForOne] = useState(true);
  const [currentTick, setCurrentTick] = useState(null);
  const [loading, setLoading] = useState(false);

  const getSortedTokens = () => {
    const tA = ADDRESSES.TOKEN_A;
    const tB = ADDRESSES.TOKEN_B;
    return tA.toLowerCase() < tB.toLowerCase() ? { currency0: tA, currency1: tB, isALess: true } : { currency0: tB, currency1: tA, isALess: false };
  };

  useEffect(() => {
    if (!provider) return;
    const fetchTick = async () => {
        try {
            const { currency0, currency1 } = getSortedTokens();
            const reader = new ethers.Contract(ADDRESSES.POOL_READER, ABIS.POOL_READER, provider);
            const data = await reader.getSlot0({ currency0, currency1, fee: 3000, tickSpacing: 60, hooks: ADDRESSES.HOOK });
            setCurrentTick(Number(data.tick));
        } catch (e) {}
    };
    fetchTick();
    setInterval(fetchTick, 5000);
  }, [provider]);

  useEffect(() => {
    if(currentTick===null || !amount) return;
    const price = Math.pow(1.0001, currentTick);
    const val = parseFloat(amount);
    const { isALess } = getSortedTokens();
    
    let out = 0;
    if (isALess) out = isZeroForOne ? val * price : val / price;
    else out = isZeroForOne ? val * price : val / price;
    setEstimatedOut(out.toFixed(6));
  }, [amount, currentTick, isZeroForOne]);

  const handleSwap = async () => {
    if(!signer) return;
    setLoading(true);
    try {
        const { currency0, currency1, isALess } = getSortedTokens();
        const router = new ethers.Contract(ADDRESSES.SWAP_ROUTER, ABIS.SWAP, signer);
        
        const tokenAddr = isALess 
            ? (isZeroForOne ? ADDRESSES.TOKEN_A : ADDRESSES.TOKEN_B)
            : (isZeroForOne ? ADDRESSES.TOKEN_B : ADDRESSES.TOKEN_A);
            
        const t = new ethers.Contract(tokenAddr, ABIS.ERC20, signer);
        await (await t.approve(ADDRESSES.SWAP_ROUTER, ethers.MaxUint256)).wait();

        const paramZeroForOne = isALess ? isZeroForOne : !isZeroForOne;
        const params = {
            zeroForOne: paramZeroForOne,
            amountSpecified: ethers.parseEther(amount) * -1n,
            sqrtPriceLimitX96: paramZeroForOne ? BigInt("4295128740") : BigInt("1461446703485210103287273052203988822378723970341")
        };

        const tx = await router.swap([currency0, currency1, 3000, 60, ADDRESSES.HOOK], Object.values(params), { takeClaims: false, settleUsingBurn: false }, "0x");
        await tx.wait();
        alert("✅ Swap Success!");
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  return (
    <div style={{display:'flex', justifyContent:'center'}}>
        <div className="uni-card">
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2>Swap Tokens</h2>
                <span className="tick-badge">Tick: {currentTick}</span>
            </div>
            <div className="input-group">
                <span className="label-text">You Pay</span>
                <input className="uni-input" type="number" value={amount} onChange={e=>setAmount(e.target.value)} />
                <span style={{float:'right', marginTop:'-35px', marginRight:'10px', fontWeight:'bold'}}>{isZeroForOne ? 'TOKEN A' : 'TOKEN B'}</span>
            </div>
            <div style={{textAlign:'center', margin:'-15px 0 15px 0'}}>
                <button onClick={()=>setIsZeroForOne(!isZeroForOne)} className="btn-small" style={{background:'#222', color:'white'}}>↓</button>
            </div>
            <div className="input-group">
                <span className="label-text">Receive (Est.)</span>
                <input className="uni-input" type="text" readOnly value={estimatedOut} style={{color:'#888'}} />
                <span style={{float:'right', marginTop:'-35px', marginRight:'10px', fontWeight:'bold'}}>{isZeroForOne ? 'TOKEN B' : 'TOKEN A'}</span>
            </div>
            <button className="btn btn-primary" onClick={handleSwap} disabled={loading}>{loading ? "Swapping..." : "Swap Now"}</button>
        </div>
    </div>
  );
};
export default Swap;