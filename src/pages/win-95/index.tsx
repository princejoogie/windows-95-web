import React from "react";
import { binEmptyIcon, myComputerIcon } from "../../assets";
import { Window, Footer, DesktopItem } from "../../components";

const win95: React.FC = () => {
  return (
    <div className="flex flex-col w-full h-screen overflow-hidden">
      <div className="relative flex-1 p-1 bg-primary">
        <DesktopItem name="My Computer" icon={myComputerIcon}>
          {({ visible, setVisible }) => {
            return (
              <Window
                {...{
                  visible,
                  setVisible,
                  windowTitle: "My Computer",
                }}
              />
            );
          }}
        </DesktopItem>

        <DesktopItem name="Recycle Bin" icon={binEmptyIcon}>
          {({ visible, setVisible }) => {
            return (
              <Window
                {...{
                  visible,
                  setVisible,
                  windowTitle: "Recycle Bin",
                }}
              />
            );
          }}
        </DesktopItem>
      </div>
      <Footer />
    </div>
  );
};

export default win95;
