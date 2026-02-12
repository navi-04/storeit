import React from 'react';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-copyright">
          © {new Date().getFullYear()} <a href="https://fewinfos.com" target="_blank" rel="noopener noreferrer">fewinfos</a>. All rights reserved.
        </div>
        <div className="footer-author">
          Developed by <a href="https://github.com/navi-04" target="_blank" rel="noopener noreferrer">navi-04</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
