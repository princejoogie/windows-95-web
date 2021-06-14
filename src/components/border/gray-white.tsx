import React from "react";

const grayWhite: React.FC = () => {
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-[2px] bg-primary" />
      <div className="absolute inset-y-0 left-0 w-[2px] bg-primary" />
      <div className="absolute inset-y-0 right-0 w-[2px] bg-white" />
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white" />
    </>
  );
};

export default grayWhite;
