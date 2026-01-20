import React from 'react';

const Navbar = ({ walletAddress, onConnect, activeTab, setActiveTab }) => {
  
  // Hàm rút gọn địa chỉ ví (Ví dụ: 0x123...abcd)
  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const styles = {
    nav: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 32px',
      background: 'rgba(19, 21, 26, 0.7)', // Màu nền tối có độ trong suốt
      backdropFilter: 'blur(12px)',         // Hiệu ứng làm mờ nền sau (Glassmorphism)
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    },
    logoContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      cursor: 'pointer',
    },
    logoText: {
      fontSize: '20px',
      fontWeight: '800',
      background: 'linear-gradient(to right, #fff, #999)', // Chữ chuyển màu bạc
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontFamily: "'Inter', sans-serif",
      letterSpacing: '-0.5px'
    },
    unicorn: {
        fontSize: '24px'
    },
    // Khu vực Tab chuyển đổi (Pools | Swap)
    tabContainer: {
      background: '#191b1f',
      padding: '4px',
      borderRadius: '20px',
      display: 'flex',
      border: '1px solid #2c2f36'
    },
    tabButton: (isActive) => ({
      padding: '8px 24px',
      borderRadius: '16px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '15px',
      fontWeight: '600',
      background: isActive ? '#2c2f36' : 'transparent', // Tab đang chọn sẽ sáng hơn
      color: isActive ? '#fff' : '#98a1c0',             // Tab ẩn sẽ màu xám
      transition: 'all 0.2s ease',
    }),
    
    // Nút Connect Wallet
    connectBtn: {
      background: walletAddress ? 'rgba(255, 0, 122, 0.15)' : 'linear-gradient(90deg, #ff007a 0%, #ff4db8 100%)',
      color: walletAddress ? '#ff007a' : 'white',
      border: walletAddress ? '1px solid rgba(255, 0, 122, 0.4)' : 'none',
      padding: '10px 20px',
      borderRadius: '18px',
      fontWeight: '600',
      fontSize: '15px',
      cursor: 'pointer',
      transition: 'opacity 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    dot: {
        width: '8px',
        height: '8px',
        background: '#4caf50',
        borderRadius: '50%',
        display: walletAddress ? 'block' : 'none'
    }
  };

  return (
    <nav style={styles.nav}>
      {/* 1. Logo */}
      <div style={styles.logoContainer}>
        <span style={styles.unicorn}>🦄</span>
        <span style={styles.logoText}>Incentive Hook</span>
      </div>

      {/* 2. Tabs Switcher (Giữa) */}
      <div style={styles.tabContainer}>
        <button 
            style={styles.tabButton(activeTab === 'pools')} 
            onClick={() => setActiveTab('pools')}
        >
            Pools
        </button>
        <button 
            style={styles.tabButton(activeTab === 'swap')} 
            onClick={() => setActiveTab('swap')}
        >
            Swap
        </button>
      </div>

      {/* 3. Connect Wallet Button (Phải) */}
      <button style={styles.connectBtn} onClick={onConnect}>
        <div style={styles.dot}></div>
        {walletAddress ? formatAddress(walletAddress) : "Connect Wallet"}
      </button>
    </nav>
  );
};

export default Navbar;