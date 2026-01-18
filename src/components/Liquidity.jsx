import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ADDRESSES, ABIS } from '../constants';
import { getSortedTokens, createPoolKey, getPoolId } from '../utils/poolUtils';
import '../styles/App.css';

const Liquidity = ({ signer, provider, walletAddress, onConnect, positions, setPositions }) => {
  const [minPrice, setMinPrice] = useState('-120');
  const [maxPrice, setMaxPrice] = useState('60');
  const [amount, setAmount] = useState('1000');
  const [selectedToken, setSelectedToken] = useState(0); 
  const [calculatedOtherAmount, setCalculatedOtherAmount] = useState('0');
  const [liquidityToMint, setLiquidityToMint] = useState(0n);
  const [currentTick, setCurrentTick] = useState(null); 
  const [poolStatus, setPoolStatus] = useState("Loading..."); 
  
  // FIX: Salt cố định
  const POSITION_NAME = 'lp1'; 
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState({});

  // ... (Giữ nguyên các hàm fetchPoolData, calculateLiquidityAndPair, getSortedTokens như cũ) ...
  // Để gọn code, tôi chỉ viết lại 2 hàm quan trọng nhất cần debug là handleAddLiquidity và checkReward

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
      // (Giữ nguyên logic tính toán như code trước để ko làm loãng debug)
      // ... Copy lại logic tính toán từ code trước ...
      // Để demo nhanh tôi tạm bỏ qua chi tiết hàm này trong hiển thị, nhưng bạn cứ giữ nguyên logic cũ nhé.
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


  // =================================================================================
  // 🔍 PHẦN QUAN TRỌNG: DEBUG LOGGING
  // =================================================================================

  // --- 3. ADD LIQUIDITY (LOG CHI TIẾT) ---
  const handleAddLiquidity = async () => {
    if (!signer) return alert("Vui lòng kết nối ví!");
    setLoading(true);
    try {
      const { currency0, currency1 } = getSortedTokens();
      const routerAddress = ADDRESSES.MODIFY_LIQUIDITY_ROUTER;
      
      const t0 = new ethers.Contract(currency0, ABIS.ERC20, signer);
      const t1 = new ethers.Contract(currency1, ABIS.ERC20, signer);
      await (await t0.approve(routerAddress, ethers.MaxUint256)).wait();
      await (await t1.approve(routerAddress, ethers.MaxUint256)).wait();

      const abiCoder = new ethers.AbiCoder();
      
      // 1. TẠO SALT
      const salt = ethers.keccak256(abiCoder.encode(["string"], [POSITION_NAME]));
      
      // 2. CHUẨN BỊ PARAMS
      const tickLower = parseInt(minPrice);
      const tickUpper = parseInt(maxPrice);
      const paramsArray = [tickLower, tickUpper, liquidityToMint, salt];
      const poolKey = [currency0, currency1, 3000, 60, ADDRESSES.HOOK];

      console.log("\n🔵 --- BẮT ĐẦU ADD LIQUIDITY ---");
      console.log("1. Router Address (Msg.Sender sẽ là cái này):", routerAddress);
      console.log("2. Pool Key:", { currency0, currency1, fee: 3000, spacing: 60, hook: ADDRESSES.HOOK });
      console.log("3. Tick Lower:", tickLower);
      console.log("4. Tick Upper:", tickUpper);
      console.log("5. Salt (Bytes32):", salt);
      console.log("   -> Salt được tạo từ chuỗi:", POSITION_NAME);
      console.log("6. Liquidity Delta:", liquidityToMint.toString());
      console.log("----------------------------------\n");

      const router = new ethers.Contract(routerAddress, ABIS.MODIFY_LIQUIDITY, signer);
      
      // Gửi Tx
      const tx = await router.modifyLiquidity(poolKey, paramsArray, "0x");
      console.log("⏳ Transaction sent:", tx.hash);
      await tx.wait();
      console.log("✅ Transaction confirmed!");
      
      const newPos = {
        id: Date.now(),
        min: minPrice, max: maxPrice,
        displayAmount0: selectedToken === 0 ? amount : calculatedOtherAmount,
        displayAmount1: selectedToken === 1 ? amount : calculatedOtherAmount,
        liquidityL: liquidityToMint.toString(), 
        salt: salt, // Lưu lại chính xác salt này
        reward: '0'
      };
      setPositions([newPos, ...positions]);
      localStorage.setItem('positions', JSON.stringify([newPos, ...positions]));
      alert("✅ Thành công! Hãy kiểm tra Console để xem Log.");
    } catch (e) { 
        console.error("❌ Add Liquidity Error:", e);
        alert("Lỗi: " + (e.reason || e.message)); 
    }
    setLoading(false);
  };

  // --- 4. CHECK REWARD (LOG CHI TIẾT) ---
  const checkReward = async (posId, pos) => {
    setProcessingIds(prev => ({ ...prev, [posId]: 'check' }));
    try {
      const hook = new ethers.Contract(ADDRESSES.HOOK, ABIS.HOOK, signer || provider);
      const { currency0, currency1 } = getSortedTokens();
      
      const owner = ADDRESSES.MODIFY_LIQUIDITY_ROUTER;
      const tickLower = parseInt(pos.min);
      const tickUpper = parseInt(pos.max);
      const salt = pos.salt;

      console.log("\n🟠 --- BẮT ĐẦU CHECK REWARD ---");
      console.log("1. Hook Address:", ADDRESSES.HOOK);
      console.log("2. Owner truyền vào (Router):", owner);
      console.log("3. Tick Lower:", tickLower);
      console.log("4. Tick Upper:", tickUpper);
      console.log("5. Salt lấy từ Storage:", salt);
      
      // Kiểm tra xem Salt có khớp không
      const expectedSalt = ethers.keccak256(new ethers.AbiCoder().encode(["string"], [POSITION_NAME]));
      if (salt !== expectedSalt) {
          console.warn("⚠️ CẢNH BÁO: Salt lưu trong Storage KHÁC với Salt tạo từ 'lp1'.");
          console.warn("   - Stored:", salt);
          console.warn("   - Re-calc:", expectedSalt);
      } else {
          console.log("✅ Salt khớp với công thức tạo từ 'lp1'");
      }
      
      console.log("👉 Đang gọi hàm hook.earned()...");

      const rewardBn = await hook.earned(
          [currency0, currency1, 3000, 60, ADDRESSES.HOOK], 
          tickLower, 
          tickUpper, 
          owner, 
          salt
      );
      
      const rewardFormatted = ethers.formatEther(rewardBn);
      console.log("✅ KẾT QUẢ REWARD:", rewardFormatted);
      console.log("----------------------------------\n");

      const updatedPositions = positions.map(p => 
          p.id === posId ? { ...p, reward: rewardFormatted } : p
      );
      setPositions(updatedPositions);
      localStorage.setItem('positions', JSON.stringify(updatedPositions));
    } catch (e) { 
        console.error("❌ Check Reward Error:", e);
        alert("Lỗi check reward. Xem Console để biết chi tiết.");
    }
    setProcessingIds(prev => ({ ...prev, [posId]: null }));
  };

  // --- 5. WITHDRAW ---
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
    <div className="app-layout">
         <div className="uni-card">
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
               <label>Amount</label>
               <div className="token-select">
                   <button className={selectedToken===0?'active':''} onClick={()=>setSelectedToken(0)}>Token 0</button>
                   <button className={selectedToken===1?'active':''} onClick={()=>setSelectedToken(1)}>Token 1</button>
               </div>
               <input type="number" value={amount} onChange={e=>setAmount(e.target.value)}/>
            </div>
            <div className="info-box">
                <div className="info-row"><span>Required T0:</span><strong>{selectedToken===0 ? amount : calculatedOtherAmount}</strong></div>
                <div className="info-row"><span>Required T1:</span><strong>{selectedToken===1 ? amount : calculatedOtherAmount}</strong></div>
            </div>
            {!walletAddress ? 
               <button className="btn-main" onClick={onConnect}>Connect Wallet</button> : 
               <button className="btn-main" onClick={handleAddLiquidity} disabled={loading}>{loading?"Processing...":"Add Liquidity"}</button>
            }
         </div>

         <div className="uni-card positions-card">
           <h3>Positions</h3>
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
               <div className="pos-actions">
                   <button className="btn-check" onClick={() => checkReward(pos.id, pos)} disabled={!!processingIds[pos.id]}>
                       {processingIds[pos.id] === 'check' ? 'Checking...' : 'Check Reward'}
                   </button>
                   <button className="btn-withdraw" onClick={() => handleRemoveLiquidity(pos.id, pos)} disabled={!!processingIds[pos.id]}>Rút</button>
               </div>
             </div>
           ))}
        </div>
    </div>
  );
};

export default Liquidity;