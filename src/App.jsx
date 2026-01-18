import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import Navbar from './components/Navbar';
import Swap from './components/Swap';
import Liquidity from './components/Liquidity';

function App() {
  const [activeTab, setActiveTab] = useState('liquidity');
  const [walletAddress, setWalletAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  
  // LocalStorage cho Vị thế
  const [positions, setPositions] = useState(() => {
      try { const s = localStorage.getItem("positions"); return s ? JSON.parse(s) : []; } 
      catch { return []; }
  });
  useEffect(() => localStorage.setItem("positions", JSON.stringify(positions)), [positions]);

  const connectWallet = async () => {
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      const s = await p.getSigner();
      const a = await s.getAddress();
      setProvider(p); setSigner(s); setWalletAddress(a);
    } else alert("Install MetaMask");
  };

  useEffect(() => {
      const init = async () => {
          if(window.ethereum && (await window.ethereum.request({method:'eth_accounts'})).length > 0) connectWallet();
      }
      init();
  }, []);

  return (
    <div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} walletAddress={walletAddress} onConnect={connectWallet}/>
      <div className="app-container">
        {activeTab === 'swap' ? <Swap signer={signer} provider={provider}/> : 
         <Liquidity signer={signer} provider={provider} walletAddress={walletAddress} onConnect={connectWallet} positions={positions} setPositions={setPositions}/>
        }
      </div>
    </div>
  );
}
export default App;