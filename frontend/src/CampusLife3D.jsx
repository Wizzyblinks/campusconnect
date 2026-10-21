import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Sky, Text } from "@react-three/drei";
import * as THREE from "three";

const CAMPUS_BUILDINGS = [
  {
    id: "admin",
    name: "Admin Block",
    x: -16,
    z: -15,
    width: 6,
    depth: 5,
    height: 9,
    floors: 3,
    color: "#e7d5bd",
  },
  {
    id: "gaab",
    name: "GAAB",
    x: -4,
    z: -17,
    width: 6,
    depth: 5,
    height: 9,
    floors: 3,
    color: "#f0e5d3",
  },
  {
    id: "radio",
    name: "Radio Station",
    x: -28,
    z: -6,
    width: 4,
    depth: 4,
    height: 3,
    floors: 1,
    color: "#e8d2a8",
  },
  {
    id: "staff",
    name: "Staff Lodge",
    x: -28,
    z: 7,
    width: 5,
    depth: 5,
    height: 3,
    floors: 1,
    color: "#d8c1a0",
  },
  {
    id: "nas",
    name: "NAS Block",
    x: 9,
    z: -17,
    width: 7,
    depth: 5,
    height: 9,
    floors: 3,
    color: "#e8dfcf",
  },
  {
    id: "vc",
    name: "VC Block",
    x: 23,
    z: -15,
    width: 6,
    depth: 5,
    height: 6,
    floors: 2,
    color: "#f0e4d0",
  },
  {
    id: "girls",
    name: "Girls' Hostel",
    x: 29,
    z: 1,
    width: 6,
    depth: 6,
    height: 9,
    floors: 3,
    color: "#e4c8c5",
  },
  {
    id: "auditorium",
    name: "Auditorium",
    x: 0,
    z: 1,
    width: 9,
    depth: 7,
    height: 5,
    floors: 1,
    color: "#c9d8e8",
    enterable: true,
  },
  {
    id: "mall",
    name: "Campus Mall",
    x: 15,
    z: 7,
    width: 8,
    depth: 6,
    height: 4,
    floors: 1,
    color: "#d6e5d2",
    enterable: true,
  },
  {
    id: "cafeteria",
    name: "Cafeteria",
    x: -13,
    z: 15,
    width: 7,
    depth: 5,
    height: 3,
    floors: 1,
    color: "#eddbb8",
  },
  {
    id: "hospital",
    name: "RU Hospital",
    x: -29,
    z: 20,
    width: 6,
    depth: 5,
    height: 3,
    floors: 1,
    color: "#f2f2ed",
  },
  {
    id: "boys",
    name: "Boys' Hostel",
    x: 27,
    z: 19,
    width: 7,
    depth: 6,
    height: 9,
    floors: 3,
    color: "#e1c7a7",
  },
  {
    id: "poultry",
    name: "Poultry",
    x: -31,
    z: 34,
    width: 6,
    depth: 5,
    height: 3,
    floors: 1,
    color: "#d6c5a7",
  },
];
function Building({ building, selected, onSelect }) {
  const { width, depth, height, x, z, color, floors, name } = building;

  return (
    <group position={[x, 0, z]}>
      {/* Building foundation */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[width + 0.4, 0.25, depth + 0.4]} />
        <meshStandardMaterial color="#b9b8b1" />
      </mesh>

      {/* Main building */}
      <mesh
        position={[0, height / 2 + 0.25, 0]}
        castShadow
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect(building);
        }}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={selected ? "#93c5fd" : color}
          roughness={0.85}
        />
      </mesh>

      {/* Roof */}
      <mesh position={[0, height + 0.4, 0]} castShadow>
        <boxGeometry args={[width + 0.2, 0.3, depth + 0.2]} />
        <meshStandardMaterial color="#555d67" />
      </mesh>

      {/* Floor separators */}
      {Array.from({ length: Math.max(floors - 1, 0) }).map((_, index) => (
        <mesh
          key={index}
          position={[0, ((index + 1) * height) / floors + 0.25, 0]}
        >
          <boxGeometry args={[width + 0.03, 0.08, depth + 0.03]} />
          <meshStandardMaterial color="#c1b6a7" />
        </mesh>
      ))}

      {/* Front entrance */}
      <mesh position={[0, 1.1, depth / 2 + 0.025]}>
        <boxGeometry args={[1, 2.1, 0.08]} />
        <meshStandardMaterial color="#655348" />
      </mesh>

      {/* Windows on the front */}
      {Array.from({
        length: Math.max(2, Math.floor(width / 1.5)),
      }).map((_, index) => {
        const windowCount = Math.max(2, Math.floor(width / 1.5));
        const spacing = width / windowCount;

        return (
          <group key={index}>
            {Array.from({ length: floors }).map((__, floor) => (
              <mesh
                key={floor}
                position={[
                  -width / 2 + spacing * (index + 0.5),
                  floor * (height / floors) + height / floors / 2 + 0.25,
                  depth / 2 + 0.035,
                ]}
              >
                <boxGeometry args={[0.55, 0.65, 0.06]} />
                <meshStandardMaterial
                  color="#8ec5e8"
                  metalness={0.2}
                  roughness={0.25}
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Building name */}
      <Text
        position={[0, height + 1.6, 0]}
        fontSize={0.8}
        color="#172033"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.035}
        outlineColor="white"
        maxWidth={10}
        textAlign="center"
      >
        {name}
      </Text>

      {selected && (
        <mesh position={[0, height + 0.9, 0]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial
            color="#2563eb"
            emissive="#2563eb"
            emissiveIntensity={0.7}
          />
        </mesh>
      )}
    </group>
  );
}

function Tree({ position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.23, 1.8, 8]} />
        <meshStandardMaterial color="#765037" />
      </mesh>

      <mesh position={[0, 2.1, 0]} castShadow>
        <coneGeometry args={[1.1, 2.4, 8]} />
        <meshStandardMaterial color="#277746" />
      </mesh>

      <mesh position={[0, 2.8, 0]} castShadow>
        <coneGeometry args={[0.8, 1.8, 8]} />
        <meshStandardMaterial color="#36884d" />
      </mesh>
    </group>
  );
}

function Student({ playerRef }) {
  return (
    <group ref={playerRef} position={[0, 0, 24]}>
      {/* Legs */}
      <mesh position={[-0.18, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.13, 0.5, 4, 8]} />
        <meshStandardMaterial color="#172554" />
      </mesh>

      <mesh position={[0.18, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.13, 0.5, 4, 8]} />
        <meshStandardMaterial color="#172554" />
      </mesh>

      {/* Body */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <capsuleGeometry args={[0.35, 0.65, 4, 10]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <sphereGeometry args={[0.27, 16, 16]} />
        <meshStandardMaterial color="#8d583d" />
      </mesh>

      {/* Hair */}
      <mesh position={[0, 2.12, 0]} castShadow>
        <sphereGeometry
          args={[0.275, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <meshStandardMaterial color="#211812" />
      </mesh>
    </group>
  );
}

function CampusGround() {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.12, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#79ad68" />
      </mesh>

      {/* Main campus roads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]}>
        <planeGeometry args={[5, 85]} />
        <meshStandardMaterial color="#777d82" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <planeGeometry args={[65, 4]} />
        <meshStandardMaterial color="#777d82" />
      </mesh>

      {/* Football field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8, -0.07, 32]}>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#3b8b48" />
      </mesh>

      {/* Field markings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, -0.05, 30]}>
        <planeGeometry args={[0.12, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, -0.05, 30]}>
        <ringGeometry args={[3.1, 3.2, 32]} />
        <meshStandardMaterial color="white" side={THREE.DoubleSide} />
      </mesh>

      {/* Main gate */}
      <mesh position={[0, 2, 43]}>
        <boxGeometry args={[8, 4, 0.6]} />
        <meshStandardMaterial color="#d8d9dd" />
      </mesh>

      <Text
        position={[0, 3.3, 43.35]}
        fontSize={0.8}
        color="#1e293b"
        anchorX="center"
      >
        RITMAN UNIVERSITY
      </Text>
    </group>
  );
}

function AuditoriumInterior() {
  return (
    <group>
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[24, 0.3, 20]} />
        <meshStandardMaterial color="#b5a99b" />
      </mesh>

      <mesh position={[0, 4, -10]}>
        <boxGeometry args={[24, 8, 0.5]} />
        <meshStandardMaterial color="#e5d9c9" />
      </mesh>

      <mesh position={[0, 2, -9.3]}>
        <boxGeometry args={[12, 2.5, 0.4]} />
        <meshStandardMaterial color="#6b3f32" />
      </mesh>

      <Text
        position={[0, 4, -9.15]}
        fontSize={1.1}
        color="white"
        anchorX="center"
      >
        RITMAN AUDITORIUM
      </Text>

      {/* Stage */}
      <mesh position={[0, 0.5, -6]}>
        <boxGeometry args={[12, 1, 3]} />
        <meshStandardMaterial color="#684336" />
      </mesh>

      {/* Seating rows */}
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 8 }).map((__, seat) => (
          <mesh
            key={`${row}-${seat}`}
            position={[(seat - 3.5) * 2.2, 0.65, row * 2 - 2]}
          >
            <boxGeometry args={[1.5, 0.8, 1]} />
            <meshStandardMaterial color="#a52a35" />
          </mesh>
        )),
      )}
    </group>
  );
}

function MallInterior() {
  return (
    <group>
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[24, 0.3, 20]} />
        <meshStandardMaterial color="#e7e5e4" />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 3, -10]}>
        <boxGeometry args={[24, 6, 0.4]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>

      <Text
        position={[0, 4.3, -9.7]}
        fontSize={1}
        color="#1e293b"
        anchorX="center"
      >
        CAMPUS MALL
      </Text>

      {/* Shops */}
      {[
        { x: -7, color: "#2563eb", name: "FASHION" },
        { x: 0, color: "#16a34a", name: "GROCERIES" },
        { x: 7, color: "#9333ea", name: "GADGETS" },
      ].map((shop) => (
        <group key={shop.name} position={[shop.x, 0, -6]}>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[5, 3, 2]} />
            <meshStandardMaterial color={shop.color} />
          </mesh>

          <Text
            position={[0, 2, 1.1]}
            fontSize={0.55}
            color="white"
            anchorX="center"
          >
            {shop.name}
          </Text>

          <mesh position={[0, 0.5, 1.1]}>
            <boxGeometry args={[2, 1, 0.15]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
        </group>
      ))}

      {/* Checkout counter */}
      <mesh position={[0, 0.7, 5]}>
        <boxGeometry args={[8, 1.4, 1.5]} />
        <meshStandardMaterial color="#b08968" />
      </mesh>
    </group>
  );
}

const PLAYER_SPEED = 7;
const PLAYER_RADIUS = 0.6;
const CAMPUS_LIMIT = 46;

function collidesWithBuilding(x, z, building) {
  const halfWidth = building.width / 2 + PLAYER_RADIUS;
  const halfDepth = building.depth / 2 + PLAYER_RADIUS;

  return (
    x > building.x - halfWidth &&
    x < building.x + halfWidth &&
    z > building.z - halfDepth &&
    z < building.z + halfDepth
  );
}

function isBlocked(x, z) {
  return CAMPUS_BUILDINGS.some((building) =>
    collidesWithBuilding(x, z, building),
  );
}

function GameScene({
  insideBuilding,
  selectedBuilding,
  onSelectBuilding,
  playerRef,
  keysRef,
  joystickRef,
  cameraYawRef,
}) {
  useFrame((state, delta) => {
    const player = playerRef.current;

    if (!player) return;

    if (insideBuilding) {
      const target = new THREE.Vector3(0, 7, 17);

      state.camera.position.lerp(target, 1 - Math.exp(-3 * delta));

      state.camera.lookAt(0, 1, 0);

      return;
    }

    const keys = keysRef.current;
    const joystick = joystickRef.current;

    const forwardInput =
      (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0) - joystick.y;

    const sideInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + joystick.x;

    const yaw = cameraYawRef.current;

    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);

    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    let moveX = forwardX * forwardInput + rightX * sideInput;

    let moveZ = forwardZ * forwardInput + rightZ * sideInput;

    const length = Math.hypot(moveX, moveZ);

    if (length > 1) {
      moveX /= length;
      moveZ /= length;
    }

    if (length > 0.01) {
      const stepX = moveX * PLAYER_SPEED * delta;
      const stepZ = moveZ * PLAYER_SPEED * delta;

      const nextX = THREE.MathUtils.clamp(
        player.position.x + stepX,
        -CAMPUS_LIMIT,
        CAMPUS_LIMIT,
      );

      const nextZ = THREE.MathUtils.clamp(
        player.position.z + stepZ,
        -CAMPUS_LIMIT,
        CAMPUS_LIMIT,
      );

      // Resolve each axis separately so the player can slide
      // along walls instead of getting stuck.
      if (!isBlocked(nextX, player.position.z)) {
        player.position.x = nextX;
      }

      if (!isBlocked(player.position.x, nextZ)) {
        player.position.z = nextZ;
      }

      player.rotation.y = Math.atan2(moveX, moveZ);
    }

    // Keep the camera behind the player based on camera yaw.
    const cameraDistance = 10;
    const cameraHeight = 5;

    const targetCamera = new THREE.Vector3(
      player.position.x + Math.sin(yaw) * cameraDistance,
      player.position.y + cameraHeight,
      player.position.z + Math.cos(yaw) * cameraDistance,
    );

    state.camera.position.lerp(targetCamera, 1 - Math.exp(-5 * delta));

    state.camera.lookAt(
      player.position.x,
      player.position.y + 1.1,
      player.position.z,
    );
  });

  if (insideBuilding) {
    return (
      <>
        <mesh position={[0, 3, -10]}>
          <boxGeometry args={[25, 7, 0.5]} />
          <meshStandardMaterial color="#e8e2d8" />
        </mesh>

        {insideBuilding.id === "auditorium" ? (
          <AuditoriumInterior />
        ) : (
          <MallInterior />
        )}
      </>
    );
  }

  return (
    <>
      <CampusGround />

      {CAMPUS_BUILDINGS.map((building) => (
        <Building
          key={building.id}
          building={building}
          selected={selectedBuilding?.id === building.id}
          onSelect={onSelectBuilding}
        />
      ))}

      {[
        [-34, 0, -18],
        [-34, 0, 0],
        [-35, 0, 13],
        [-19, 0, -24],
        [-5, 0, -25],
        [12, 0, -25],
        [34, 0, -20],
        [36, 0, -8],
        [37, 0, 9],
        [36, 0, 27],
        [13, 0, 28],
        [-5, 0, 25],
        [-36, 0, 39],
      ].map((position, index) => (
        <Tree
          key={index}
          position={position}
          scale={index % 3 === 0 ? 1.2 : 0.9}
        />
      ))}

      <Student playerRef={playerRef} />
    </>
  );
}
export default function CampusLife3D() {
  const playerRef = useRef(null);

  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  const joystickRef = useRef({ x: 0, y: 0 });
  const cameraYawRef = useRef(0);
  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [insideBuilding, setInsideBuilding] = useState(null);
  const [message, setMessage] = useState(
    "Welcome to Ritman University! Explore the campus.",
  );

  const [mobileDirection, setMobileDirection] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  const handleKeyDown = useCallback((event) => {
    const key = event.key.toLowerCase();

    const keyMap = {
      w: "forward",
      arrowup: "forward",
      s: "backward",
      arrowdown: "backward",
      a: "left",
      arrowleft: "left",
      d: "right",
      arrowright: "right",
    };

    if (keyMap[key]) {
      event.preventDefault();
      keysRef.current[keyMap[key]] = true;
    }
  }, []);

  const handleKeyUp = useCallback((event) => {
    const key = event.key.toLowerCase();

    const keyMap = {
      w: "forward",
      arrowup: "forward",
      s: "backward",
      arrowdown: "backward",
      a: "left",
      arrowleft: "left",
      d: "right",
      arrowright: "right",
    };

    if (keyMap[key]) {
      keysRef.current[keyMap[key]] = false;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  function handleCameraPointerDown(event) {
    // Do not start camera rotation when the joystick is touched.
    if (event.target.closest("[data-joystick]")) return;

    dragRef.current = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleCameraPointerMove(event) {
    if (!dragRef.current.active) return;

    const deltaX = event.clientX - dragRef.current.lastX;

    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;

    cameraYawRef.current -= deltaX * 0.006;
  }

  function handleCameraPointerUp() {
    dragRef.current.active = false;
  }

  function enterBuilding() {
    if (!selectedBuilding?.enterable) return;

    setInsideBuilding(selectedBuilding);
    setMessage(`You entered ${selectedBuilding.name}.`);
    setSelectedBuilding(null);

    if (playerRef.current) {
      playerRef.current.position.set(0, 0, 0);
    }
  }

  function leaveBuilding() {
    setInsideBuilding(null);
    setMessage("You returned to the Ritman University campus.");

    if (playerRef.current) {
      playerRef.current.position.set(0, 0, 24);
    }
  }

  {
    !insideBuilding && (
      <div
        data-joystick
        className="absolute bottom-5 left-5 z-20 sm:hidden"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);

          const rect = event.currentTarget.getBoundingClientRect();
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          const updateJoystick = (pointerEvent) => {
            const dx = pointerEvent.clientX - rect.left - centerX;
            const dy = pointerEvent.clientY - rect.top - centerY;

            const radius = 35;
            const distance = Math.hypot(dx, dy);
            const scale = distance > radius ? radius / distance : 1;

            joystickRef.current = {
              x: (dx * scale) / radius,
              y: (dy * scale) / radius,
            };
          };

          updateJoystick(event);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          const dx = event.clientX - rect.left - rect.width / 2;
          const dy = event.clientY - rect.top - rect.height / 2;

          const radius = 35;
          const distance = Math.hypot(dx, dy);
          const scale = distance > radius ? radius / distance : 1;

          joystickRef.current = {
            x: (dx * scale) / radius,
            y: (dy * scale) / radius,
          };
        }}
        onPointerUp={() => {
          joystickRef.current = { x: 0, y: 0 };
        }}
        onPointerCancel={() => {
          joystickRef.current = { x: 0, y: 0 };
        }}
        onLostPointerCapture={() => {
          joystickRef.current = { x: 0, y: 0 };
        }}
        style={{ touchAction: "none" }}
      >
        <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/40 bg-slate-950/35 shadow-lg backdrop-blur-sm">
          <div className="flex h-[70px] w-[70px] items-center justify-center rounded-full border border-white/30 bg-slate-900/35">
            <div className="h-10 w-10 rounded-full border-2 border-white/80 bg-blue-600/90 shadow-md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-sky-100 shadow-lg">
      {/* Game header */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="rounded-xl bg-slate-950/80 px-3 py-2 text-white shadow-lg">
          <p className="text-sm font-extrabold sm:text-base">
            Ritman University 3D
          </p>
          <p className="mt-1 text-xs text-slate-200">
            {insideBuilding ? insideBuilding.name : "Campus Explorer"}
          </p>
        </div>

        <div className="max-w-[55%] rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg sm:text-sm">
          {message}
        </div>
      </div>

      {/* 3D world */}
      <div className="h-[520px] w-full sm:h-[650px]">
        <Canvas
          shadows
          camera={{
            position: [0, 9, 35],
            fov: 55,
            near: 0.1,
            far: 200,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor("#b9ddf5");
          }}
        >
          <Sky
            distance={450000}
            sunPosition={[50, 80, 30]}
            inclination={0.5}
            azimuth={0.25}
          />

          <ambientLight intensity={1.1} />

          <directionalLight
            position={[25, 35, 20]}
            intensity={2}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />

          <GameScene
            insideBuilding={insideBuilding}
            selectedBuilding={selectedBuilding}
            onSelectBuilding={(building) => {
              setSelectedBuilding(building);
              setMessage(`${building.name} selected.`);
            }}
            playerRef={playerRef}
            keysRef={keysRef}
            joystickRef={joystickRef}
            cameraYawRef={cameraYawRef}
          />
        </Canvas>
        <div
          className="h-[520px] w-full touch-none sm:h-[650px]"
          onPointerDown={handleCameraPointerDown}
          onPointerMove={handleCameraPointerMove}
          onPointerUp={handleCameraPointerUp}
          onPointerCancel={handleCameraPointerUp}
        ></div>
      </div>

      {/* Selected building information */}
      {selectedBuilding && !insideBuilding && (
        <div className="absolute left-3 top-24 z-10 w-[min(270px,calc(100%-1.5rem))] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl">
          <button
            onClick={() => setSelectedBuilding(null)}
            className="float-right rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close building information"
          >
            ✕
          </button>

          <p className="text-lg font-extrabold text-slate-900">
            {selectedBuilding.name}
          </p>

          <p className="mt-1 text-sm text-slate-600">
            {selectedBuilding.floors > 1
              ? `${selectedBuilding.floors}-storey building`
              : "Campus facility"}
          </p>

          {selectedBuilding.enterable ? (
            <button
              onClick={enterBuilding}
              className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            >
              Enter {selectedBuilding.name} →
            </button>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Explore this location by walking around the campus.
            </p>
          )}
        </div>
      )}

      {/* Exit building */}
      {insideBuilding && (
        <button
          onClick={leaveBuilding}
          className="absolute right-3 top-24 z-10 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-800"
        >
          ← Return to Campus
        </button>
      )}

      {/* Desktop controls */}
      {!insideBuilding && (
        <div className="absolute bottom-3 left-3 z-10 hidden rounded-xl bg-slate-950/75 px-4 py-3 text-xs leading-6 text-white sm:block">
          <p className="font-bold">CONTROLS</p>
          <p>W A S D — Move</p>
          <p>Arrow keys — Move</p>
          <p>Click a building — Explore</p>
        </div>
      )}

      {/* Mobile controls */}
      {!insideBuilding && (
        <div className="absolute bottom-3 right-3 z-10 grid grid-cols-3 gap-1 sm:hidden">
          <div />
          <button
            onPointerDown={() => moveMobile("forward", true)}
            onPointerUp={() => moveMobile("forward", false)}
            onPointerLeave={() => moveMobile("forward", false)}
            onPointerCancel={() => moveMobile("forward", false)}
            className="h-12 w-12 touch-none rounded-xl bg-slate-950/80 text-xl font-bold text-white active:bg-blue-700"
          >
            ↑
          </button>
          <div />

          <button
            onPointerDown={() => moveMobile("left", true)}
            onPointerUp={() => moveMobile("left", false)}
            onPointerLeave={() => moveMobile("left", false)}
            onPointerCancel={() => moveMobile("left", false)}
            className="h-12 w-12 touch-none rounded-xl bg-slate-950/80 text-xl font-bold text-white active:bg-blue-700"
          >
            ←
          </button>

          <button
            onPointerDown={() => moveMobile("backward", true)}
            onPointerUp={() => moveMobile("backward", false)}
            onPointerLeave={() => moveMobile("backward", false)}
            onPointerCancel={() => moveMobile("backward", false)}
            className="h-12 w-12 touch-none rounded-xl bg-slate-950/80 text-xl font-bold text-white active:bg-blue-700"
          >
            ↓
          </button>

          <button
            onPointerDown={() => moveMobile("right", true)}
            onPointerUp={() => moveMobile("right", false)}
            onPointerLeave={() => moveMobile("right", false)}
            onPointerCancel={() => moveMobile("right", false)}
            className="h-12 w-12 touch-none rounded-xl bg-slate-950/80 text-xl font-bold text-white active:bg-blue-700"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
