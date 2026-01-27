import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ADDRESSES, ABIS, ACTIONS } from '../constants';
import { getSortedTokens, createPoolKey } from '../utils/poolUtils';
import { encodeActions, getMintParams, getDecreaseParams, getBurnParams } from '../utils/encoder';
import '../styles/App.css';

const Liquidity = ({ signer, provider, walletAddress, onConnect }) => {
  // --- STATE GIAO DIỆN CŨ ---
  const [minPrice, setMinPrice] = useState('-120');
  const [maxPrice, setMaxPrice] = useState('60');
  const [amount, setAmount] = useState('1000');
  const [selectedToken, setSelectedToken] = useState(0); 
  const [calculatedOtherAmount, setCalculatedOtherAmount] = useState('0');
  const [liquidityToMint, setLiquidityToMint] = useState(0n);
  const [currentTick, setCurrentTick] = useState(null); 
  const [poolStatus, setPoolStatus] = useState("Loading..."); 
  
  // --- STATE LOGIC MỚI (NFT) ---
  const [positions, setPositions] = useState([]); // List NFT
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState({}); // Để hiện loading từng nút

  // --- 1. LẤY TICK & POOL DATA (Giữ nguyên) ---
  const fetchPoolData = async () => {
    try {
      let readProvider = provider;
      if (!readProvider && window.ethereum) readProvider = new ethers.BrowserProvider(window.ethereum);
      else if (!readProvider) readProvider = new ethers.JsonRpcProvider("https://eth-sepolia.public.blastapi.io"); // Fallback RPC

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

  // --- 2. TÍNH TOÁN LIQUIDITY (Giữ nguyên logic cũ để hiện UI) ---
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


  // ==========================================================
  // 🚀 LOGIC MỚI: QUÉT NFT TỪ BLOCKCHAIN
  // ==========================================================
  const scanPositions = async () => {
    if (!walletAddress || !provider) return;
    setIsScanning(true);
    try {
      const pmContract = new ethers.Contract(ADDRESSES.POSITION_MANAGER, ABIS.POSITION_MANAGER, provider);
      
      // 1. Quét sự kiện Transfer về ví này
      const filterTo = pmContract.filters.Transfer(null, walletAddress);
      const logs = await pmContract.queryFilter(filterTo, -50000); // Quét 50k block gần nhất

      const uniqueTokenIds = new Set();
      logs.forEach(log => uniqueTokenIds.add(log.args[2].toString()));

      const fetchedPositions = [];
      for (const tokenId of uniqueTokenIds) {
        try {
            // Check owner hiện tại (phòng khi đã chuyển đi)
            const owner = await pmContract.ownerOf(tokenId);
            if (owner.toLowerCase() !== walletAddress.toLowerCase()) continue;

            // Lấy Info
            const { poolKey, info } = await pmContract.getPoolAndPositionInfo(tokenId);
            const liquidity = await pmContract.getPositionLiquidity(tokenId);

            // Chỉ hiện nếu là Pool của cặp token hiện tại (để giao diện đỡ loạn)
            // (Bạn có thể bỏ check này nếu muốn hiện hết)
            const myTokens = getSortedTokens();
            if (poolKey.currency0.toLowerCase() !== myTokens.currency0.toLowerCase()) continue;

            if (liquidity > 0n) {
                fetchedPositions.push({
                    id: tokenId,
                    min: Number(info.tickLower),
                    max: Number(info.tickUpper),
                    liquidity: liquidity.toString(),
                    liquidityBn: liquidity, // Lưu BigInt để dùng khi rút
                    poolKey: poolKey,
                    reward: "Checking..." // Sẽ check sau
                });
            }
        } catch (err) { console.log("Skip token", tokenId); }
      }
      setPositions(fetchedPositions);
    } catch (e) { console.error("Scan error:", e); }
    setIsScanning(false);
  };

  // Quét mỗi khi connect ví
  useEffect(() => { scanPositions(); }, [walletAddress, provider]);


  // ==========================================================
  // 🚀 LOGIC MỚI: MINT POSITION (THAY VÌ MODIFY LIQUIDITY)
  // ==========================================================
 const handleMintPosition = async () => {
    if (!signer) return alert("Kết nối ví đi bro!");
    if (liquidityToMint === 0n) return alert("Thanh khoản = 0");

    setLoading(true);
    try {
      const pm = new ethers.Contract(ADDRESSES.POSITION_MANAGER, ABIS.POSITION_MANAGER, signer);
      const permit2 = new ethers.Contract(ADDRESSES.PERMIT2, ABIS.PERMIT2, signer); // <--- Contract Permit2
      const { currency0, currency1 } = getSortedTokens();
      
      const t0 = new ethers.Contract(currency0, ABIS.ERC20, signer);
      const t1 = new ethers.Contract(currency1, ABIS.ERC20, signer);
      
      // === BƯỚC 1: Approve Token cho thằng PERMIT2 (Không phải PositionManager) ===
      console.log("1. Approving Token -> Permit2...");
      // Check allowance xem approved chưa để đỡ tốn gas (ở đây mình cứ approve max cho chắc)
      await (await t0.approve(ADDRESSES.PERMIT2, ethers.MaxUint256)).wait();
      await (await t1.approve(ADDRESSES.PERMIT2, ethers.MaxUint256)).wait();

      // === BƯỚC 2: Bảo Permit2 cấp quyền cho PositionManager ===
      // Hàm approve của Permit2: approve(token, spender, amount, expiration)
      console.log("2. Permit2 Approving -> PositionManager...");
      const amountMax160 = (1n << 160n) - 1n; // Permit2 dùng uint160
      // Thời hạn: 30 ngày (tính bằng giây)
      const expiration = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); 

      // Cấp quyền cho Token 0
      await (await permit2.approve(currency0, ADDRESSES.POSITION_MANAGER, amountMax160, expiration)).wait();
      // Cấp quyền cho Token 1
      await (await permit2.approve(currency1, ADDRESSES.POSITION_MANAGER, amountMax160, expiration)).wait();

      // === BƯỚC 3: MINT (Giữ nguyên logic cũ) ===
      const poolKey = [currency0, currency1, 3000, 60, ADDRESSES.HOOK];
      const MAX_UINT128 = "340282366920938463463374607431768211455"; 
      
      console.log("Encoding & Minting...");
      const mintParams = getMintParams(
        poolKey,
        parseInt(minPrice),
        parseInt(maxPrice),
        liquidityToMint,
        MAX_UINT128, MAX_UINT128,
        walletAddress,
        "0x" 
      );

      const abiCoder = new ethers.AbiCoder();
      const settleParams = abiCoder.encode(['address', 'address'], [currency0, currency1]);

      const actions = [ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR];
      const params = [mintParams, settleParams];
      const unlockData = encodeActions(actions, params);

      const tx = await pm.modifyLiquidities(unlockData, Math.floor(Date.now()/1000) + 600);
      await tx.wait();
      
      alert("✅ Mint NFT thành công!");
      scanPositions(); 

    } catch (e) {
      console.error(e);
      alert("Lỗi: " + (e.reason || e.message));
    }
    setLoading(false);
  };


  // ==========================================================
  // 🚀 LOGIC MỚI: WITHDRAW (BURN NFT)
  // ==========================================================
  const handleRemove = async (pos) => {
    if (!confirm(`Rút thanh khoản và đốt NFT #${pos.id}?`)) return;
    setProcessingIds(prev => ({ ...prev, [pos.id]: 'remove' }));
    
    try {
      const pm = new ethers.Contract(ADDRESSES.POSITION_MANAGER, ABIS.POSITION_MANAGER, signer);
      
      // 1. Decrease Liquidity (Rút hết)
      const decreaseParams = getDecreaseParams(
        pos.id,
        pos.liquidityBn, // Amount to withdraw (All)
        0, 0, // Min out
        "0x"
      );

      // 2. Take Pair (Nhận tiền về ví)
      const abiCoder = new ethers.AbiCoder();
      const takeParams = abiCoder.encode(
        ['address', 'address', 'address'],
        [pos.poolKey.currency0, pos.poolKey.currency1, walletAddress]
      );

      // 3. Burn (Đốt xác NFT cho sạch)
      const burnParams = getBurnParams(pos.id, 0, 0, "0x");

      // Actions: DECREASE -> TAKE -> BURN
      const actions = [ACTIONS.DECREASE_LIQUIDITY, ACTIONS.TAKE_PAIR, ACTIONS.BURN_POSITION];
      const params = [decreaseParams, takeParams, burnParams];
      const unlockData = encodeActions(actions, params);

      const tx = await pm.modifyLiquidities(unlockData, Math.floor(Date.now()/1000) + 600);
      await tx.wait();

      alert("✅ Rút & Đốt NFT thành công!");
      scanPositions();

    } catch (e) {
      console.error(e);
      alert("Lỗi rút: " + (e.reason || e.message));
    }
    setProcessingIds(prev => ({ ...prev, [pos.id]: null }));
  };

  // Hàm check reward (Hook) cho NFT - Logic này giữ nguyên nhưng cần sửa params hook
  // Tạm thời để trống hoặc bạn update sau tùy logic Hook của bạn có support NFT ID không.
  // Với NFT, Owner trong hook sẽ là PositionManager, cần logic phức tạp hơn để claim.
  const checkReward = async (pos) => {
      alert("Tính năng Check Reward cho NFT đang cập nhật...");
  }


  // --- RENDER GIAO DIỆN CŨ ---
  return (
    <div className="app-layout" style={{ display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap' }}>
         {/* CỘT TRÁI: ADD LIQUIDITY (GIỮ NGUYÊN UI) */}
         <div className="uni-card" style={{ flex: '1', minWidth: '350px', maxWidth: '480px' }}>
            <h2>Add Liquidity (Mint NFT)</h2>
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
               <button className="btn-main" onClick={handleMintPosition} disabled={loading}>
                   {loading ? "Minting NFT..." : "Mint Position"}
               </button>
            }
         </div>

         {/* CỘT PHẢI: LIST POSITIONS (DỮ LIỆU TỪ BLOCKCHAIN) */}
         <div className="uni-card positions-card" style={{ flex: '1', minWidth: '350px', maxWidth: '480px' }}>
           <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
               <h3>Your NFTs</h3>
               <button onClick={scanPositions} className="btn-small" style={{fontSize:'12px'}}>
                   {isScanning ? "Scanning..." : "🔄 Refresh"}
               </button>
           </div>
           
           {!isScanning && positions.length === 0 && <div style={{textAlign:'center', color:'#888', padding:'20px'}}>Không tìm thấy NFT nào.</div>}
           
           {positions.map((pos) => (
             <div key={pos.id} className="position-item">
               <div className="pos-header">
                   <strong>NFT #{pos.id}</strong>
                   <span style={{fontSize:'12px', color:'#888'}}>Range: {pos.min} ↔ {pos.max}</span>
               </div>
               
               <div className="pos-details" style={{marginTop:'10px'}}>
                   <div className="pos-row">
                       <span>Liquidity:</span>
                       <span style={{fontFamily:'monospace'}}>{ethers.formatUnits(pos.liquidityBn, 18).substring(0,8)}...</span>
                   </div>
               </div>
               
               <div className="pos-actions" style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                   {/* Nút Check/Claim tạm ẩn vì logic Hook với NFT cần update Contract */}
                   <button className="btn-small" style={{ flex: 1, background: '#333' }} onClick={() => checkReward(pos)}>Check</button>
                   
                   <button 
                     className="btn-small" 
                     style={{ flex: 1, background: 'transparent', color: '#ff4d4d', border: '1px solid #ff4d4d' }} 
                     onClick={() => handleRemove(pos)} 
                     disabled={!!processingIds[pos.id]}
                   >
                       {processingIds[pos.id] === 'remove' ? 'Burning...' : 'Withdraw & Burn'}
                   </button>
               </div>
             </div>
           ))}
        </div>
    </div>
  );
};

export default Liquidity;