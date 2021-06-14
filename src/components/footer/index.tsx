import React, { useEffect, useState } from "react";
import { startIcon } from "../../assets";
import { WhiteBlackBorder, GrayWhiteBorder } from "../border";

const footer: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getTime = (time: Date): string => {
    var hours = time.getHours();
    var minutes: any = time.getMinutes();
    var ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? "0" + minutes : minutes;
    var strTime = hours + ":" + minutes + " " + ampm;
    return strTime;
  };

  return (
    <footer className="flex flex-row items-center justify-between w-full h-12 p-1 border-t-2 border-white bg-secondary ">
      <button className="relative flex flex-row items-center h-full px-2 py-1 select-none active:opacity-60 focus:outline-none focus:ring-0">
        <WhiteBlackBorder />
        <img src={startIcon} alt={startIcon} className="h-full" />
        <p className="ml-1 font-sans text-lg font-semibold text-black">Start</p>
      </button>

      <div className="relative flex flex-row items-center h-full px-2 py-1 select-none">
        <GrayWhiteBorder />
        <p className="font-sans">{getTime(time)}</p>
      </div>
    </footer>
  );
};

export default footer;
