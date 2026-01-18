import React from 'react';
import '../App.css';

const Navbar = ({ activeTab, setActiveTab, walletAddress, onConnect }) => {
  return (
    <div style={{display:'flex', justifyContent:'space-between', padding:'20px 40px', background:'#0d0e12', borderBottom:'1px solid #222'}}>
        <div style={{fontSize:'20px', fontWeight:'bold'}}>🦄 Uniswap V4 Demo</div>
        <div style={{background:'#191b1f', padding:'4px', borderRadius:'12px'}}>
            <button onClick={()=>setActiveTab('liquidity')} className={`btn-small ${activeTab==='liquidity'?'active':''}`} style={{background:activeTab==='liquidity'?'#2c2f36':'transparent'}}>Pools</button>
            <button onClick={()=>setActiveTab('swap')} className={`btn-small ${activeTab==='swap'?'active':''}`} style={{background:activeTab==='swap'?'#2c2f36':'transparent'}}>Swap</button>
        </div>
        <button onClick={onConnect} className="btn-small active">
            {walletAddress ? `${walletAddress.substring(0,6)}...${walletAddress.substring(38)}` : "Connect Wallet"}
        </button>
    </div>
  );
};
export default Navbar;