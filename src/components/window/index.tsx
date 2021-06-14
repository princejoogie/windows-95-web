import React, { useState } from "react";
import Draggable from "react-draggable";
import { WhiteBlackBorder } from "../border";

interface props {
  windowTitle: string;
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
  icon?: string;
}

const window: React.FC<props> = ({
  windowTitle,
  visible,
  setVisible,
  icon,
  children,
}) => {
  const [zIndex, setZIndex] = useState(10);

  return (
    <Draggable handle=".handle">
      <div
        tabIndex={0}
        style={{ zIndex }}
        onFocus={() => setZIndex(999)}
        onBlur={() => setZIndex(10)}
        className="absolute cursor-default resize focus:outline-none focus:ring-0"
      >
        <div
          className={`p-[2px] flex flex-col relative min-w-[256px] min-h-[256px] bg-secondary resizable ${
            visible ? "block" : "hidden"
          }`}
        >
          <WhiteBlackBorder />
          <div className="flex flex-row items-center p-[2px] border-2 justify-between bg-blueAccent border-secondary handle select-none">
            <div className="flex flex-row items-center justify-center space-x-2">
              {icon && <img src={icon} alt={icon} className="w-6 h-6" />}
              <p className="font-sans font-bold text-white">{windowTitle}</p>
            </div>

            <button
              onClick={() => setVisible(false)}
              className="relative flex items-center justify-center w-6 h-6 bg-secondary active:opacity-60 focus:outline-none focus:ring-0"
            >
              <WhiteBlackBorder />
              <p className="font-mono font-bold">X</p>
            </button>
          </div>

          <div className="flex-1">{children}</div>
        </div>
      </div>
    </Draggable>
  );
};

export default window;
