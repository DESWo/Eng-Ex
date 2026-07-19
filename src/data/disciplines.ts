import {
  Anchor,
  ArrowDownToLine,
  Atom,
  Binary,
  Bot,
  Building,
  Building2,
  Cable,
  CircuitBoard,
  Cog,
  Columns3,
  Cpu,
  Crosshair,
  Droplets,
  Factory,
  Feather,
  Filter,
  Gauge,
  Lightbulb,
  Move,
  MoveUpRight,
  PiggyBank,
  Plane,
  Recycle,
  Rocket,
  Route,
  Satellite,
  Scale,
  Share2,
  ShieldCheck,
  Snowflake,
  Sprout,
  Target,
  Timer,
  ToggleLeft,
  TrendingUp,
  TriangleAlert,
  Users,
  Weight,
  Wind,
  Zap,
} from 'lucide-react'
import type { Discipline } from '@/lib/types'

/**
 * ALL discipline content lives in this one file. Edit freely.
 *
 * To add a new discipline:
 *   1. Build a challenge component in src/challenges/<name>/ and register it
 *      in src/challenges/registry.ts under a unique id.
 *   2. Add a new object to this array (copy an existing one as a template)
 *      and point `challenge.id` at your registry id.
 *   3. Done. The landing page card, routing, and the four step flow
 *      (Learn, Play, Reflect, Why it works) are generated automatically.
 */
export const disciplines: Discipline[] = [
  {
    slug: 'mechanical',
    name: 'Mechanical Engineering',
    shortName: 'Mechanical',
    tagline: 'Design machines that move the world.',
    description:
      'Engines, robots, roller coasters. If it moves, a mechanical engineer probably helped build it.',
    icon: Cog,
    accent: '#f2695c',
    difficulty: 'Beginner',
    intro: {
      heading: 'What do mechanical engineers do?',
      paragraphs: [
        'Mechanical engineers design things that move. Cars, robots, rockets, even the tiny motor that makes your phone buzz.',
        'They think about forces: pushes, pulls, spins, and swings. Then they turn metal, plastic, and clever ideas into machines that work.',
      ],
      builds: ['Roller coasters', 'Robot arms', 'Car engines', 'Drones', 'Prosthetic legs', 'Wind turbines'],
      challengeTeaser:
        'A castle needs defending, and you are in charge of the catapult. Tune the angle and power, then let it fly.',
    },
    challenges: [
      {
        id: 'catapult',
        title: 'Catapult Lab',
        goal: 'Hit the target',
        why: [
          {
            icon: Gauge,
            title: 'Power sets the speed',
            body: 'More power means the boulder leaves the catapult faster, so it flies farther before gravity pulls it down.',
          },
          {
            icon: MoveUpRight,
            title: 'Angle splits the throw',
            body: 'A low angle throws forward. A high angle throws up. The sweet spot near 45 degrees gives the longest flight.',
          },
          {
            icon: Target,
            title: 'Tuning is the real job',
            body: 'Real engineers change one thing at a time, watch what happens, and adjust. You just did exactly that.',
          },
        ],
      },
      {
        id: 'gears',
        title: 'Gear It Up',
        goal: 'Match the fan speed',
        why: [
          {
            icon: Gauge,
            title: 'A big gear spins a small one faster',
            body: 'When a big gear drives a small gear, the small one whips around faster. You trade turning force for speed.',
          },
          {
            icon: Scale,
            title: 'Or trade speed for strength',
            body: 'Flip it around, small gear driving a big one, and you get slow but strong. That is how a bike climbs a steep hill.',
          },
          {
            icon: Cog,
            title: 'Stacking gears multiplies',
            body: 'Chaining two gear pairs multiplies the effect, so one motor can spin a fan gently or like a hurricane.',
          },
        ],
      },
      {
        id: 'beam',
        title: 'Balance Act',
        goal: 'Level the beam',
        why: [
          {
            icon: Weight,
            title: 'Weight times distance is the twist',
            body: 'A weight far from the middle twists the beam much more than the same weight up close. Engineers call that torque.',
          },
          {
            icon: Scale,
            title: 'Level means the twists match',
            body: 'The beam sits flat when the twist on the left exactly equals the twist on the right.',
          },
          {
            icon: Move,
            title: 'Slide it, do not just stack it',
            body: 'You can balance a heavy load with a light weight, just by sliding the light one farther out. Distance does the work.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Mechanical engineering is a loop: guess, test, watch, improve. Machines get great one small tweak at a time.',
    },
    diy: {
      title: 'Build a spoon catapult',
      intro:
        'The catapult from the lab, on your desk, in ten minutes. No special parts needed.',
      diagram: 'spoon-catapult',
      materials: [
        'Plastic spoon',
        '5 popsicle sticks',
        '4 rubber bands',
        'Mini marshmallows or paper balls',
      ],
      steps: [
        'Stack 3 popsicle sticks and wrap a rubber band around each end.',
        'Put the other 2 sticks together and wrap a rubber band around one end only, so they open like a V.',
        'Slide the 3-stick stack deep into the V to prop it open.',
        'Rubber band the spoon onto the top stick of the V, handle down.',
        'Load a marshmallow in the spoon, pull back, and launch.',
      ],
      experiment:
        'Slide the 3-stick stack closer to or farther from the spoon and launch again. You just changed the launch angle, exactly like the slider in Catapult Lab.',
      safety: 'Launch away from faces, screens, and pets.',
    },
  },
  {
    slug: 'civil',
    name: 'Civil Engineering',
    shortName: 'Civil',
    tagline: 'Build the bridges and cities we live in.',
    description:
      'Bridges, tunnels, stadiums, whole skylines. Civil engineers shape the world you walk through every day.',
    icon: Building2,
    accent: '#2fb98b',
    difficulty: 'Beginner',
    intro: {
      heading: 'What do civil engineers do?',
      paragraphs: [
        'Civil engineers design the things we all share: bridges, roads, tunnels, and buildings.',
        'Their work has to be strong, safe, and affordable, all at the same time. Every project is a puzzle with a budget.',
      ],
      builds: ['Bridges', 'Skyscrapers', 'Dams', 'Highways', 'Stadiums', 'Water systems'],
      challengeTeaser:
        'A town needs a bridge across the river, and a heavy truck is already waiting. Build it strong without blowing the budget.',
    },
    challenges: [
      {
        id: 'bridge',
        title: 'Bridge Builder',
        goal: 'Get the truck across',
        why: [
          {
            icon: Columns3,
            title: 'Triangles keep their shape',
            body: 'A square can squash into a diamond, but a triangle cannot budge. That is why truss bridges are built from triangles.',
          },
          {
            icon: ArrowDownToLine,
            title: 'Some beams pull, some push',
            body: 'As the truck rolls on, some beams stretch (tension) and others get squeezed (compression). Each one has a breaking limit.',
          },
          {
            icon: PiggyBank,
            title: 'Share the load, spend less',
            body: 'More triangles spread the weight over more beams, so none of them snaps, and you do not overpay for one giant beam.',
          },
        ],
      },
      {
        id: 'traffic',
        title: 'Green Wave',
        goal: 'Clear the jam',
        why: [
          {
            icon: Timer,
            title: 'Green time is a budget',
            body: 'Each road only moves cars while its light is green. You are splitting one minute of green between two roads.',
          },
          {
            icon: Users,
            title: 'Match green to the crowd',
            body: 'The busier road needs more green time. Give each road just enough to clear the cars that keep showing up.',
          },
          {
            icon: Route,
            title: 'Everyone shares the crossing',
            body: 'Add walkers and buses and it gets trickier. Real traffic engineers juggle them all on the same clock.',
          },
        ],
      },
      {
        id: 'quake',
        title: 'Shake Proof',
        goal: 'Survive the quake',
        why: [
          {
            icon: ShieldCheck,
            title: 'Bigger quakes need stronger buildings',
            body: 'A stronger earthquake shakes harder, so it needs a stronger design. You matched the building to the danger.',
          },
          {
            icon: Columns3,
            title: 'Bracing stiffens the frame',
            body: 'X-braces and a solid core stop the floors from swaying apart when the ground jerks back and forth.',
          },
          {
            icon: Anchor,
            title: 'Rollers let it ride the wave',
            body: 'Base isolation lets the ground slide underneath while the building stays put, like standing on a skateboard that rolls under you.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Civil engineering is the art of the tradeoff: strong enough to trust, affordable enough to build.',
    },
    diy: {
      title: 'Build a popsicle stick truss bridge',
      intro:
        'The same triangles you drew in Bridge Builder, made out of real sticks. Then load it up until it complains.',
      diagram: 'truss-bridge',
      materials: [
        'About 30 popsicle sticks',
        'White glue or hot glue',
        'Two chairs or stacks of books',
        'A bag and some coins for weight',
      ],
      steps: [
        'Glue sticks into triangles first. Triangles are the whole secret.',
        'Join the triangles into two flat zigzag walls, like the truss in the game.',
        'Stand the walls up and connect them with sticks across the top and bottom.',
        'Let the glue dry completely. Overnight is best.',
        'Bridge a gap between two chairs, hang the bag from the middle, and add coins one at a time.',
      ],
      experiment:
        'Build a second bridge using squares instead of triangles and load them both. Watch which one folds first, and notice HOW it folds.',
      safety: 'Hot glue is genuinely hot. Get a hand if you have not used it before.',
    },
  },
  {
    slug: 'electrical',
    name: 'Electrical Engineering',
    shortName: 'Electrical',
    tagline: 'Power the world with clever circuits.',
    description:
      'From giant power grids to the chip inside your phone, electrical engineers keep the lights on.',
    icon: Zap,
    accent: '#7b6cf0',
    difficulty: 'Intermediate',
    intro: {
      heading: 'What do electrical engineers do?',
      paragraphs: [
        'Electrical engineers work with energy you cannot see. They move electricity from where it is made to where it is needed.',
        'Some design tiny circuits inside phones and game consoles. Others plan giant power grids that light up entire cities.',
      ],
      builds: ['Power grids', 'Phone chips', 'Electric cars', 'Solar farms', 'Speakers', 'Smart lights'],
      challengeTeaser:
        'Five houses are sitting in the dark. Route power lines from the plant to every home before the wire runs out.',
    },
    challenges: [
      {
        id: 'power-grid',
        title: 'Power Up',
        goal: 'Light all 5 houses',
        why: [
          {
            icon: Cable,
            title: 'Electricity needs a path',
            body: 'A house only lights up when there is an unbroken chain of wire between it and the power plant.',
          },
          {
            icon: Share2,
            title: 'Sharing wires saves money',
            body: 'Houses can pass power along to their neighbors. One smart shared route beats five separate ones.',
          },
          {
            icon: Route,
            title: 'The grid is a giant puzzle',
            body: 'Real power grids connect millions of homes. Engineers plan the routes so no wire, and no money, goes to waste.',
          },
        ],
      },
      {
        id: 'circuit',
        title: 'Circuit Lab',
        goal: 'Wire a working gadget',
        why: [
          {
            icon: Cable,
            title: 'Electricity needs a full loop',
            body: 'Power only flows when there is an unbroken path from the + end of the battery all the way back to the -.',
          },
          {
            icon: ToggleLeft,
            title: 'A switch is a drawbridge',
            body: 'Open the switch and the loop breaks, so the current stops. Close it and the power flows again.',
          },
          {
            icon: Lightbulb,
            title: 'One loop can run a lot',
            body: 'Put a bulb and a buzzer in the same loop and both go at once, all from a single battery.',
          },
        ],
      },
      {
        id: 'overload',
        title: "Don't Trip",
        goal: 'Balance the load',
        why: [
          {
            icon: Gauge,
            title: 'Every circuit has a limit',
            body: 'A wire can only carry so much power before it overheats. Push past the limit and the breaker trips.',
          },
          {
            icon: Share2,
            title: 'Spread the big appliances',
            body: 'Put the heater and the kettle on different circuits so no single one has to carry them both.',
          },
          {
            icon: ShieldCheck,
            title: 'A tripped breaker is a hero',
            body: 'The breaker did not fail, it protected your house from a fire. Flipping off is exactly its job.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Electrical engineering is about connection: finding the smartest path from power to people.',
    },
    diy: {
      title: 'Build a paper clip flashlight',
      intro:
        'A real circuit with a real switch, built from junk drawer parts. Circuit Lab, but you can hold it.',
      diagram: 'paper-clip-flashlight',
      materials: [
        'Coin cell battery (CR2032)',
        'An LED, any color',
        'Aluminum foil',
        'Tape, a paper clip, and a scrap of cardboard',
      ],
      steps: [
        'Cut two thin strips of foil. These are your wires.',
        'Tape one strip to the + side of the battery and one to the - side.',
        'Tape the LED so its LONG leg touches the + strip. LEDs only work one way around.',
        'Tape the paper clip near the short leg so it can swing to connect the LED to the - strip.',
        'Swing the clip closed and watch it light.',
      ],
      experiment:
        'Open the clip halfway. The light dies instantly, because electricity needs a complete loop. That is the exact rule from Circuit Lab.',
      safety:
        'Coin cells are safe to handle, but keep them far away from mouths and little kids. They are dangerous if swallowed.',
    },
  },
  {
    slug: 'nuclear',
    name: 'Nuclear Engineering',
    shortName: 'Nuclear',
    tagline: 'Turn tiny atoms into a city of power.',
    description:
      'Split atoms, make heat, make electricity. Nuclear engineers run some of the most powerful machines on Earth.',
    icon: Atom,
    accent: '#eab308',
    tier: 'more',
    parent: 'electrical',
    difficulty: 'Advanced',
    intro: {
      heading: 'What do nuclear engineers do?',
      paragraphs: [
        'Nuclear engineers get energy out of atoms. When certain atoms split, they release a huge burst of heat.',
        'That heat boils water into steam, the steam spins a turbine, and the turbine makes electricity. The trick is keeping it steady and safe.',
      ],
      builds: ['Power reactors', 'Submarines', 'Cancer treatments', 'Space batteries', 'Fusion machines', 'Smoke detectors'],
      challengeTeaser:
        'A whole city is plugged into your reactor. Pull the control rods to make power, but keep the core cool or it melts down.',
    },
    challenges: [
      {
        id: 'reactor',
        title: 'Reactor Control',
        goal: 'Hold the power steady',
        why: [
        {
          icon: Gauge,
          title: 'Rods are the throttle',
          body: 'Control rods soak up the tiny particles that keep the reaction going. Rods out means more power. Rods in means less.',
        },
        {
          icon: Snowflake,
          title: 'Cooling keeps up with power',
          body: 'More power makes more heat. The coolant has to carry that heat away just as fast, or the core gets too hot.',
        },
        {
          icon: ShieldCheck,
          title: 'Safety is the whole job',
          body: 'Real reactors are all about balance and backups. You brought the power up slowly and kept it cool, exactly like the pros.',
        },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Nuclear engineering is careful balance: make big power, but always carry the heat away and keep a safe margin.',
    },
    diy: {
      title: 'Build a domino chain reaction',
      intro:
        'You cannot split atoms at home, but you CAN see a chain reaction: one thing triggers two, which trigger more.',
      diagram: 'domino-chain',
      materials: ['A box of dominoes (or dominoes made from cardboard)', 'A flat table or floor', 'A steady hand'],
      steps: [
        'Stand one domino up. This is your first atom.',
        'Just past it, stand up TWO dominoes so the first will knock both over.',
        'Past those, stand up even more, so each domino topples two others.',
        'Keep branching out into a fan shape.',
        'Tip the first one and watch the reaction spread and speed up.',
      ],
      experiment:
        'Now pull a few dominoes out of the middle, like inserting control rods. The chain slows or stops. That is exactly how a reactor is controlled.',
      safety: 'This one is just messy, not dangerous. Rebuilding is half the fun.',
    },
  },
  {
    slug: 'aerospace',
    name: 'Aerospace Engineering',
    shortName: 'Aerospace',
    tagline: 'Make things fly, and keep them flying.',
    description:
      'Planes, rockets, satellites, drones. Aerospace engineers fight gravity and win.',
    icon: Plane,
    accent: '#0ea5e9',
    tier: 'more',
    parent: 'mechanical',
    difficulty: 'Intermediate',
    intro: {
      heading: 'What do aerospace engineers do?',
      paragraphs: [
        'Aerospace engineers design anything that flies. They balance four forces: lift up, weight down, thrust forward, and drag back.',
        'Get the balance right and a heavy metal tube full of people cruises calmly through the sky. Get it wrong and it stalls or dives.',
      ],
      builds: ['Airliners', 'Rockets', 'Satellites', 'Drones', 'Helicopters', 'Space stations'],
      challengeTeaser:
        'You are the pilot and the engineer. Set the throttle and the wing angle to hold level flight without stalling.',
    },
    challenges: [
      {
        id: 'flight',
        title: 'Trim for Flight',
        goal: 'Fly straight and level',
        why: [
        {
          icon: Feather,
          title: 'Lift fights weight',
          body: 'Wings make lift by pushing air down. When lift exactly matches the plane\'s weight, it stops climbing or sinking.',
        },
        {
          icon: MoveUpRight,
          title: 'Angle makes lift, up to a point',
          body: 'Tilting the nose up makes more lift... until the angle gets too steep and the smooth airflow breaks away.',
        },
        {
          icon: TriangleAlert,
          title: 'Too steep means stall',
          body: 'Past the stall angle the wing suddenly loses its lift. Speed cannot save it. You have to lower the nose.',
        },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Flying is a balance of four forces. Level flight is just lift matching weight, with the wing kept below its stall angle.',
    },
    diy: {
      title: 'Trim a paper airplane',
      intro:
        'A paper plane has the same controls as a real one. A tiny bend at the back changes how it flies.',
      diagram: 'paper-plane',
      materials: ['One sheet of paper', 'Your hands', 'A bit of open space'],
      steps: [
        'Fold a classic dart paper airplane.',
        'At the very back edge of each wing, make two small cuts to form little flaps (elevators).',
        'Bend both flaps up just slightly.',
        'Throw the plane level and gently.',
        'Watch it pull its nose up and glide.',
      ],
      experiment:
        'Bend the flaps up more and it climbs then stalls, just like the game. Bend them down and it dives. Tiny changes, big difference.',
      safety: 'Aim away from faces. Paper points are pokey.',
    },
  },
  {
    slug: 'industrial',
    name: 'Industrial Engineering',
    shortName: 'Industrial',
    tagline: 'Make everything run faster and smoother.',
    description:
      'Factories, hospitals, theme park lines. Industrial engineers find the slow spot and fix it.',
    icon: Factory,
    accent: '#f97316',
    tier: 'more',
    parent: 'mechanical',
    difficulty: 'Beginner',
    intro: {
      heading: 'What do industrial engineers do?',
      paragraphs: [
        'Industrial engineers make systems run better. They look at how work flows and hunt down the thing that slows everything down.',
        'They design factory lines, shorten checkout queues, and plan hospitals so nobody waits too long. It is the engineering of efficiency.',
      ],
      builds: ['Factory lines', 'Delivery routes', 'Theme park queues', 'Hospital flow', 'Warehouses', 'Airport security'],
      challengeTeaser:
        'Your assembly line is falling behind. Move your workers to the slowest station and hit the target rate.',
    },
    challenges: [
      {
        id: 'assembly',
        title: 'Assembly Line',
        goal: 'Beat the target rate',
        why: [
        {
          icon: Timer,
          title: 'The slowest station wins',
          body: 'A line can only move as fast as its slowest step. That step is called the bottleneck.',
        },
        {
          icon: Users,
          title: 'Help where it hurts',
          body: 'Adding workers to a fast station does nothing. Adding them to the bottleneck speeds up the whole line.',
        },
        {
          icon: TrendingUp,
          title: 'Balance beats brute force',
          body: 'A smoothly balanced line, with no single slow spot, out-produces one with a few super-fast stations and one slow one.',
        },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Industrial engineering is bottleneck hunting: find the slowest step, fix that one, then find the next.',
    },
    diy: {
      title: 'Run a paper airplane factory',
      intro:
        'Turn a paper plane into a production line with friends or family, and find your bottleneck.',
      diagram: 'assembly-line',
      materials: ['A stack of paper', 'Tape or stickers', '2 to 3 helpers', 'A timer'],
      steps: [
        'Split the plane into steps: fold the wings, fold the body, add a tape nose.',
        'Give each person one step. Line up so paper flows from one to the next.',
        'Time how many finished planes you make in two minutes.',
        'Watch where the half-made planes pile up. That person is the bottleneck.',
        'Add a helper to the bottleneck, or trade jobs, and time it again.',
      ],
      experiment:
        'First build 10 planes alone, then 10 as a line. The line wins, but only if the bottleneck keeps up. Move help to the slow spot and beat your record.',
      safety: 'The only hazard here is paper cuts. Go slow on the folds.',
    },
  },
  {
    slug: 'systems',
    name: 'Systems Engineering',
    shortName: 'Systems',
    tagline: 'Make all the parts work as one.',
    description:
      'Spacecraft, self-driving cars, whole missions. Systems engineers keep every piece pulling together.',
    icon: Satellite,
    accent: '#ec4899',
    tier: 'more',
    parent: 'electrical',
    difficulty: 'Advanced',
    intro: {
      heading: 'What do systems engineers do?',
      paragraphs: [
        'Systems engineers see the whole picture. On a big project, dozens of parts each want more power, weight, or money, and it all has to fit.',
        'They make the trade-offs so every part gets just enough and the mission still works. It is less about one gadget and more about how everything connects.',
      ],
      builds: ['Space missions', 'Self-driving cars', 'Robots', 'Power plants', 'Aircraft', 'Smart cities'],
      challengeTeaser:
        'You have one satellite and a strict weight limit. Split the mass across the subsystems so the whole mission works.',
    },
    challenges: [
      {
        id: 'mission',
        title: 'Mission Budget',
        goal: 'Meet every requirement',
        why: [
        {
          icon: Scale,
          title: 'Everything is a trade-off',
          body: 'Give more mass to one subsystem and another gets less. There is never enough for everything to be maxed out.',
        },
        {
          icon: Share2,
          title: 'The parts depend on each other',
          body: 'More science instruments need more power AND more cooling. You cannot boost one part without feeding the others.',
        },
        {
          icon: Rocket,
          title: 'The mission has to close',
          body: 'A design only works when every requirement is met at once, within the budget. That is called closing the design.',
        },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Systems engineering is balancing the whole: sharing a limited budget so every connected part gets just enough.',
    },
    diy: {
      title: 'Egg drop on a budget',
      intro:
        'Protect an egg from a fall, but with limited money and weight. That squeeze is exactly what systems engineers feel.',
      diagram: 'egg-drop',
      materials: ['One raw egg', 'A cup, cotton balls, a plastic bag, tape, string', 'A pen and paper for your budget'],
      steps: [
        'Give each material a pretend cost: cup 3, handful of cotton 2, bag parachute 4, tape 1.',
        'Set a budget, say 10 points, and a rule that lighter is better.',
        'Design a capsule that protects the egg while staying under budget.',
        'Add up your cost before you build. Over budget? Trade something out.',
        'Drop it from up high and see if the egg survives.',
      ],
      experiment:
        'Try again with a smaller budget. You will have to give something up, and choosing what is the whole art of systems engineering.',
      safety: 'Do egg drops outside or over a trash bag, and let an adult know. Cleanup is part of the deal.',
    },
  },
  {
    slug: 'robotics',
    name: 'Robotics Engineering',
    shortName: 'Robotics',
    tagline: 'Give machines a body and a brain.',
    description:
      'Robot arms, drones, self-driving rovers. Robotics engineers blend motors, sensors, and code into things that move on their own.',
    icon: Bot,
    accent: '#14b8a6',
    tier: 'more',
    parent: 'mechanical',
    difficulty: 'Intermediate',
    intro: {
      heading: 'What do robotics engineers do?',
      paragraphs: [
        'Robotics engineers build machines that sense the world and act on it. A factory arm, a Mars rover, a vacuum that dodges your couch.',
        'The hard part is control: turning a goal like "touch that spot" into the exact joint moves that get there.',
      ],
      builds: ['Factory arms', 'Drones', 'Mars rovers', 'Prosthetic hands', 'Warehouse bots', 'Surgical robots'],
      challengeTeaser:
        'A robot arm needs to grab a part. Turn its two joints until the gripper lands right on the target.',
    },
    challenges: [
      {
        id: 'robot-arm',
        title: 'Robot Arm',
        goal: 'Reach the target',
        why: [
        {
          icon: Move,
          title: 'Two joints, many places',
          body: 'Each joint angle bends the arm. Together, two joints can put the gripper almost anywhere it can reach.',
        },
        {
          icon: Crosshair,
          title: 'Small turns near the end',
          body: 'When you are close, tiny changes to the elbow move the gripper just a little. That is how robots fine-tune.',
        },
        {
          icon: Cpu,
          title: 'Real robots do this math',
          body: 'You found the angles by feel. A robot computes them instantly, thousands of times a second.',
        },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Robotics is turning a goal into motion: the right angles at each joint to put the hand exactly where you want it.',
    },
    diy: {
      title: 'Build a cardboard grabber',
      intro:
        'Make a claw that reaches out and grabs, powered by your own hand. A first taste of robot arms.',
      diagram: 'grabber',
      materials: ['Thick cardboard', 'Two split pins (brads) or small bolts', 'Scissors', 'A rubber band'],
      steps: [
        'Cut four equal cardboard strips.',
        'Join them into two X shapes, pinned in the middle so each X can scissor open and shut.',
        'Link the two X shapes end to end to make a stretchy lattice.',
        'Add small cardboard jaws at the far end.',
        'Squeeze the near end and watch the far jaws reach out and close.',
      ],
      experiment:
        'Notice how a small squeeze at your hand becomes a big reach at the tip. That is a linkage, the same idea inside robot arms and diggers.',
      safety: 'Split pins have sharp points. Fold them flat when you finish.',
    },
  },
  {
    slug: 'environmental',
    name: 'Environmental Engineering',
    shortName: 'Environmental',
    tagline: 'Keep our water, air, and land clean.',
    description:
      'Clean water, fresh air, less waste. Environmental engineers protect people and the planet at the same time.',
    icon: Droplets,
    accent: '#0d9488',
    tier: 'more',
    parent: 'civil',
    difficulty: 'Beginner',
    intro: {
      heading: 'What do environmental engineers do?',
      paragraphs: [
        'Environmental engineers keep the stuff we all share clean. They design the plants that make dirty water safe to drink.',
        'They also clean up smoke, plan recycling, and protect rivers. It is engineering with the planet in mind.',
      ],
      builds: ['Water treatment plants', 'Air scrubbers', 'Recycling systems', 'Clean rivers', 'Landfills', 'Solar farms'],
      challengeTeaser:
        'Dirty water is flowing in. Switch on the right filter stages to clean it, without wasting money.',
    },
    challenges: [
      {
        id: 'water',
        title: 'Clean Stream',
        goal: 'Make the water safe',
        why: [
        {
          icon: Filter,
          title: 'Each stage catches one thing',
          body: 'A screen stops trash, sand traps dirt, carbon grabs chemicals, and UV zaps germs. Different problems, different filters.',
        },
        {
          icon: Recycle,
          title: 'Only what you need',
          body: 'Every stage costs money and energy. Clean engineers add just the stages the water actually needs, and no more.',
        },
        {
          icon: Sprout,
          title: 'Clean water, real lives',
          body: 'This is not a game for millions of people. Safe water is one of engineering\'s biggest gifts to the world.',
        },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Environmental engineering is matching the fix to the problem: the right cleanup steps, for the least cost.',
    },
    diy: {
      title: 'Build a bottle water filter',
      intro:
        'Turn muddy water clearer with layers you can find at home. The same idea as a real treatment plant.',
      diagram: 'bottle-filter',
      materials: ['An empty plastic bottle', 'A coffee filter or cloth', 'Sand, small gravel, and cotton', 'Muddy water in a cup'],
      steps: [
        'Cut the bottom off the bottle and turn it upside down (cap end down, cap loosened).',
        'Layer in cotton at the bottom, then sand, then gravel on top.',
        'Slowly pour your muddy water in the top.',
        'Watch cleaner water drip out the bottom.',
        'Compare it to the muddy cup you started with.',
      ],
      experiment:
        'Add more layers or finer sand and pour again. More stages catch more dirt, just like adding filters in the game. (Still do not drink it!)',
      safety: 'This water is clearer, not safe to drink. It is a demo only.',
    },
  },
  {
    slug: 'structural',
    name: 'Structural Engineering',
    shortName: 'Structural',
    tagline: 'Keep tall things standing.',
    description:
      'Skyscrapers, stadiums, towers. Structural engineers make sure the biggest buildings never fall down.',
    icon: Building,
    accent: '#0891b2',
    tier: 'more',
    parent: 'civil',
    difficulty: 'Intermediate',
    intro: {
      heading: 'What do structural engineers do?',
      paragraphs: [
        'Structural engineers design the bones of big buildings. They figure out what holds the weight and fights the wind.',
        'The taller you build, the harder the wind pushes. Their job is to make a skyscraper stiff enough that it barely sways.',
      ],
      builds: ['Skyscrapers', 'Stadiums', 'Towers', 'Big roofs', 'Bridges', 'Roller coasters'],
      challengeTeaser:
        'Design a skyscraper that stands up to the wind. Pick a strong core and stay under budget.',
    },
    challenges: [
      {
        id: 'tower',
        title: 'Sky High',
        goal: 'Beat the wind',
        why: [
        {
          icon: Wind,
          title: 'Tall means windy',
          body: 'Wind pushes sideways, and the taller the tower, the bigger the push. Height is the enemy of stillness.',
        },
        {
          icon: Anchor,
          title: 'A wide base fights sway',
          body: 'Spreading the base out gives the tower a bigger grip on the ground, so it leans less. Cheap and effective.',
        },
        {
          icon: Weight,
          title: 'A damper cancels the sway',
          body: 'A heavy weight up top that swings the opposite way soaks up the motion. Many real skyscrapers hide one inside.',
        },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Structural engineering is a balance of stiffness and cost: strong enough to stand still, cheap enough to build.',
    },
    diy: {
      title: 'Build the tallest paper tower',
      intro:
        'With just paper and tape, build the tallest tower that can still hold a book. Height versus strength, live.',
      diagram: 'paper-tower',
      materials: ['A few sheets of paper', 'Tape', 'A paperback book for testing'],
      steps: [
        'Roll some sheets into tight tubes. Tubes are far stronger than flat paper.',
        'Stand the tubes up as columns and tape them into a base.',
        'Build upward, keeping the base wider than the top.',
        'Balance the book on top.',
        'If it holds, take the book off, add height, and test again.',
      ],
      experiment:
        'Try one tall skinny tower and one shorter wide one. The wide base wins against a "wind" push from your hand, just like in the game.',
      safety: 'Nothing risky here, just do not stack it so high it topples onto something.',
    },
  },
  {
    slug: 'computer',
    name: 'Computer Engineering',
    shortName: 'Computer',
    tagline: 'Build the brains inside every device.',
    description:
      'Chips, logic, and the tiny switches that run everything. Computer engineers design the hardware that thinks.',
    icon: CircuitBoard,
    accent: '#6366f1',
    tier: 'more',
    parent: 'electrical',
    difficulty: 'Advanced',
    intro: {
      heading: 'What do computer engineers do?',
      paragraphs: [
        'Computer engineers design the hardware that runs code: the chips in your phone, laptop, and game console.',
        'Deep down, a chip is millions of tiny switches wired into logic gates. Those gates make every decision a computer makes.',
      ],
      builds: ['Computer chips', 'Game consoles', 'Phone processors', 'Smart watches', 'Robot brains', 'Servers'],
      challengeTeaser:
        'A gadget needs to follow a rule, like "on only when both switches are pressed." Pick the logic gate that matches.',
    },
    challenges: [
      {
        id: 'logic',
        title: 'Logic Lab',
        goal: 'Match the rule',
        why: [
        {
          icon: ToggleLeft,
          title: 'Everything is on or off',
          body: 'Computers only know two things: on and off, 1 and 0. Every switch you flipped was one of those.',
        },
        {
          icon: Binary,
          title: 'Gates make decisions',
          body: 'AND, OR, and XOR are little rule-followers. Wire them together and they can decide anything.',
        },
        {
          icon: Lightbulb,
          title: 'Millions of these = a computer',
          body: 'One gate is simple. Pack millions onto a chip and they can run games, videos, and the whole internet.',
        },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Computer engineering is built from simple choices: tiny gates that each say yes or no, stacked into something that thinks.',
    },
    diy: {
      title: 'Two-switch logic light',
      intro:
        'Wire two switches to a light two different ways and feel the difference between AND and OR, for real.',
      diagram: 'two-switch',
      materials: ['A battery and a small bulb or LED', 'Two homemade switches (foil + paperclip)', 'Wire or foil strips, tape'],
      steps: [
        'Wire both switches in a row (in series) between the battery and the bulb.',
        'Try it: the bulb lights only when BOTH switches are closed. That is an AND gate.',
        'Now rewire so each switch has its own path to the bulb (in parallel).',
        'Try again: the bulb lights when EITHER switch is closed. That is an OR gate.',
        'Flip the switches in every combination and watch the light.',
      ],
      experiment:
        'You just built two logic gates with your hands. Series is AND, parallel is OR. Real chips do this with microscopic switches.',
      safety: 'Use a single battery and an LED or small bulb. Never wire to a wall outlet.',
    },
  },
]

export function getDiscipline(slug: string | undefined) {
  return disciplines.find((d) => d.slug === slug)
}
