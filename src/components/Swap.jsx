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

  // --- LOGIC GIỮ NGUYÊN ---
  const getSortedTokens = () => {
    const tA = ADDRESSES.TOKEN_A;
    const tB = ADDRESSES.TOKEN_B;
    return tA.toLowerCase() < tB.toLowerCase() 
        ? { currency0: tA, currency1: tB, isALess: true } 
        : { currency0: tB, currency1: tA, isALess: false };
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
    const interval = setInterval(fetchTick, 5000);
    return () => clearInterval(interval);
  }, [provider]);

  useEffect(() => {
    if(currentTick===null || !amount) return;
    const price = Math.pow(1.0001, currentTick);
    const val = parseFloat(amount);
    
    // Logic tính giá đơn giản (để hiển thị ước tính)
    let out = 0;
    // Lưu ý: Logic giá này phụ thuộc vào Tick hiện tại, trong thực tế cần chính xác hơn
    // Nhưng với demo thì tạm chấp nhận P = 1.0001^tick
    if (isZeroForOne) {
        // Đổi T0 -> T1
        out = val * price; // (hoặc / price tùy thuộc vào cách sort token của bạn, ở đây giả sử thuận)
    } else {
        // Đổi T1 -> T0
        out = val / price;
    }
    setEstimatedOut(out.toFixed(6));
  }, [amount, currentTick, isZeroForOne]);

  const handleSwap = async () => {
    if(!signer) return alert("Please connect wallet");
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

  // --- STYLES MỚI (INLINE CHO GỌN) ---
  const styles = {
    container: { display: 'flex', justifyContent: 'center', paddingTop: '20px' },
    card: { width: '400px', padding: '12px', borderRadius: '16px', background: '#13151a', border: '1px solid #222', boxShadow: '0 0 20px rgba(0,0,0,0.3)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 8px' },
    title: { margin: 0, fontSize: '18px', fontWeight: 600, color: 'white' },
    tickBadge: { fontSize: '12px', background:'#1a3b1a', color: '#4caf50', padding: '4px 8px', borderRadius: '8px', fontFamily: 'monospace' },
    
    inputBox: { background: '#1b1e24', borderRadius: '12px', padding: '16px', marginBottom: '4px', border: '1px solid #292c33' },
    label: { fontSize: '13px', color: '#98a1c0', marginBottom: '8px', display: 'block' },
    inputRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    input: { background: 'transparent', border: 'none', fontSize: '28px', color: 'white', width: '60%', outline: 'none', padding: 0 },
    tokenBadge: { background: '#ff007a', padding: '6px 12px', borderRadius: '16px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px', boxShadow: '0 2px 8px rgba(255, 0, 122, 0.4)' },
    tokenBadgeInactive: { background: '#2c2f36', padding: '6px 12px', borderRadius: '16px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px', border: '1px solid #444' },
    
    switchContainer: { height: '0px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    switchBtn: { width: '32px', height: '32px', borderRadius: '50%', background: '#222', border: '4px solid #13151a', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px' },
    
    mainBtn: { width: '100%', padding: '16px', marginTop: '10px', borderRadius: '16px', border: 'none', background: '#ff007a', color: 'white', fontSize: '18px', fontWeight: 600, cursor: 'pointer' }
  };

  return (
    <div style={styles.container}>
        <div style={styles.card}>
            {/* Header */}
            <div style={styles.header}>
                <h2 style={styles.title}>Swap</h2>
                <span style={styles.tickBadge}>Tick: {currentTick ?? '...'}</span>
            </div>

            {/* INPUT 1: YOU PAY */}
            <div style={styles.inputBox}>
                <span style={styles.label}>You pay</span>
                <div style={styles.inputRow}>
                    <input 
                        style={styles.input} 
                        type="number" 
                        placeholder="0"
                        value={amount} 
                        onChange={e=>setAmount(e.target.value)} 
                    />
                    <div style={styles.tokenBadge}>
                         {/* Icon giả lập */}
                        <div style={{width:'20px', height:'20px', background:'white', borderRadius:'50%'}}></div>
                        {isZeroForOne ? 'TOKEN A' : 'TOKEN B'}
                    </div>
                </div>
                <div style={{fontSize:'12px', color:'#555', marginTop:'5px'}}>$ --</div>
            </div>

            {/* SWITCH BUTTON (Nằm giữa 2 ô) */}
            <div style={styles.switchContainer}>
                <button style={styles.switchBtn} onClick={()=>setIsZeroForOne(!isZeroForOne)}>↓</button>
            </div>

            {/* INPUT 2: RECEIVE */}
            <div style={styles.inputBox}>
                <span style={styles.label}>You receive</span>
                <div style={styles.inputRow}>
                    <input 
                        style={{...styles.input, color: '#888'}} 
                        type="text" 
                        readOnly 
                        value={estimatedOut} 
                        placeholder="0.00"
                    />
                    <div style={styles.tokenBadgeInactive}>
                        <div style={{width:'20px', height:'20px', background:'#555', borderRadius:'50%'}}></div>
                        {isZeroForOne ? 'TOKEN B' : 'TOKEN A'}
                    </div>
                </div>
                <div style={{fontSize:'12px', color:'#555', marginTop:'5px'}}>$ --</div>
            </div>

            {/* ACTION BUTTON */}
            <button 
                style={{...styles.mainBtn, opacity: loading ? 0.7 : 1}} 
                onClick={handleSwap} 
                disabled={loading}
            >
                {loading ? "Swapping..." : "Swap"}
            </button>
        </div>
    </div>
  );
};
export default Swap;