import React, { ReactElement, useEffect, useState } from "react";

type GameTypes = "snake" | "tic-tac-toe" | "";

type Game = {
  name: GameTypes;
  component: ReactElement;
};

interface Prop {
  setCurrentGame: React.Dispatch<React.SetStateAction<GameTypes>>;
}

const Snake: React.FC<Prop> = ({ setCurrentGame }) => {
  return (
    <div>
      <button onClick={() => setCurrentGame("")}>BACK</button>

      <h1>Snake Game</h1>
    </div>
  );
};

const TicTacToe: React.FC<Prop> = ({ setCurrentGame }) => {
  return (
    <div>
      <button onClick={() => setCurrentGame("")}>BACK</button>

      <h1>TicTacToe Game</h1>
    </div>
  );
};

const games: React.FC = () => {
  const [currentGame, setCurrentGame] = useState<GameTypes>("");
  const [index, setIndex] = useState(-1);

  const gameList: Game[] = [
    {
      name: "snake",
      component: <Snake setCurrentGame={setCurrentGame} />,
    },
    {
      name: "tic-tac-toe",
      component: <TicTacToe setCurrentGame={setCurrentGame} />,
    },
  ];

  useEffect(() => {
    const i = gameList.findIndex((e) => e.name === currentGame);
    setIndex(i);
  }, [currentGame]);

  return (
    <div>
      {!currentGame
        ? gameList.map((game) => (
            <button onClick={() => setCurrentGame(game.name)}>
              {game.name}
            </button>
          ))
        : index !== -1 && gameList[index].component}
    </div>
  );
};

export default games;
