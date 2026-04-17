import React from 'react';

export default function Logo({ className }: { className?: string }) {
  return (
    <img 
      src="/LOGO.png" 
      alt="Arul Jothi Auto Consulting" 
      className={className}
      referrerPolicy="no-referrer"
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        if (img.src.includes('/LOGO.png')) {
          img.src = "/LOGO1.png";
        } else if (img.src.includes('/LOGO1.png')) {
          img.src = "https://raw.githubusercontent.com/srisabarinathan2007/aruljothi/main/LOGO.png";
        } else {
          img.src = "https://picsum.photos/seed/car/200/200";
        }
      }}
    />
  );
}
