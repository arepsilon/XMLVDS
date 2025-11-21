import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

const Header = () => {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo">
          <FileSpreadsheet size={32} />
          <h1>XMLVDS - Tableau Data Extractor</h1>
        </div>
        <div className="header-info">
          <span className="version">v1.0.0</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
