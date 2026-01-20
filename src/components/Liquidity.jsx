import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ADDRESSES, ABIS } from '../constants';
import { getSortedTokens, createPoolKey } from '../utils/poolUtils';
import '../styles/App.css';

const Liquidity = ({ signer, provider, walletAddress, onConnect, positions, setPositions }) => {
  const [minPrice, setMinPrice] = useState('-60');
  const [maxPrice, setMaxPrice] = useState('60');
  const [amount, setAmount] = useState('1000');
  const [selectedToken, setSelectedToken] = useState(0); 
  const [calculatedOtherAmount, setCalculatedOtherAmount] = useState('0');
  const [liquidityToMint, setLiquidityToMint] = useState(0n);
  const [currentTick, setCurrentTick] = useState(null); 
  const [poolStatus, setPoolStatus] = useState("Loading..."); 
  
  const POSITION_NAME = 'lp1'; 
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState({});

  const getSortedTokens = () => {
    const tA = ADDRESSES.TOKEN_A;
    const tB = ADDRESSES.TOKEN_B;
    return tA.toLowerCase() < tB.toLowerCase() 
        ? { currency0: tA, currency1: tB } 
        : { currency0: tB, currency1: tA };
  };

  // --- 1. LẤY DATA ---
  const fetchPoolData = async () => {
    try {
      let readProvider = provider;
      if (!readProvider && window.ethereum) readProvider = new ethers.BrowserProvider(window.ethereum);
      else if (!readProvider) readProvider = new ethers.JsonRpcProvider("https://eth-sepolia.public.blastapi.io");

      const poolKey = createPoolKey();
      const reader = new ethers.Contract(ADDRESSES.POOL_READER, ABIS.POOL_READER, readProvider);
      const data = await reader.getSlot0(poolKey);
      
      if (data.sqrtPriceX96 === 0n) {
          setPoolStatus("Not Found");
          if (currentTick === null) setCurrentTick(0);
      } else {
          setPoolStatus("Active");
          if (Number(data.tick) !== currentTick) setCurrentTick(Number(data.tick));
      }
    } catch (e) { if (currentTick === null) setPoolStatus("Network Error"); }
  };

  useEffect(() => {
    fetchPoolData();
    const interval = setInterval(fetchPoolData, 5000);
    return () => clearInterval(interval);
  }, [provider]);

  // --- 2. MATH ---
  const calculateLiquidityAndPair = (val, isToken0Input, tickLowerStr, tickUpperStr) => {
      try {
        if (currentTick === null || !val || isNaN(parseFloat(val)) || parseFloat(val) === 0) return;
        const amountInput = parseFloat(val);
        const tickL = parseFloat(tickLowerStr);
        const tickU = parseFloat(tickUpperStr);
        const P = Math.sqrt(Math.pow(1.0001, currentTick));
        const Pl = Math.sqrt(Math.pow(1.0001, tickL));
        const Pu = Math.sqrt(Math.pow(1.0001, tickU));
        let L = 0, other = 0;
        if (currentTick < tickL) {
            if (isToken0Input) { L = amountInput * (Pl * Pu) / (Pu - Pl); other = 0; }
            else { L = 0; other = 0; }
        } else if (currentTick >= tickU) {
            if (!isToken0Input) { L = amountInput / (Pu - Pl); other = 0; }
            else { L = 0; other = 0; }
        } else {
            if (isToken0Input) { L = amountInput * (P * Pu) / (Pu - P); other = L * (P - Pl); }
            else { L = amountInput / (P - Pl); other = L * ((1/P) - (1/Pu)); }
        }
        if (isNaN(other)) other = 0;
        setCalculatedOtherAmount(other.toFixed(4));
        if (!isNaN(L) && isFinite(L) && L > 0) setLiquidityToMint(ethers.parseEther(L.toFixed(18)));
        else setLiquidityToMint(0n);
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
    calculateLiquidityAndPair(amount, selectedToken === 0, minPrice, maxPrice);
  }, [amount, minPrice, maxPrice, selectedToken, currentTick]);

  // --- 3. ADD LIQUIDITY (CÓ LOGIC CỘNG DỒN) ---
  const handleAddLiquidity = async () => {
    if (!signer) return alert("Vui lòng kết nối ví!");
    if (liquidityToMint === 0n) {
        alert("⚠️ Lỗi logic Uniswap: Khoảng giá này không chấp nhận Token bạn đang chọn.\n\n- Nếu khoảng giá < Tick hiện tại: Hãy chọn Token 1.\n- Nếu khoảng giá > Tick hiện tại: Hãy chọn Token 0.");
        return;
    }
    setLoading(true);
    try {
      const { currency0, currency1 } = getSortedTokens();
      const routerAddress = ADDRESSES.MODIFY_LIQUIDITY_ROUTER;
      const t0 = new ethers.Contract(currency0, ABIS.ERC20, signer);
      const t1 = new ethers.Contract(currency1, ABIS.ERC20, signer);
      await (await t0.approve(routerAddress, ethers.MaxUint256)).wait();
      await (await t1.approve(routerAddress, ethers.MaxUint256)).wait();

      const abiCoder = new ethers.AbiCoder();
      const salt = ethers.keccak256(abiCoder.encode(["string"], [POSITION_NAME]));
      
      const tickLower = parseInt(minPrice);
      const tickUpper = parseInt(maxPrice);
      const paramsArray = [tickLower, tickUpper, liquidityToMint, salt];
      const poolKey = [currency0, currency1, 3000, 60, ADDRESSES.HOOK];

      const router = new ethers.Contract(routerAddress, ABIS.MODIFY_LIQUIDITY, signer);
      
      console.log("Sending Tx...");
      const tx = await router.modifyLiquidity(poolKey, paramsArray, "0x");
      await tx.wait();
      
      // --- LOGIC CỘNG DỒN (MERGE) BẮT ĐẦU TỪ ĐÂY ---
      
      // 1. Chuẩn bị dữ liệu mới
      const amount0ToAdd = selectedToken === 0 ? amount : calculatedOtherAmount;
      const amount1ToAdd = selectedToken === 1 ? amount : calculatedOtherAmount;

      // 2. Tìm xem đã có vị thế nào trùng Tick chưa
      const existingIndex = positions.findIndex(p => p.min === minPrice && p.max === maxPrice);

      let updatedPositions;

      if (existingIndex !== -1) {
          // TRƯỜNG HỢP 1: Đã tồn tại -> Cộng dồn
          console.log("🔄 Phát hiện vị thế trùng, đang cộng dồn...");
          updatedPositions = [...positions];
          const oldPos = updatedPositions[existingIndex];

          updatedPositions[existingIndex] = {
              ...oldPos,
              // Cộng lượng token hiển thị (Parse float để cộng số, rồi toFixed lại string)
              displayAmount0: (parseFloat(oldPos.displayAmount0) + parseFloat(amount0ToAdd)).toFixed(4),
              displayAmount1: (parseFloat(oldPos.displayAmount1) + parseFloat(amount1ToAdd)).toFixed(4),
              // Cộng lượng Liquidity (Dùng BigInt vì số rất lớn)
              liquidityL: (BigInt(oldPos.liquidityL) + liquidityToMint).toString(),
              // Giữ nguyên reward cũ (hoặc reset tùy logic contract, ở đây giữ nguyên để check sau)
          };
      } else {
          // TRƯỜNG HỢP 2: Chưa tồn tại -> Thêm mới
          console.log("✨ Tạo vị thế mới...");
          const newPos = {
            id: Date.now(),
            min: minPrice, max: maxPrice,
            displayAmount0: amount0ToAdd,
            displayAmount1: amount1ToAdd,
            liquidityL: liquidityToMint.toString(), 
            salt: salt,
            reward: '0'
          };
          updatedPositions = [newPos, ...positions];
      }

      // 3. Lưu lại
      setPositions(updatedPositions);
      localStorage.setItem('positions', JSON.stringify(updatedPositions));
      
      alert("✅ Thành công!");
    } catch (e) { 
        console.error(e);
        alert("Lỗi: " + (e.reason || e.message)); 
    }
    setLoading(false);
  };

  // --- 4. CHECK REWARD ---
  const checkReward = async (posId, pos) => {
    setProcessingIds(prev => ({ ...prev, [posId]: 'check' }));
    try {
      const hook = new ethers.Contract(ADDRESSES.HOOK, ABIS.HOOK, signer || provider);
      const { currency0, currency1 } = getSortedTokens();
      const rewardBn = await hook.earned(
          [currency0, currency1, 3000, 60, ADDRESSES.HOOK], 
          parseInt(pos.min), parseInt(pos.max), ADDRESSES.MODIFY_LIQUIDITY_ROUTER, pos.salt
      );
      
      const rewardFormatted = ethers.formatEther(rewardBn);
      const updatedPositions = positions.map(p => 
          p.id === posId ? { ...p, reward: rewardFormatted } : p
      );
      setPositions(updatedPositions);
      localStorage.setItem('positions', JSON.stringify(updatedPositions));
    } catch (e) { console.error(e); }
    setProcessingIds(prev => ({ ...prev, [posId]: null }));
  };

  // --- 5. CLAIM REWARD ---
  const handleClaimReward = async (posId, pos) => {
    if (!signer) return alert("Vui lòng kết nối ví!");
    setProcessingIds(prev => ({ ...prev, [posId]: 'claim' }));
    try {
      const routerAddress = ADDRESSES.MODIFY_LIQUIDITY_ROUTER;
      const router = new ethers.Contract(routerAddress, ABIS.MODIFY_LIQUIDITY, signer);
      const { currency0, currency1 } = getSortedTokens();

      const abiCoder = new ethers.AbiCoder();
      const hookData = abiCoder.encode(["bool"], [true]);

      const paramsArray = [parseInt(pos.min), parseInt(pos.max), 0, pos.salt];
      const poolKey = [currency0, currency1, 3000, 60, ADDRESSES.HOOK];
      
      const tx = await router.modifyLiquidity(poolKey, paramsArray, hookData);
      await tx.wait();
      
      alert("✅ Rút thưởng thành công!");
      
      const updated = positions.map(p => p.id === posId ? { ...p, reward: '0.0000' } : p);
      setPositions(updated);
      localStorage.setItem('positions', JSON.stringify(updated));
    } catch (e) { alert("Lỗi: " + (e.reason || e.message)); }
    setProcessingIds(prev => ({ ...prev, [posId]: null }));
  };

  // --- 6. WITHDRAW ---
  const handleRemoveLiquidity = async (posId, pos) => {
    if (!confirm(`Rút vị thế này?`)) return;
    setProcessingIds(prev => ({ ...prev, [posId]: 'remove' }));
    try {
      const routerAddress = ADDRESSES.MODIFY_LIQUIDITY_ROUTER;
      const router = new ethers.Contract(routerAddress, ABIS.MODIFY_LIQUIDITY, signer);
      const { currency0, currency1 } = getSortedTokens();
      const paramsArray = [parseInt(pos.min), parseInt(pos.max), BigInt(pos.liquidityL) * -1n, pos.salt];
      
      const tx = await router.modifyLiquidity([currency0, currency1, 3000, 60, ADDRESSES.HOOK], paramsArray, "0x");
      await tx.wait();
      
      const remaining = positions.filter(p => p.id !== posId);
      setPositions(remaining);
      localStorage.setItem('positions', JSON.stringify(remaining));
      alert("✅ Rút thành công!");
    } catch (error) { alert("Lỗi: " + (error.reason || error.message)); }
    setProcessingIds(prev => ({ ...prev, [posId]: null }));
  };

  return (
    <div className="app-layout" style={{ display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap' }}>
         {/* CỘT TRÁI: ADD LIQUIDITY */}
         <div className="uni-card" style={{ flex: '1', minWidth: '350px', maxWidth: '480px' }}>
            <h2>Add Liquidity</h2>
            <div className="status-bar">
               Status: <span className={poolStatus === 'Active' ? 'status-active' : 'status-loading'}>{poolStatus}</span>
               <span className="tick-badge">Tick: {currentTick ?? '...'}</span>
            </div>
            <div className="input-row">
               <div className="input-group"><label>Min Tick</label><input type="number" value={minPrice} onChange={e=>setMinPrice(e.target.value)}/></div>
               <div className="input-group"><label>Max Tick</label><input type="number" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}/></div>
            </div>
            <div className="input-group">
               <label>Số lượng nạp</label>
               <div className="token-select">
                   <button className={selectedToken===0?'active':''} onClick={()=>setSelectedToken(0)}>Token 0</button>
                   <button className={selectedToken===1?'active':''} onClick={()=>setSelectedToken(1)}>Token 1</button>
               </div>
               <input type="number" value={amount} onChange={e=>setAmount(e.target.value)}/>
            </div>
            <div className="info-box">
                <div className="info-row"><span>Cần nạp T0:</span><strong>{selectedToken===0 ? amount : calculatedOtherAmount}</strong></div>
                <div className="info-row"><span>Cần nạp T1:</span><strong>{selectedToken===1 ? amount : calculatedOtherAmount}</strong></div>
            </div>
            {!walletAddress ? 
               <button className="btn-main" onClick={onConnect}>Kết nối ví</button> : 
               <button className="btn-main" onClick={handleAddLiquidity} disabled={loading}>{loading?"Đang xử lý...":"Thêm Thanh Khoản"}</button>
            }
         </div>

         {/* CỘT PHẢI: POSITIONS */}
         <div className="uni-card positions-card" style={{ flex: '1', minWidth: '350px', maxWidth: '480px' }}>
           <h3>Positions</h3>
           {positions.length === 0 && <div style={{textAlign:'center', color:'#888', padding:'20px'}}>Chưa có vị thế nào.</div>}
           {positions.map((pos) => (
             <div key={pos.id} className="position-item">
               <div className="pos-header">Range: {pos.min} → {pos.max}</div>
               <div className="pos-details">
                   <div className="pos-row"><span>T0:</span><span>{pos.displayAmount0}</span></div>
                   <div className="pos-row"><span>T1:</span><span>{pos.displayAmount1}</span></div>
               </div>
               <div className="pos-reward">
                   <span>Reward:</span><strong>{parseFloat(pos.reward||0).toFixed(4)} SC</strong>
               </div>
               
               <div className="pos-actions" style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                   <button className="btn-small" style={{ flex: 1, background: '#333', color: 'white', border:'1px solid #444' }} onClick={() => checkReward(pos.id, pos)} disabled={!!processingIds[pos.id]}>
                       {processingIds[pos.id] === 'check' ? '...' : 'Check'}
                   </button>
                   <button className="btn-small" style={{ flex: 2, background: '#4caf50', color: 'white', border:'none' }} onClick={() => handleClaimReward(pos.id, pos)} disabled={!!processingIds[pos.id]}>
                       {processingIds[pos.id] === 'claim' ? '...' : 'Claim Reward'}
                   </button>
                   <button className="btn-small" style={{ flex: 1, background: 'transparent', color: '#ff4d4d', border: '1px solid #ff4d4d' }} onClick={() => handleRemoveLiquidity(pos.id, pos)} disabled={!!processingIds[pos.id]}>
                       Rút
                   </button>
               </div>
             </div>
           ))}
        </div>
    </div>
  );
};

export default Liquidity;