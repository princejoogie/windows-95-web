import React, { useState } from "react";

interface Props {
  name: string;
  icon: string;
  children({ visible, setVisible }: ChildProp): React.ReactElement;
}

interface ChildProp {
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const desktopItem: React.FC<Props> = ({ icon, name, children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <button
        onDoubleClick={() => setVisible(!visible)}
        className="flex flex-col items-center justify-center w-20 h-20 m-1 space-y-1 border-none active:opacity-60 focus:outline-none focus:ring-0"
      >
        <img src={icon} alt={icon} className="w-10 h-10" />
        <p className="font-sans text-xs text-white">{name}</p>
      </button>

      {children({ visible, setVisible })}
    </>
  );
};

export default desktopItem;
