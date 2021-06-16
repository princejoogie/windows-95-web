import React from "react";
import {
  binEmptyIcon,
  calculatorIcon,
  gamesIcon,
  myComputerIcon,
} from "./assets";
import { DesktopItem, Window, Footer } from "./components";
import { Calculator, Games } from "./pages";

const win95: React.FC = () => {
  return (
    <div className="flex flex-col w-full h-screen overflow-hidden">
      <div className="relative flex-1 p-1 bg-primary">
        <DesktopItem name="Recycle Bin" icon={binEmptyIcon}>
          {({ visible, setVisible }) => {
            return (
              <Window
                {...{
                  visible,
                  setVisible,
                  windowTitle: "Recycle Bin",
                  icon: binEmptyIcon,
                }}
              />
            );
          }}
        </DesktopItem>

        <DesktopItem name="My Computer" icon={myComputerIcon}>
          {({ visible, setVisible }) => {
            return (
              <Window
                {...{
                  visible,
                  setVisible,
                  windowTitle: "My Computer",
                  icon: myComputerIcon,
                }}
              />
            );
          }}
        </DesktopItem>

        <DesktopItem name="Calculator" icon={calculatorIcon}>
          {({ visible, setVisible }) => {
            return (
              <Window
                {...{
                  visible,
                  setVisible,
                  windowTitle: "Calculator",
                  icon: calculatorIcon,
                }}
              >
                <Calculator />
              </Window>
            );
          }}
        </DesktopItem>

        <DesktopItem name="Games" icon={gamesIcon}>
          {({ visible, setVisible }) => {
            return (
              <Window
                {...{
                  visible,
                  setVisible,
                  windowTitle: "Games",
                  icon: gamesIcon,
                }}
              >
                <Games />
              </Window>
            );
          }}
        </DesktopItem>
      </div>
      <Footer />
    </div>
  );
};

export default win95;
