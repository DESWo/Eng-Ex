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
  Flame,
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
  Search,
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
        goal: 'Knock the fort down',
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
        id: 'suspension',
        title: 'Smooth Ride',
        goal: 'Tame the bumps',
        why: [
          {
            icon: Gauge,
            title: 'Springs trade motion for comfort',
            body: 'A spring lets the wheel chase the road while the body floats above it. Softer rides smoother, but a loaded van squashes a soft spring through all its travel.',
          },
          {
            icon: Wind,
            title: 'Resonance is the ambush',
            body: 'Every spring has a rhythm it naturally bounces at. If the road hits that same rhythm, each bump adds to the last and a small shake grows violent. Strength does not save you; changing the rhythm does.',
          },
          {
            icon: Cog,
            title: 'Dampers blunt what they cannot move',
            body: 'A shock absorber turns bounce into heat. It cannot shift the resonance, only flatten it, which is why engineers pick the spring first and the damper second.',
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
      tradeoff:
        'Every machine trades one thing for another: speed for force, power for control, simple for strong.',
      realWorld: {
        intro: 'The same forces you tuned run the machines all around you.',
        examples: [
          'Car suspensions use your spring-and-damper tuning so the body floats while the wheels chase the road.',
          'Robot arms in factories aim with the exact torque idea from the balance beam.',
          'Catapults and trebuchets flung stones with your launch physics for centuries.',
        ],
      },
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
        'Slide the 3-stick stack closer to or farther from the spoon and launch again. You just changed the launch angle, exactly like changing your pull in Catapult Lab.',
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
      tradeoff:
        'Civil engineers balance strength, safety, and cost, and there is never quite enough budget for all three.',
      realWorld: {
        intro: 'You just used the tools that shape real cities.',
        examples: [
          'Truss bridges span highways and rivers with the exact triangles you built.',
          'Traffic engineers time real city lights the way you split the green.',
          'Buildings in earthquake zones use bracing and base isolation like your tower.',
        ],
      },
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
        'A whole neighbourhood is sitting in the dark. Route power lines from the plant to every home before the wire runs out.',
    },
    challenges: [
      {
        id: 'power-grid',
        title: 'Power Up',
        goal: 'Light every house',
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
      tradeoff:
        'Electrical design trades wire, cost, and safety margins against getting power everywhere it needs to go.',
      realWorld: {
        intro: 'This is how the power in your walls actually works.',
        examples: [
          'The power grid routes electricity to millions of homes like your Power Up map.',
          'Every phone and console is a maze of circuits like the ones you wired.',
          'The breaker panel in your house does exactly what Don\'t Trip models.',
        ],
      },
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
      {
        id: 'shield',
        title: 'Shield Stack',
        goal: 'Make it safe to stand there',
        why: [
          {
            icon: ShieldCheck,
            title: 'Each centimetre cuts it again',
            body: 'Shielding does not chip away a fixed amount. Every centimetre removes the same fraction of what is left, so the dose falls away steeply rather than steadily.',
          },
          {
            icon: Atom,
            title: 'Gamma and neutrons want opposite things',
            body: 'Dense metal like lead is superb at stopping gamma rays and nearly useless against neutrons. Neutrons are slowed by light hydrogen-rich stuff like water and plastic, because a neutron loses most of its energy hitting something its own size.',
          },
          {
            icon: Weight,
            title: 'Real shields are layered',
            body: 'Because no single material handles everything, a working shield is a sandwich: something light for the neutrons, something dense for the gamma, and as little of the expensive stuff as you can get away with.',
          },
        ],
      },
      {
        id: 'decay-heat',
        title: 'Decay Heat',
        goal: 'Keep it cool for a day',
        why: [
          {
            icon: Flame,
            title: 'Off is not cold',
            body: 'Shutting a reactor down stops the chain reaction, not the heat. The fragments left in the fuel keep decaying, and for the first hour that is still tens of megawatts with nowhere to go.',
          },
          {
            icon: Timer,
            title: 'It fades slowly and never stops',
            body: 'Decay heat drops fast at first and then crawls. A day later it is still running at a few percent, which is why cooling has to keep working long after everyone assumes the danger has passed.',
          },
          {
            icon: Recycle,
            title: 'Passive cooling needs no power',
            body: 'Hot water rises and cold water sinks, so coolant circulates on its own. It is weak, but once decay heat has faded far enough, weak is exactly enough, and it cannot run out of battery.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Nuclear engineering is careful balance: make big power, but always carry the heat away and keep a safe margin.',
      tradeoff:
        'A reactor trades more power for more heat, so cooling and safety margins must grow right alongside it.',
      realWorld: {
        intro: 'Real reactors are run by this same balance, every second.',
        examples: [
          'Power plants make about a tenth of the world\'s electricity from reactors like yours.',
          'Submarines and some spacecraft carry compact reactors for years of power.',
          'Operators watch power and temperature gauges just like the ones you balanced.',
        ],
      },
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
      {
        id: 'orbit',
        title: 'Orbit Insertion',
        goal: 'Park it in a circle',
        why: [
          {
            icon: Rocket,
            title: 'Forward, not upward',
            body: 'Firing your engine forwards does not lift you straight up. It stretches the far side of your orbit outwards, which is why a burn here shows up as height half a lap away.',
          },
          {
            icon: Satellite,
            title: 'Reaching is not staying',
            body: 'One burn only touches the target height once per lap before falling back. A second burn at the top lifts the low side to match, and that is what actually parks a satellite.',
          },
          {
            icon: PiggyBank,
            title: 'Every drop is planned years ahead',
            body: 'Nothing refuels in orbit, so a mission budgets its speed changes before launch. Real transfers use this exact two-burn manoeuvre because it is the cheapest one there is.',
          },
        ],
      },
      {
        id: 'reentry',
        title: 'Re-entry',
        goal: 'Bring the crew home',
        why: [
          {
            icon: Flame,
            title: 'There is a corridor, not a target',
            body: 'Come in too shallow and you skip off the atmosphere back into space. Too steep and the shield cannot soak up the heat in time. Every returning spacecraft threads the gap between those two.',
          },
          {
            icon: ShieldCheck,
            title: 'Blunt is what survives',
            body: 'A pointed nose sits right in the hottest air. A blunt one pushes a thick shock wave out in front that holds the worst heat away from the skin, which is why real capsules look like squashed cones.',
          },
          {
            icon: TriangleAlert,
            title: 'Peak heat and total heat are different problems',
            body: 'A steep entry hits harder but is over quickly. A shallow one is gentle but soaks for far longer, so it needs a thicker shield. Engineers have to design for both at once.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Flying is a balance of four forces. Level flight is just lift matching weight, with the wing kept below its stall angle.',
      tradeoff:
        'Flight trades lift against weight and thrust against drag, and pushing one too far costs you another.',
      realWorld: {
        intro: 'Every plane you have flown on lives by these four forces.',
        examples: [
          'Airliners "trim" for level cruise exactly like you did.',
          'Pilots train hard to avoid the stall you triggered by over-tilting the nose.',
          'Wings, flaps, and tails are all shaped to manage lift and drag.',
        ],
      },
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
      {
        id: 'quality-gate',
        title: 'Quality Gate',
        goal: 'Stop shipping faults',
        why: [
          {
            icon: Search,
            title: 'A defect gets dearer the longer it hides',
            body: 'A unit spoiled at the first station is worth almost nothing. Let it travel and every station after pours more work into something already ruined, so the same fault costs several times more to throw away.',
          },
          {
            icon: Factory,
            title: 'End-of-line checking can lose money',
            body: 'Inspecting only at the end catches every fault and still costs more than inspecting nothing, because you are binning finished goods. Real factories check just before the expensive steps instead.',
          },
          {
            icon: PiggyBank,
            title: 'Quality has three bills, not one',
            body: 'What you spend inspecting, what you waste scrapping, and what customers charge you for the ones that got through. Push any one to zero and the other two climb, so the job is balancing all three.',
          },
        ],
      },
      {
        id: 'warehouse',
        title: 'Warehouse Layout',
        goal: 'Save the pickers a walk',
        why: [
          {
            icon: Route,
            title: 'Distance is paid once per trip',
            body: 'A product fetched forty times a day is walked to forty times a day, so moving it one aisle closer saves that distance forty times over. Layout is multiplied by frequency, which is why it matters so much.',
          },
          {
            icon: Weight,
            title: 'Counting trips is not the same as counting work',
            body: 'Cement gets picked six times a day and weighs forty kilos. Tape gets picked twenty times and weighs nothing. Once you count what people are actually carrying, the rarely picked heavy things belong nearest the door, which is the opposite of what trip counts alone suggest.',
          },
          {
            icon: Users,
            title: 'The best aisle gets crowded',
            body: 'Everything wants to live at the front, but a front aisle full of the busiest products fills up with pickers queueing round each other. Real warehouses spread the traffic out on purpose.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Industrial engineering is bottleneck hunting: find the slowest step, fix that one, then find the next.',
      tradeoff:
        'Industrial engineers trade workers, machines, and money to squeeze more output from the same line.',
      realWorld: {
        intro: 'The world\'s factories and warehouses run on this idea.',
        examples: [
          'Car plants balance their assembly stations to keep the line moving.',
          'Amazon warehouses are designed around finding and fixing bottlenecks.',
          'Even theme-park queues and hospital ERs are laid out this way.',
        ],
      },
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
      {
        id: 'redundancy',
        title: 'Backup Plan',
        goal: 'Get the odds up',
        why: [
          {
            icon: Share2,
            title: 'Odds multiply, so they only go down',
            body: 'If every subsystem has to survive, the chance of all of them making it is each chance multiplied together. Four parts that are each 95 percent reliable give a mission that is only 81 percent reliable.',
          },
          {
            icon: ShieldCheck,
            title: 'A spare only helps if the part was likely to fail',
            body: 'Doubling up something that was already going to survive changes almost nothing. Doubling up the shakiest part can move the whole mission several percentage points, which is why engineers hunt for the weak link before spending anything.',
          },
          {
            icon: Weight,
            title: 'Redundancy is paid in mass and money',
            body: 'A spare is a whole extra piece of hardware to build, test, and lift. Real spacecraft carry backups only where the sums say the risk is worth the kilograms.',
          },
        ],
      },
      {
        id: 'critical-path',
        title: 'Critical Path',
        goal: 'Hit the deadline',
        why: [
          {
            icon: Timer,
            title: 'One chain decides the date',
            body: 'A project finishes when its longest chain of dependent work finishes. Everything else is running alongside with time to spare, so the finish date is decided by that one chain and nothing else.',
          },
          {
            icon: Route,
            title: 'Speeding up spare work buys nothing',
            body: 'Pour money into a task that was already waiting around and the project finishes on exactly the same day. It is the single most common way project budgets get wasted, and it always feels productive at the time.',
          },
          {
            icon: TrendingUp,
            title: 'The critical path moves',
            body: 'Shorten the critical chain enough and a different chain becomes the longest one. From then on your money has to go somewhere else, which is why schedules get replanned rather than set once.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Systems engineering is balancing the whole: sharing a limited budget so every connected part gets just enough.',
      tradeoff:
        'Systems engineers trade mass, power, and money across every subsystem so the whole mission still works.',
      realWorld: {
        intro: 'This is the job that gets spacecraft off the ground.',
        examples: [
          'NASA and SpaceX split a strict mass and power budget across every subsystem.',
          'Satellites balance science, comms, power, and thermal exactly like your mission.',
          'Self-driving cars juggle sensors, computers, and battery the same way.',
        ],
      },
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
        title: 'Claw Machine',
        goal: 'Win every prize',
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
      {
        id: 'line-follower',
        title: 'Line Follower',
        goal: 'Drive the whole track',
        why: [
          {
            icon: Route,
            title: 'Sense, decide, steer, repeat',
            body: 'The bot measures how far it has drifted, steers back, then measures again. That loop runs hundreds of times a second inside anything that drives itself.',
          },
          {
            icon: TrendingUp,
            title: 'Steering harder is not steering better',
            body: 'Crank the strength up and the bot overshoots, then overcorrects, then weaves wider and wider. Real control systems fail exactly this way.',
          },
          {
            icon: Gauge,
            title: 'Damping watches the rate of change',
            body: 'By reacting to how fast the error is growing instead of how big it is, damping catches an overshoot before it happens. Cruise control and drone autopilots do the same thing.',
          },
        ],
      },
      {
        id: 'gripper',
        title: 'Safe Grip',
        goal: 'Hold it without breaking it',
        why: [
          {
            icon: Scale,
            title: 'Friction decides the minimum',
            body: 'A gripper does not hold things by being strong, it holds them by friction. Grippier pads need far less squeeze to stop the same object slipping.',
          },
          {
            icon: ShieldCheck,
            title: 'Real parts have a ceiling too',
            body: 'Most things an engineer handles break under enough force, so the safe answer is a window between slipping and crushing, not a single number.',
          },
          {
            icon: Timer,
            title: 'Moving fast costs margin',
            body: 'Accelerating an object hard means the gripper fights its weight and its inertia at once. Every second you shave off the lift eats into your safety margin.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Robotics is turning a goal into motion: the right angles at each joint to put the hand exactly where you want it.',
      tradeoff:
        'Robots trade reach, speed, and precision: a long, fast arm is rarely also a delicate one.',
      realWorld: {
        intro: 'The angles you found are what real robots compute constantly.',
        examples: [
          'Factory arms weld and assemble by solving joint angles thousands of times a second.',
          'Surgical robots place their tools with millimeter precision the same way.',
          'Mars rovers reach out and grab rock samples with jointed arms.',
        ],
      },
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
      {
        id: 'solar',
        title: 'Solar Array',
        goal: 'Keep the lights on',
        why: [
          {
            icon: Sprout,
            title: 'A panel rating is not a daily total',
            body: 'A 3 kW array does not make 3 kW all day. It makes nothing before sunrise, peaks around noon, and fades to nothing again, so what it actually delivers is that rating multiplied by a handful of useful sun hours.',
          },
          {
            icon: Zap,
            title: 'Generating it is not the same as having it',
            body: 'You can generate twice what a house uses and still sit in the dark every evening, because the sun sets exactly when everyone comes home and starts cooking. Matching daily totals proves almost nothing.',
          },
          {
            icon: Recycle,
            title: 'Storage is what makes it usable',
            body: 'A battery moves midday surplus into the evening, which is the only reason a solar house works after dark. It is also why grids with lots of renewables spend so much effort on storing energy rather than just making more.',
          },
        ],
      },
      {
        id: 'stormwater',
        title: 'Stormwater',
        goal: 'Keep it off the road',
        why: [
          {
            icon: Droplets,
            title: 'Drains are sized for the average, not the storm',
            body: 'Rain in a downpour arrives far faster than any sensible pipe can carry away. The job is not moving it faster, it is holding the surge somewhere until the pipe catches up.',
          },
          {
            icon: Sprout,
            title: 'Shrinking the flood beats storing it',
            body: 'Tarmac sheds almost every drop that lands on it. Permeable paving and planting drink a good share before it ever becomes runoff, and cutting the flood at the source is usually far cheaper than digging somewhere to put it.',
          },
          {
            icon: Building,
            title: 'The site still has to do its job',
            body: 'You could solve any drainage problem by turning the whole site into a meadow, except then nobody can park. Real schemes balance staying dry, staying affordable, and still being useful.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Environmental engineering is matching the fix to the problem: the right cleanup steps, for the least cost.',
      tradeoff:
        'Clean engineers trade cost and energy against how pure the water, air, or soil ends up.',
      realWorld: {
        intro: 'Your filter is a shrunk-down version of a real treatment plant.',
        examples: [
          'City water plants stack screens, sand, carbon, and UV just like your stages.',
          'The same layered idea cleans wastewater before it returns to rivers.',
          'Air scrubbers on factories match each cleanup step to the pollutant.',
        ],
      },
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
      {
        id: 'beam-section',
        title: 'Beam Section',
        goal: 'Stiff enough, light enough',
        why: [
          {
            icon: ArrowDownToLine,
            title: 'Depth counts three times over',
            body: 'Stiffness grows with the cube of the depth, so making a beam twice as deep makes it eight times harder to bend. Depth is by far the cheapest stiffness you can buy.',
          },
          {
            icon: Columns3,
            title: 'The middle is barely working',
            body: 'Bending stretches one face and squashes the other, and right through the centre runs a line carrying almost no stress at all. Metal sitting there is mostly just weight.',
          },
          {
            icon: Feather,
            title: 'That is why beams are I-shaped',
            body: 'Cut out the lazy middle and put that metal at the top and bottom instead, and you keep nearly all the stiffness for a fraction of the weight. Every steel-framed building you have walked past is built on this one idea.',
          },
        ],
      },
      {
        id: 'foundation',
        title: 'Foundation',
        goal: 'Keep it standing straight',
        why: [
          {
            icon: ArrowDownToLine,
            title: 'Soil carries pressure, not weight',
            body: 'A column does not care how heavy it is, the ground cares how hard it is pushed. Spreading the same load over a wider footing drops the pressure fast, because area grows with the square of the width.',
          },
          {
            icon: Scale,
            title: 'Sinking is fine, tilting is not',
            body: 'A building can settle several centimetres and be perfectly usable. Let one side settle further than the other and the frame twists, doors jam, and walls crack. Engineers design for the difference, not the total.',
          },
          {
            icon: TriangleAlert,
            title: 'Safe footings can still wreck a building',
            body: 'Size each footing just to pass its own pressure check and both are individually fine, yet the heavier column still sinks further. Getting them to settle together means making the heavy footing wider than its own check ever asks for.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Structural engineering is a balance of stiffness and cost: strong enough to stand still, cheap enough to build.',
      tradeoff:
        'Structural engineers trade stiffness against cost: a rock-solid tower nobody can afford is a failed design.',
      realWorld: {
        intro: 'Real skyscrapers fight the wind with the tricks you used.',
        examples: [
          'Taipei 101 hides a giant tuned mass damper like the one you added.',
          'Wide bases and braced cores keep towers steady in storms and quakes.',
          'Bridges and stadium roofs balance the same stiffness-versus-cost call.',
        ],
      },
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
      {
        id: 'binary',
        title: 'Binary Bulbs',
        goal: 'Send the reading',
        why: [
          {
            icon: Binary,
            title: 'Every place is worth double',
            body: 'Bulbs are worth 1, 2, 4, 8, 16 and so on, so any whole number can be built by switching on the right few. This is how every value inside every computer is actually stored.',
          },
          {
            icon: Cable,
            title: 'Width sets the ceiling',
            body: 'With n signal lines you can only ever count up to 2 to the n, minus one. Choosing that width is a real design decision: too narrow and readings get clipped, too wide and you pay for wires you never use.',
          },
          {
            icon: ToggleLeft,
            title: 'A minus sign is not free',
            body: 'To send negative numbers, one bulb has to stop carrying a value and start carrying the sign. You have not gained anything for nothing, you have traded away half your range.',
          },
        ],
      },
      {
        id: 'error-check',
        title: 'Error Check',
        goal: 'Make the link trustworthy',
        why: [
          {
            icon: ShieldCheck,
            title: 'Silent corruption is the real enemy',
            body: 'Data arriving wrong is bad. Data arriving wrong while everything reports success is far worse, because every calculation downstream quietly trusts it. Check bits exist to turn silent errors into loud ones.',
          },
          {
            icon: Share2,
            title: 'Detecting and repairing are different jobs',
            body: 'One check bit can tell you something broke. It takes several before the receiver can work out WHICH bit broke and repair it without asking for a resend, which is the only option when the sender is hours away.',
          },
          {
            icon: Gauge,
            title: 'Protection is paid for in bandwidth',
            body: 'Every check bit is a bit not carrying data, and every resend sends the same packet twice. Reliability is never free, so engineers buy exactly as much as the link actually needs.',
          },
        ],
      },
    ],
    learn: {
      heading: 'Why did that work?',
      bigIdea:
        'Computer engineering is built from simple choices: tiny gates that each say yes or no, stacked into something that thinks.',
      tradeoff:
        'Chip designers trade speed, power, and size: faster chips run hotter and cost more to make.',
      realWorld: {
        intro: 'Every device you own is built from the gates you tested.',
        examples: [
          'A phone chip packs billions of AND, OR, and NOT gates like yours.',
          'Those gates add up to the logic that runs games, video, and the internet.',
          'The same gates control smart lights, cars, and home appliances.',
        ],
      },
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
