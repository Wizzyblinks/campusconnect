import { useCallback, useEffect, useState } from "react";

const campusBuildings = [
  {
    id: "gate",
    name: "Main Gate",
    icon: "🚪",
    description: "The main entrance to Ritman University.",
    x: 44,
    y: 86,
    width: 12,
    height: 10,
    color: "bg-slate-600",
  },
  {
    id: "security",
    name: "Security Post",
    icon: "🛡️",
    description: "Campus security and visitor checks.",
    x: 34,
    y: 85,
    width: 8,
    height: 8,
    color: "bg-amber-700",
  },
  {
    id: "admin",
    name: "Admin Block",
    icon: "🏢",
    description: "The university administrative centre.",
    x: 20,
    y: 27,
    width: 12,
    height: 12,
    color: "bg-blue-700",
  },
  {
    id: "gaab",
    name: "GAAB",
    icon: "🏫",
    description: "An academic building on campus.",
    x: 38,
    y: 24,
    width: 11,
    height: 12,
    color: "bg-indigo-700",
  },
  {
    id: "radio",
    name: "Radio Station",
    icon: "📻",
    description: "The university broadcasting station.",
    x: 54,
    y: 25,
    width: 9,
    height: 8,
    color: "bg-orange-600",
  },
  {
    id: "staff",
    name: "Staff Lodge",
    icon: "🏠",
    description: "Accommodation for university staff.",
    x: 68,
    y: 24,
    width: 9,
    height: 8,
    color: "bg-amber-700",
  },
  {
    id: "nas",
    name: "NAS Block",
    icon: "🏫",
    description: "An academic building.",
    x: 78,
    y: 43,
    width: 11,
    height: 12,
    color: "bg-purple-700",
  },
  {
    id: "vc",
    name: "VC Block",
    icon: "🏛️",
    description: "The Vice-Chancellor's administrative block.",
    x: 62,
    y: 43,
    width: 10,
    height: 10,
    color: "bg-rose-700",
  },
  {
    id: "girls-hostel",
    name: "Girls' Hostel",
    icon: "🏢",
    description: "Three-storey student accommodation.",
    x: 12,
    y: 57,
    width: 12,
    height: 13,
    color: "bg-pink-700",
  },
  {
    id: "auditorium",
    name: "University Auditorium",
    icon: "🏛️",
    description:
      "Attend university meetings, parties, ceremonies, shows, and special events.",
    x: 29,
    y: 56,
    width: 15,
    height: 13,
    color: "bg-fuchsia-700",
  },
  {
    id: "mall",
    name: "Campus Mall",
    icon: "🛍️",
    description:
      "Your campus shopping destination for groceries, clothes, accessories, and more.",
    x: 47,
    y: 57,
    width: 13,
    height: 12,
    color: "bg-emerald-700",
  },
  {
    id: "courts",
    name: "Courts",
    icon: "🏀",
    description: "Outdoor recreational and sporting spaces.",
    x: 66,
    y: 59,
    width: 10,
    height: 9,
    color: "bg-orange-700",
  },
  {
    id: "cafeteria",
    name: "Cafeteria",
    icon: "🍲",
    description: "Buy meals and refreshments.",
    x: 79,
    y: 68,
    width: 10,
    height: 9,
    color: "bg-yellow-700",
  },
  {
    id: "hospital",
    name: "RU Hospital",
    icon: "🏥",
    description: "The university hospital, housed in a bungalow.",
    x: 69,
    y: 80,
    width: 11,
    height: 8,
    color: "bg-red-700",
  },
  {
    id: "boys-hostel",
    name: "Boys' Hostel",
    icon: "🏢",
    description: "Three-storey student accommodation.",
    x: 83,
    y: 82,
    width: 12,
    height: 12,
    color: "bg-cyan-800",
  },
  {
    id: "poultry",
    name: "Poultry",
    icon: "🐔",
    description: "The university poultry area.",
    x: 12,
    y: 82,
    width: 10,
    height: 8,
    color: "bg-lime-800",
  },
];

const initialPlayer = {
  x: 50,
  y: 94,
};

export default function CampusLifeGame() {
  const [player, setPlayer] = useState(initialPlayer);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [insideBuilding, setInsideBuilding] = useState(null);
  const [virtualMoney, setVirtualMoney] = useState(5000);
  const [activityMessage, setActivityMessage] = useState(
    "Welcome to Campus Life!",
  );

  const movePlayer = useCallback((direction) => {
    const movement = {
      up: { x: 0, y: -2 },
      down: { x: 0, y: 2 },
      left: { x: -2, y: 0 },
      right: { x: 2, y: 0 },
    };

    const step = movement[direction];

    if (!step) {
      return;
    }

    setPlayer((current) => ({
      x: Math.max(3, Math.min(97, current.x + step.x)),
      y: Math.max(4, Math.min(96, current.y + step.y)),
    }));
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target;

      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
      ) {
        return;
      }

      const keys = {
        ArrowUp: "up",
        w: "up",
        W: "up",
        ArrowDown: "down",
        s: "down",
        S: "down",
        ArrowLeft: "left",
        a: "left",
        A: "left",
        ArrowRight: "right",
        d: "right",
        D: "right",
      };

      const direction = keys[event.key];

      if (direction) {
        event.preventDefault();
        movePlayer(direction);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [movePlayer]);

  function resetPlayer() {
    setPlayer(initialPlayer);
    setSelectedBuilding(null);
  }

  function enterBuilding(building) {
    if (!["auditorium", "mall"].includes(building.id)) {
      return;
    }

    setInsideBuilding(building);
    setActivityMessage(
      building.id === "auditorium"
        ? "Welcome to the University Auditorium!"
        : "Welcome to the Campus Mall!",
    );
  }

  function leaveBuilding() {
    setInsideBuilding(null);
    setActivityMessage("You have returned to the campus.");
  }

  function attendEvent(event) {
    setActivityMessage(`You are now attending: ${event}. Enjoy yourself!`);
  }

  function purchaseItem(item, price) {
    if (virtualMoney < price) {
      setActivityMessage(
        `You need ₦${price.toLocaleString()} to purchase ${item}.`,
      );
      return;
    }

    setVirtualMoney((money) => money - price);

    setActivityMessage(`You purchased ${item} for ₦${price.toLocaleString()}.`);
  }

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 to-green-700 p-5 text-white sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              🎮 CAMPUS LIFE SIMULATOR
            </span>

            <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">
              Explore Ritman University
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-green-100">
              Walk around campus, discover buildings, visit the auditorium, and
              explore the new campus mall.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-green-100">Your character</p>
            <p className="mt-1 font-bold">Student Explorer 🎓</p>
            <p className="mt-1 text-xs text-green-100">
              Virtual campus adventure
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-extrabold text-slate-900">
              Ritman University Map
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Use the arrow keys or W, A, S, D to move your character.
            </p>
          </div>

          <button
            type="button"
            onClick={resetPlayer}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset position
          </button>
        </div>

        <div
          className="relative mt-4 aspect-[4/5] overflow-hidden rounded-2xl border-4 border-emerald-900 bg-[#9bd18b] sm:aspect-[16/10]"
          aria-label="Interactive Ritman University campus map"
        >
          {/* Campus grass */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,#b9e7a0_0%,transparent_35%),radial-gradient(ellipse_at_80%_80%,#78bd73_0%,transparent_40%)]" />

          {/* Main horizontal road */}
          <div className="absolute left-0 top-[46%] h-[9%] w-full border-y-2 border-white/50 bg-slate-400">
            <div className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-yellow-200" />
          </div>

          {/* Main vertical road */}
          <div className="absolute bottom-0 left-[45%] top-0 w-[9%] border-x-2 border-white/50 bg-slate-400">
            <div className="absolute bottom-0 left-1/2 top-0 border-l-2 border-dashed border-yellow-200" />
          </div>

          {/* Walking paths */}
          <div className="absolute left-[8%] top-[38%] h-[5%] w-[84%] rounded-full bg-amber-100/90" />
          <div className="absolute left-[8%] top-[72%] h-[4%] w-[84%] rounded-full bg-amber-100/90" />
          <div className="absolute left-[28%] top-[12%] h-[75%] w-[3%] rounded-full bg-amber-100/90" />
          <div className="absolute left-[73%] top-[12%] h-[75%] w-[3%] rounded-full bg-amber-100/90" />

          {/* Football field */}
          <button
            type="button"
            onClick={() =>
              setSelectedBuilding({
                id: "football",
                name: "Football Field",
                icon: "⚽",
                description:
                  "Meet friends, play football, and enjoy campus sports.",
              })
            }
            className="absolute left-[5%] top-[5%] flex h-[13%] w-[25%] flex-col items-center justify-center rounded-xl border-2 border-white bg-green-600 text-white shadow-md transition hover:brightness-110"
          >
            <span className="text-xl sm:text-3xl">⚽</span>
            <span className="text-[9px] font-bold sm:text-xs">
              Football Field
            </span>
          </button>

          {/* Campus trees */}
          {[
            [7, 31],
            [10, 43],
            [17, 43],
            [24, 77],
            [36, 13],
            [58, 13],
            [85, 20],
            [92, 35],
            [91, 60],
            [61, 85],
            [34, 78],
            [8, 95],
          ].map(([x, y], index) => (
            <span
              key={index}
              className="pointer-events-none absolute z-[1] text-base sm:text-2xl"
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-hidden="true"
            >
              🌳
            </span>
          ))}

          {/* Campus buildings */}
          {campusBuildings.map((building) => (
            <button
              key={building.id}
              type="button"
              onClick={() => setSelectedBuilding(building)}
              aria-label={`Visit ${building.name}`}
              className={`absolute z-10 flex flex-col items-center justify-center rounded-lg border-2 border-white/80 px-0.5 text-white shadow-lg transition hover:z-20 hover:scale-105 hover:brightness-110 ${
                building.color
              } ${
                selectedBuilding?.id === building.id
                  ? "ring-4 ring-yellow-300"
                  : ""
              }`}
              style={{
                left: `${building.x}%`,
                top: `${building.y}%`,
                width: `${building.width}%`,
                height: `${building.height}%`,
              }}
            >
              <span className="text-base leading-tight sm:text-2xl">
                {building.icon}
              </span>

              <span className="mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[7px] font-extrabold leading-tight sm:text-[10px]">
                {building.name}
              </span>
            </button>
          ))}

          {/* Player character */}
          <div
            className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-100"
            style={{
              left: `${player.x}%`,
              top: `${player.y}%`,
            }}
            aria-label="Your player character"
          >
            <span className="rounded-full border-2 border-white bg-blue-700 px-2 py-1 text-xl shadow-lg sm:text-3xl">
              🧑‍🎓
            </span>

            <span className="mt-0.5 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[8px] font-bold text-white sm:text-[10px]">
              YOU
            </span>
          </div>

          {/* Map compass */}
          <div className="pointer-events-none absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-[9px] font-extrabold text-slate-700 shadow sm:text-xs">
            N ↑
          </div>
        </div>

        {/* Mobile movement controls */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">
              Movement controls
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Desktop: Arrow keys or W, A, S, D. Mobile: use the controls.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 self-center">
            <span />
            <button
              type="button"
              onClick={() => movePlayer("up")}
              aria-label="Move up"
              className="h-12 w-12 rounded-xl bg-slate-100 text-xl font-bold hover:bg-blue-100 active:bg-blue-200"
            >
              ↑
            </button>
            <span />

            <button
              type="button"
              onClick={() => movePlayer("left")}
              aria-label="Move left"
              className="h-12 w-12 rounded-xl bg-slate-100 text-xl font-bold hover:bg-blue-100 active:bg-blue-200"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() => movePlayer("down")}
              aria-label="Move down"
              className="h-12 w-12 rounded-xl bg-slate-100 text-xl font-bold hover:bg-blue-100 active:bg-blue-200"
            >
              ↓
            </button>

            <button
              type="button"
              onClick={() => movePlayer("right")}
              aria-label="Move right"
              className="h-12 w-12 rounded-xl bg-slate-100 text-xl font-bold hover:bg-blue-100 active:bg-blue-200"
            >
              →
            </button>
          </div>
        </div>
      </div>
      {/* Enterable Building Interior */}
      {insideBuilding && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div
            className={`p-6 text-white sm:p-8 ${
              insideBuilding.id === "auditorium"
                ? "bg-gradient-to-r from-fuchsia-800 to-purple-700"
                : "bg-gradient-to-r from-emerald-800 to-green-700"
            }`}
          >
            <button
              type="button"
              onClick={leaveBuilding}
              className="mb-5 rounded-xl bg-white/15 px-4 py-2 text-sm font-bold hover:bg-white/25"
            >
              ← Return to Campus
            </button>

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-white/75">
                  RITMAN UNIVERSITY
                </p>

                <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
                  {insideBuilding.icon} {insideBuilding.name}
                </h2>

                <p className="mt-2 text-sm text-white/80">
                  {insideBuilding.id === "auditorium"
                    ? "Meet, celebrate, learn, and enjoy campus events."
                    : "Explore shops and spend your virtual money."}
                </p>
              </div>

              <div className="rounded-2xl bg-white/15 p-4">
                <p className="text-xs text-white/75">Your virtual wallet</p>

                <p className="mt-1 text-xl font-extrabold">
                  ₦{virtualMoney.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Current activity
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-800">
                {activityMessage}
              </p>
            </div>

            {insideBuilding.id === "auditorium" && (
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Auditorium Events
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Choose an event to participate in.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    {
                      name: "School Meeting",
                      icon: "🎓",
                      description:
                        "Attend student meetings and university gatherings.",
                    },
                    {
                      name: "Campus Party",
                      icon: "🎉",
                      description:
                        "Socialise and enjoy a virtual campus party.",
                    },
                    {
                      name: "Award Ceremony",
                      icon: "🏆",
                      description: "Celebrate student achievements and awards.",
                    },
                    {
                      name: "Entertainment Show",
                      icon: "🎤",
                      description:
                        "Enjoy performances and campus entertainment.",
                    },
                  ].map((event) => (
                    <div
                      key={event.name}
                      className="rounded-2xl border border-slate-200 p-5 transition hover:border-purple-300 hover:bg-purple-50"
                    >
                      <span className="text-3xl">{event.icon}</span>

                      <h4 className="mt-3 font-extrabold text-slate-900">
                        {event.name}
                      </h4>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {event.description}
                      </p>

                      <button
                        type="button"
                        onClick={() => attendEvent(event.name)}
                        className="mt-4 w-full rounded-xl bg-purple-700 px-4 py-3 text-sm font-bold text-white hover:bg-purple-800"
                      >
                        Attend Event
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insideBuilding.id === "mall" && (
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Campus Mall Shops
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Choose an item to purchase with your virtual money.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {[
                    {
                      name: "T-Shirt",
                      icon: "👕",
                      price: 2500,
                      category: "Fashion",
                    },
                    {
                      name: "Sneakers",
                      icon: "👟",
                      price: 4000,
                      category: "Footwear",
                    },
                    {
                      name: "Backpack",
                      icon: "🎒",
                      price: 3000,
                      category: "Accessories",
                    },
                    {
                      name: "Groceries",
                      icon: "🛒",
                      price: 1500,
                      category: "Supermarket",
                    },
                    {
                      name: "Wristwatch",
                      icon: "⌚",
                      price: 2000,
                      category: "Accessories",
                    },
                    {
                      name: "Soft Drink",
                      icon: "🥤",
                      price: 500,
                      category: "Refreshments",
                    },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="rounded-2xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <div className="flex h-20 items-center justify-center rounded-xl bg-slate-50 text-4xl">
                        {item.icon}
                      </div>

                      <p className="mt-3 text-xs font-semibold text-emerald-700">
                        {item.category}
                      </p>

                      <h4 className="mt-1 font-extrabold text-slate-900">
                        {item.name}
                      </h4>

                      <p className="mt-2 text-sm font-bold text-slate-700">
                        ₦{item.price.toLocaleString()}
                      </p>

                      <button
                        type="button"
                        onClick={() => purchaseItem(item.name, item.price)}
                        className="mt-3 w-full rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
                      >
                        Buy Item
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected building details */}
      {selectedBuilding && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-3xl shadow-sm">
              {selectedBuilding.icon}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Campus location
              </p>

              <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                {selectedBuilding.name}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {selectedBuilding.description}
              </p>

              {selectedBuilding.id === "auditorium" && (
                <div className="mt-3 rounded-xl bg-white p-3">
                  <p className="text-sm font-bold text-slate-800">
                    🎉 Auditorium activities
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    School meetings, parties, ceremonies, entertainment shows,
                    and student events will be developed here.
                  </p>
                  {["auditorium", "mall"].includes(selectedBuilding.id) && (
                    <button
                      type="button"
                      onClick={() => enterBuilding(selectedBuilding)}
                      className="mt-4 w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800 sm:w-auto"
                    >
                      Enter{" "}
                      {selectedBuilding.id === "auditorium"
                        ? "Auditorium"
                        : "Mall"}{" "}
                      →
                    </button>
                  )}
                </div>
              )}

              {selectedBuilding.id === "mall" && (
                <div className="mt-3 rounded-xl bg-white p-3">
                  <p className="text-sm font-bold text-slate-800">
                    🛍️ Shopping centre
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Shops, groceries, fashion, accessories, and virtual
                    purchases will be developed here.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedBuilding(null)}
              aria-label="Close building details"
              className="rounded-lg px-3 py-2 text-slate-500 hover:bg-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Location guide */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900">
              Campus Location Guide
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Select a location to view its details.
            </p>
          </div>

          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
            {campusBuildings.length + 1} locations
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() =>
              setSelectedBuilding({
                id: "football",
                name: "Football Field",
                icon: "⚽",
                description:
                  "Meet friends, play football, and enjoy campus sports.",
              })
            }
            className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
          >
            <span className="text-2xl">⚽</span>
            <p className="mt-2 text-sm font-bold">Football Field</p>
          </button>

          {campusBuildings.map((building) => (
            <button
              key={building.id}
              type="button"
              onClick={() => setSelectedBuilding(building)}
              className={`rounded-xl border p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 ${
                selectedBuilding?.id === building.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200"
              }`}
            >
              <span className="text-2xl">{building.icon}</span>

              <p className="mt-2 text-sm font-bold text-slate-800">
                {building.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs leading-5 text-slate-400">
        This is the first playable prototype. Character movement and location
        selection work locally; entering buildings, multiplayer, events, and
        shopping transactions will be added in later stages.
      </p>
    </section>
  );
}
