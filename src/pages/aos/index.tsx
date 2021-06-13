import Aos from "aos";
import "aos/dist/aos.css";
import axios from "axios";
import React, { useEffect, useState } from "react";

const aos: React.FC = () => {
  const [users, setUsers] = useState<any>([]);

  console.log(users);

  useEffect(() => {
    (async () => {
      const {
        data: { results },
      } = await axios.get("https://randomuser.me/api/?results=100");
      setUsers(results);
    })();

    Aos.init({ duration: 500, easing: "ease-in-out" });
  }, []);

  return (
    <div className="w-full mx-auto mb-36 max-w-7xl">
      <h1 className="my-4 text-2xl text-center">Users</h1>

      <div className="flex flex-col items-center space-y-4">
        {users.map((user: any) => (
          <User user={user} />
        ))}
      </div>
    </div>
  );
};

interface UserProp {
  user: any;
}

const User: React.FC<UserProp> = ({ user }) => {
  return (
    <div
      data-aos="fade-right"
      className="flex space-x-2 rounded flex-row p-2 bg-white shadow w-[512px]"
    >
      <img
        src={user.picture.medium}
        className="w-20 h-20 rounded-full"
        alt={user.picture.medium}
      />
      <div className="flex-1 ">
        <div className="flex flex-row space-x-1 font-bold">
          <p>{user.name.title}</p>
          <p>{user.name.first}</p>
          <p>{user.name.last}</p>
        </div>
        <p>{user.email}</p>
        <div className="flex space-x-1 text-gray-600">
          <p>{user.location.street.number}</p>
          <p>{user.location.street.name}</p>
          <p>{user.location.city}</p>
          <p>{user.location.state}</p>
          <p>{user.location.country}</p>
        </div>
      </div>
    </div>
  );
};

export default aos;
