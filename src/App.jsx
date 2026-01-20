import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Navbar from './components/Navbar';       // <--- Import Navbar mới
import Liquidity from './components/Liquidity';
import Swap from './components/Swap';
import './styles/App.css';

function App() {
  const [activeTab, setActiveTab] = useState('pools'); // State quản lý tab đang mở
  const [walletAddress, setWalletAddress] = useState('');
  const [signer, setSigner] = useState(null);
  const [provider, setProvider] = useState(null);
  const [positions, setPositions] = useState([]);

  // Load lại vị thế từ LocalStorage khi mở web
  useEffect(() => {
    const saved = localStorage.getItem('positions');
    if (saved) setPositions(JSON.parse(saved));
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        setProvider(provider);
        setSigner(signer);
        setWalletAddress(await signer.getAddress());
      } catch (error) {
        console.error("User rejected connection");
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  return (
    <div>
      {/* Truyền activeTab và setActiveTab vào Navbar */}
      <Navbar 
        walletAddress={walletAddress} 
        onConnect={connectWallet} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      <div style={{ padding: '40px 20px' }}>
        {/* Hiển thị nội dung dựa trên Tab đang chọn */}
        {activeTab === 'pools' ? (
           <Liquidity 
             signer={signer} 
             provider={provider} 
             walletAddress={walletAddress} 
             onConnect={connectWallet}
             positions={positions}
             setPositions={setPositions}
           />
        ) : (
           <Swap 
             signer={signer} 
             provider={provider} 
           />
        )}
      </div>
    </div>
  );
}

export default App;