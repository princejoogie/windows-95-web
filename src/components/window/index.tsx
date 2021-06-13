import React, { useState } from "react";
import Draggable from "react-draggable";

interface props {
  windowTitle: string;
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const window: React.FC<props> = ({ windowTitle, visible, setVisible }) => {
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
          <div className="absolute inset-x-0 top-0 h-[2px] bg-white" />
          <div className="absolute inset-y-0 left-0 w-[2px] bg-white" />
          <div className="absolute inset-y-0 right-0 w-[2px] bg-black" />
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-black" />

          <div className="flex flex-row items-center p-[2px] border-2 justify-between bg-blueAccent border-secondary handle select-none">
            <p className="font-sans font-bold text-white">{windowTitle}</p>

            <button
              onClick={() => setVisible(false)}
              className="relative flex items-center justify-center w-6 h-6 bg-secondary active:opacity-60 focus:outline-none focus:ring-0"
            >
              <div className="absolute inset-x-0 top-0 h-[2px] bg-white" />
              <div className="absolute inset-y-0 left-0 w-[2px] bg-white" />
              <div className="absolute inset-y-0 right-0 w-[2px] bg-black" />
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-black" />
              <p className="font-mono font-bold">X</p>
            </button>
          </div>
        </div>
      </div>
    </Draggable>
  );
};

export default window;
