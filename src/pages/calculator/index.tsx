import React, { useState } from "react";
import Button from "./button";
import { GrayWhiteBorder } from "../../components/border";
import { KeyProp } from "./types";

const mainKeys: Array<Array<KeyProp>> = [
  [
    { text: "7", type: "num" },
    { text: "8", type: "num" },
    { text: "9", type: "num" },
    { text: "/", type: "op" },
    { text: "sqrt", type: "cmd" },
  ],
  [
    { text: "4", type: "num" },
    { text: "5", type: "num" },
    { text: "6", type: "num" },
    { text: "*", type: "op" },
    { text: "%", type: "op" },
  ],
  [
    { text: "1", type: "num" },
    { text: "2", type: "num" },
    { text: "3", type: "num" },
    { text: "-", type: "op" },
    { text: "1/x", type: "cmd" },
  ],
  [
    { text: "0", type: "num" },
    { text: "+/-", type: "cmd" },
    { text: ".", type: "op" },
    { text: "+", type: "op" },
    { text: "=", type: "cmd" },
  ],
];

const index: React.FC = () => {
  const [input, setInput] = useState("");

  return (
    <div className="px-2 pb-2">
      <div className="flex flex-row space-x-2">
        <button className="font-sans text-sm active:opacity-60 focus:outline-none focus:ring-0">
          <span className="underline">E</span>dit
        </button>
        <button className="font-sans text-sm active:opacity-60 focus:outline-none focus:ring-0">
          <span className="underline">V</span>iew
        </button>
        <button className="font-sans text-sm active:opacity-60 focus:outline-none focus:ring-0">
          <span className="underline">H</span>elp
        </button>
      </div>

      <div className="my-2">
        <div className="w-full h-[2px] bg-primary opacity-50" />
        <div className="w-full h-[2px] bg-white opacity-50" />
      </div>

      <div className="relative w-full mb-2">
        <GrayWhiteBorder />
        <input
          placeholder="0."
          type="text"
          className="w-full px-2 py-1 font-sans text-right bg-white"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-5 gap-1">
        {mainKeys.map((rows) =>
          rows.map((item) => (
            <Button key={item.text} {...{ input, item, setInput }} />
          ))
        )}
      </div>
    </div>
  );
};

export default index;
