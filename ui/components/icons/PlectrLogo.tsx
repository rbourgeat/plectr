
import Image from "next/image";

export const PlectrLogo = ({ size = 24, className = "" }: { size?: number, className?: string }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <Image 
        src="/plectr.svg" 
        alt="PLECTR" 
        width={size} 
        height={size}
        className="object-contain"
        priority
      />
    </div>
  );
};
