import React from "react";
import { WhiteBlackBorder } from "../../components/border";
import { KeyProp } from "./types";

interface buttonProps {
  item: KeyProp;
  color?: string;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
}

const button: React.FC<buttonProps> = ({
  color = "#1d1df5",
  item,
  setInput,
  input,
}) => {
  const handleClick = () => {
    if (item.type === "num" || item.type === "op") {
      setInput(input + item.text);
    } else {
      if (item.text === "=") {
        try {
          const ans = eval(input);
          setInput(`${ans}`);
        } catch (err) {
          setInput("Error");
          setTimeout(() => {
            setInput("");
          }, 1500);
        }
      } else if (item.text === "+/-") {
        if (!!input && input[0] === "-") setInput(input.substring(1));
        else setInput(`-${input}`);
      } else if (item.text === "sqrt") {
        try {
          const sq = Math.sqrt(parseFloat(input));
          if (!sq) {
            setInput("Error");
            setTimeout(() => {
              setInput(!sq ? "" : `${sq}`);
            }, 1500);
          } else {
            setInput(`${sq}`);
          }
        } catch (err) {
          setInput("");
        }
      } else if (item.text === "1/x") {
        const val = `(1/${input})`;
        try {
          const ans = eval(val);
          setInput(`${ans}`);
        } catch (err) {
          setInput("Error");
          setTimeout(() => {
            setInput("");
          }, 1500);
        }
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className="relative items-center justify-center h-8 max-w-[100px] px-3 bg-secondary active:opacity-60 focus:outline-none focus:ring-0"
    >
      <WhiteBlackBorder />

      <p className="font-bold" style={{ color }}>
        {item.text}
      </p>
    </button>
  );
};

export default button;
