import React, { useEffect, useState } from "react";
import { startIcon } from "../../assets";

const footer: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getTime = (time: Date): string => {
    const hour = time.getHours();
    const min = time.getMinutes();
    return "1:42 PM";
  };

  return (
    <footer className="flex flex-row items-center justify-between w-full h-12 p-1 border-t-2 border-white bg-secondary ">
      <button className="relative flex flex-row items-center h-full px-2 py-1 select-none active:opacity-60 focus:outline-none focus:ring-0">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-white" />
        <div className="absolute inset-y-0 left-0 w-[2px] bg-white" />
        <div className="absolute inset-y-0 right-0 w-[2px] bg-black" />
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-black" />
        <img src={startIcon} alt={startIcon} className="h-full" />
        <p className="ml-1 font-sans text-lg font-semibold text-black">Start</p>
      </button>

      <div className="relative flex flex-row items-center h-full px-2 py-1 select-none">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-primary" />
        <div className="absolute inset-y-0 left-0 w-[2px] bg-primary" />
        <div className="absolute inset-y-0 right-0 w-[2px] bg-white" />
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white" />
        <p className="font-sans">{getTime(time)}</p>
      </div>
    </footer>
  );
};

export default footer;
