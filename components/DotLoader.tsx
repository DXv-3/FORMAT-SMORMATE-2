import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const DotLoader: React.FC = () => {
  return (
    <div className="w-6 h-6 flex items-center justify-center">
      <DotLottieReact
        src="https://lottie.host/d9df69bb-053a-4a1a-9e2c-c7b02b7c022b/xESyfeTKVy.lottie"
        loop
        autoplay
      />
    </div>
  );
};

export default DotLoader;
