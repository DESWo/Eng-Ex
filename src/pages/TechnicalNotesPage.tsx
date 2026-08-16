/**
 * Technical notes: what each simulation actually computes, for an adult
 * evaluating the engineering rather than a student playing it.
 *
 * Rules for editing this page: every equation is a transcription of code in the
 * file named at the head of its section, every quoted number is a constant from
 * that file, and no claim goes in that the code does not do. If a model changes,
 * this page is wrong until it is changed too.
 */

/** One transcribed equation, plus what the symbols are. */
interface Equation {
  expr: string
  note?: string
}

/** A documented model. Every field is required, which is the point. */
interface ModelNote {
  id: string
  /** Section number, printed in mono. */
  n: string
  title: string
  /** Where the maths lives, and which game uses it. */
  source: string[]
  game: string
  /** What the code returns. */
  computes: string
  equations: Equation[]
  /** Choices the model makes that a reader should weigh. */
  assumptions: string[]
  /** Which way the simplifications push the answer. */
  errs: string
  /** Absent physics, named. */
  notModelled: string[]
  /** A script under scripts/, or an honest absence. */
  evidence: string
  verified: boolean
}

const MODELS: ModelNote[] = [
  {
    id: 'truss',
    n: '01',
    title: 'The truss stiffness solver',
    source: ['src/challenges/civil/truss.ts', 'src/challenges/civil/BridgeChallenge.tsx'],
    game: 'Bridge Builder, civil engineering',
    computes:
      'Axial force in every beam you drew and the movement of every joint that is not anchored, for one truck load sitting on one deck joint. The game calls the solver again at every deck joint the truck rolls over, keeps the worst utilisation each member ever sees, and keeps the bent shape from whichever position sagged most. A span with too few triangles is a mechanism, and the deflections blow up rather than settle.',
    equations: [
      { expr: 'K u = f', note: 'assembled over the free joints only, two degrees of freedom each' },
      { expr: 'k = EA / L,   c = Δx / L,   s = Δy / L', note: 'per member, from the drawn geometry' },
      { expr: 'k_local = k · [[c², cs], [cs, s²]]', note: 'scattered into K at both joints, negated across the pair' },
      { expr: 'F = (EA / L) · ((u_b − u_a) · [c, s])', note: 'positive is tension, negative is compression' },
      { expr: 'utilisation = |F| / capacity', note: 'capacity depends on the material and on the sign of F' },
    ],
    assumptions: [
      'Pin jointed and axial only. A beam carries force along its length and nothing else, so no joint transmits a moment.',
      'Linear elastic, small displacement. K is built from the shape you drew and never from the deflected shape, so the solve does not iterate.',
      'Every member has the same axial stiffness, EA = 6000, whatever it is made of. Wood and steel differ in capacity and price only. Sag is therefore purely geometric: depth buys stiffness, material does not.',
      'Strength is a flat number per material per direction: wood 22 in tension and 14 in compression, steel 50 and 38. Compression capacity does not fall as a member gets longer.',
      'Both banks are pinned in x and y. That is four restrained degrees of freedom where a pin and a roller would give three, so most spans you can draw are statically indeterminate. The stiffness method does not need determinacy, but the force split is not the one a determinate hand calculation would produce.',
      'Instability is a threshold, not a rank test. A whisper of grounding, EA / 1e7, is added to the diagonal so a mechanism gives huge finite movement instead of a singular matrix, and more than 60 px of movement is reported as folded.',
      'Units are drawing pixels. 20 px is one metre of river, which is how joint movement becomes centimetres of sag. Load and capacity share one arbitrary scale with no newtons behind it.',
    ],
    errs: 'Optimistic on long compression members. With no buckling term, a slender strut is allowed to carry its full rated compression at any length, so a real bridge built to a design the game passes could fail before the game says it does. The other simplifications make the model smaller, not softer.',
    notModelled: [
      'Self weight and any distributed dead load. The only force in the system is the truck.',
      'Dynamics. The truck is a static load stepped along the deck, so there is no impact factor and no bounce.',
      'Bending, joint fixity, and connection detail.',
      'Yielding, fatigue, and any post-failure behaviour. A member either is or is not over capacity.',
      'Wind, temperature, and anything out of plane. The model is 2D.',
    ],
    evidence:
      'None. No script under scripts/ exercises this solver, so the only thing standing behind it is the code itself.',
    verified: false,
  },
  {
    id: 'quake',
    n: '02',
    title: 'The shear-building earthquake model',
    source: ['src/challenges/civil/shear.ts', 'src/challenges/civil/QuakeChallenge.tsx'],
    game: 'Shake Proof, civil engineering',
    computes:
      'One lateral displacement per floor, integrated through a 20 second synthetic earthquake at a 0.02 s step. Out come the natural periods and the first mode shape, the peak inter-storey drift ratio of every storey, the peak total acceleration every floor feels, the peak base and roof travel, the whole displacement history so the shake can be replayed frame by frame, and the first step and storey to cross the drift cap. Level 4 also runs a response spectrum: 50 log-spaced periods, each a full run of the same integrator, so the spectrum panel cannot disagree with the verdict the building got.',
    equations: [
      { expr: 'M u¨ + C u˙ + K u = −M 1 a_g(t)', note: 'K is tridiagonal: each storey spring ties one floor to the one below' },
      {
        expr: 'k_storey = K_BARE · (3.4/h)³ · open + n · K_BRACE · (√(6² + 3.4²) / √(6² + h²))³',
        note: 'columns bend, so a storey softens as the cube of its height; a brace is axial, so it softens as the cube of its diagonal',
      },
      { expr: 'Newmark average acceleration, β = 1/4, γ = 1/2', note: 'unconditionally stable, no numerical damping' },
      { expr: 'C = a₀ M + a₁ K,   a₀ = 2ζω₁ω₂/(ω₁+ω₂),   a₁ = 2ζ/(ω₁+ω₂)', note: 'Rayleigh damping pinned to ζ = 0.05 on the first two modes' },
      { expr: 'eig( M^(−1/2) K M^(−1/2) )  by Jacobi rotation', note: 'periods and mode shapes, no shortcut formula' },
      { expr: 'x¨ + 2ζ_g ω_g x˙ + ω_g² x = −w(t) e(t),   a_g = −(2ζ_g ω_g x˙ + ω_g² x)', note: 'Kanai-Tajimi: seeded white noise through a site filter, under a rise, plateau and decay envelope, then scaled so the peak equals the level PGA' },
      { expr: 'drift_i = |u_i − u_(i−1)| / h_i', note: 'the quantity the level is scored on, in metres of slip per metre of height' },
    ],
    assumptions: [
      'One lateral degree of freedom per floor, floors rigid, columns in flexure. That is the right model for six storeys and the wrong one for a slender tower, where bending of the whole building takes over and floors stop staying level.',
      'Linear elastic, with no behaviour factor. Capacities are checked against the elastic response, which is how hospitals and isolated buildings are designed and is conservative for an ordinary ductile frame.',
      'Storey stiffness comes out of the geometry above rather than a fitted table. The 5 m glazed lobby lands at 0.236 of a normal storey, and a brace there delivers 0.688 of what the same brace delivers upstairs.',
      'The ground motion is synthetic, not a recorded accelerogram, and one record is not a suite. The seed is fixed at 12345, so a design that passes once passes forever. That is a teaching decision, not a statistical one.',
      'How many braces a storey carries matters. Which of its three bays they sit in does not, because bay position would need torsion and a 3D model.',
      'Rayleigh damping means higher modes are damped harder than 5%. Isolation bearings get their own explicit dashpot at the base degree of freedom rather than a smeared value, so 18% bearing damping does not leak into the frame.',
      'The Kanai-Tajimi filter itself is integrated with forward Euler at the same 0.02 s step. Only the structure gets Newmark.',
    ],
    errs: 'Past the limit, too loud. A linear elastic model has no way to yield and shed load, so once a storey is past roughly twice the drift cap the numbers describe a building that has already come apart. The game clamps its readout at 40 mm/m for that reason and says it is clamping. Under the limit, where every level is actually scored, elastic is the correct model.',
    notModelled: [
      'Nonlinearity of any kind: no hinging, no hysteresis, no ductility, no strength degradation, no residual drift.',
      'Torsion, plan irregularity, and everything else that needs three dimensions. Vertical ground motion is absent too.',
      'P-delta, soil-structure interaction, pounding against a neighbour, and infill cracking.',
      'Bearing nonlinearity. The isolation layer is a linear spring at 4200 kN/m with 18% damping, not a real lead-rubber or friction pendulum bearing.',
      'Ground displacement as an input. The trace under the animated ground band is double integrated and leaky high-passed for drawing only, and is never fed back to the structure, which is driven by acceleration.',
    ],
    evidence:
      'scripts/verify-quake.mjs, run with npm run verify:quake. It checks the solver against two numbers from outside itself and then checks every level against exhaustive enumeration. Details in the last section.',
    verified: true,
  },
  {
    id: 'ik',
    n: '03',
    title: 'Two-link inverse kinematics',
    source: ['src/challenges/robotics/RobotArmChallenge.tsx'],
    game: 'Claw Machine, robotics engineering',
    computes:
      'Given a point you drag to, the shoulder and elbow angles that put the gripper on it, in closed form. There are almost always two answers, elbow up and elbow down, and level 3 turns the choice on. The solver also reports whether the joints can actually hold that pose and whether either link passes through the shelf.',
    equations: [
      { expr: 'cos θ₂ = (d² − L₁² − L₂²) / (2 L₁ L₂)', note: 'law of cosines; θ₂ is the elbow angle, its sign is elbow up or down' },
      { expr: 'θ₁ = atan2(dy, dx) − atan2(L₂ sin θ₂, L₁ + L₂ cos θ₂)', note: 'shoulder angle, measured from +x with y up' },
      { expr: 'x = L₁ cos θ₁ + L₂ cos(θ₁ + θ₂)', note: 'forward kinematics, used to place the drawn arm and to check the solution' },
      { expr: 'd = clamp(|L₁ − L₂| + 0.5,  L₁ + L₂ − 0.5,  |target − base|)', note: 'out of reach stretches the arm straight at the point instead of returning nothing' },
    ],
    assumptions: [
      'Closed form, no iteration and no Jacobian. Two links, L₁ = 95 px and L₂ = 85 px, in a plane.',
      'Joint limits are checked after the fact, not enforced inside the solution. The maths returns a pose and the game then decides the joints cannot hold it, which is exactly the level 2 lesson.',
      'Shelf collision is 17 sampled points along each link tested against a rectangle. Links have no thickness and the gripper has no width.',
      'Angles are in degrees and lengths in screen pixels. There is no scale to a real arm.',
    ],
    errs: 'It does not err, within what it claims. The geometry is exact, and the reach clamp is the only approximation: drag past the workspace and you get the straight-arm pose nearest the point rather than a failure, which flatters the arm at the edge of its envelope.',
    notModelled: [
      'Everything dynamic. No masses, inertias, motor torques, gear ratios, acceleration limits, or trajectory timing.',
      'Peak shoulder load, the level 5 metric, is |hand x − base x| in pixels. It is a horizontal-reach stand-in for static torque, not a torque, and it ignores the weight of the arm and of the payload.',
      'Joint travel, the other level 5 metric, is the summed absolute change in both angles across every frame of your drag. It scores the path your hand took, not an optimal trajectory a planner would produce.',
      'Singularities. Near full extension small hand moves need large joint moves, and the model shows that implicitly but never reports it.',
      'Anything past a planar 2R arm: no wrist, no end-effector orientation, no redundancy, no third dimension.',
    ],
    evidence: 'None. No script under scripts/ covers this solver.',
    verified: false,
  },
  {
    id: 'suspension',
    n: '04',
    title: 'The suspension vibration model',
    source: ['src/challenges/mechanical/SuspensionChallenge.tsx'],
    game: 'Smooth Ride, mechanical engineering',
    computes:
      'For a chosen spring, mass and damper count: the natural frequency of the body on its springs, the static sag, a harshness number, and how much of the road shake reaches the body at one road frequency. Everything is a closed-form steady-state number. Nothing is integrated in time.',
    equations: [
      { expr: 'f_n = √(k/m) / 2π', note: 'natural frequency, Hz' },
      { expr: 'ζ = c·n / (2 √(k m)),   r = f_road / f_n', note: 'c = 2000 N·s/m per damper, n is 0 to 3' },
      { expr: 'shake = 1 / √( (1 − r²)² + (2ζr)² )', note: 'this is what the code computes, and it is the dynamic magnification factor for a force applied to the body' },
      { expr: 'transmissibility = √(1 + (2ζr)²) / √( (1 − r²)² + (2ζr)² )', note: 'this is what a base-excited system actually transmits, and the code does not use it' },
      { expr: 'sag = m g / k', note: 'against 160 mm of travel, and level 5 scores what is left' },
      { expr: 'harshness = √(k/m)', note: 'the undamped natural frequency in rad/s, used bare against a cap of 10' },
    ],
    assumptions: [
      'The formula in the code is the wrong one for the physical setup, and it matters at one level. A washboard road shakes the base, not the body, so the honest quantity is displacement transmissibility, which carries the √(1 + (2ζr)²) numerator. The code omits that numerator.',
      'Below and at resonance the two agree closely, so the level 3 lesson is untouched: the firm spring on a 700 kg van has f_n = 1.90 Hz against a 1.90 Hz road, r = 0.999, and the response is enormous either way.',
      'Above r = √2 they part company, and the direction reverses. On level 5 (firm spring, 1200 kg, f_n = 1.45 Hz, road 2.6 Hz, r = 1.79) the implemented shake falls from 45% to 42% as dampers go from 0 to 3, while true base transmissibility rises from 45% to 58%. On a real quarter car, above √2 a damper couples more road into the body, not less. The sign of the damper trade on that level is inverted.',
      'One degree of freedom. The wheel, the tyre spring, and the wheel hop mode do not exist, so the model has one resonance where a real car has two.',
      'Linear spring and linear viscous damper, both constant. Steady-state harmonic response only: no transient, no time history, no single pothole.',
      'With zero dampers ζ is exactly 0, so the response at r = 1 is infinite rather than merely large.',
      'The road is one frequency, chosen per level. It is not a roughness spectrum.',
    ],
    errs: 'Optimistic about dampers above resonance. Everywhere r > √2 the model says adding shock absorbers quietens the ride, and for base excitation the opposite is true. Below and near resonance, which is where levels 1 to 4 live, it is close enough that the lesson holds.',
    notModelled: [
      'The unsprung mass and the tyre. A quarter car has two degrees of freedom; this has one.',
      'Progressive springs and bump stops. Sag either fits inside 160 mm of travel or it does not.',
      'Nonlinear damping, so no difference between compression and rebound.',
      'Pitch, roll, load transfer, anti-roll bars, and contact loss.',
      'Ride comfort weighting. ISO 2631 weights vibration by frequency because people are not equally sensitive across the band. This model treats all shake alike.',
    ],
    evidence: 'None. No script under scripts/ covers this model, which is how the formula above went unnoticed.',
    verified: false,
  },
  {
    id: 'reactor',
    n: '05',
    title: 'The reactor first-order lag',
    source: ['src/challenges/nuclear/ReactorChallenge.tsx'],
    game: 'Reactor Control, nuclear engineering',
    computes:
      'On a fixed 300 ms tick: the gross power the core is making, the core temperature, and the net power leaving the plant once the coolant pumps have taken their cut. Rod position sets a demand, and both power and temperature chase their targets a fixed fraction of the gap at a time.',
    equations: [
      { expr: 'demand = ((100 − rods) / 100) × 1100 MW', note: 'power is linear in rod withdrawal' },
      { expr: 'P ← P + 0.12 · (demand − P)', note: 'per 300 ms tick, so a time constant of 2.35 s' },
      { expr: 'T_eq = 250 + 0.6 · max(0, P − 11 · coolant)', note: 'leftover heat above what the coolant carries away sets the equilibrium temperature' },
      { expr: 'T ← T + 0.10 · (T_eq − T)', note: 'a second lag, time constant 2.85 s, driven by the power the core is already making' },
      { expr: 'net = P − 40 · pumps', note: 'each pump runs off the plant own output, which is what the band is measured against' },
    ],
    assumptions: [
      'Two explicit first-order lags in series on a fixed step. That is the whole dynamic model.',
      'A first-order lag cannot overshoot a step. The oscillation level 3 teaches comes entirely from the operator moving the rods again before the last move has settled, which is a real control-room lesson but not a plant instability.',
      'Under lag, temperature is driven by the power the core has already reached rather than by the demand, so heat trails the rods through both lags.',
      'MW, °C and coolant points share one internally consistent but arbitrary scale. 1100 MW at full withdrawal, 600 °C safe, 900 °C meltdown, 250 °C idle. None of these are calibrated against a real plant.',
      'The tick is wall-clock. Level 5 compresses a whole demand day into 102 ticks, about 31 seconds.',
    ],
    errs: 'Far too forgiving, and simple in the direction of playable. A real core responds to rod motion on several timescales at once, from prompt jump through delayed neutrons to hours of xenon. Collapsing that to one 2.35 s lag makes the plant much easier to steer than the real thing, and removes every way a reactor can surprise you.',
    notModelled: [
      'Neutronics. There is no point-kinetics equation, no delayed neutron fraction, no prompt jump, and no reactivity in pcm or dollars.',
      'Rod worth. Power is linear in withdrawal, where a real bank has an S-shaped worth curve and differential worth that depends on where it already sits.',
      'Reactivity feedback: no Doppler broadening, no moderator temperature coefficient, no void coefficient.',
      'Xenon. No poisoning, no post-trip peak, no restart deadtime.',
      'Decay heat. Scram the game and the heat stops, where a real core keeps making about 7% of full power the instant it shuts down.',
      'Thermal hydraulics. Coolant is a number that removes 11 units of heat per point, with no loop, no flow rate, no pressure, no boiling, and no heat exchanger.',
    ],
    evidence: 'None. No script under scripts/ covers this model.',
    verified: false,
  },
  {
    id: 'titration',
    n: '06',
    title: 'The weak-acid titration curve',
    source: ['src/challenges/chemical/TitrationChallenge.tsx'],
    game: 'The Right Dose, chemical engineering',
    computes:
      'The pH of the flask after a given volume of 0.1 M strong base has been poured into 50 mL of a weak acid with pKa 5. It is a closed-form curve in three pieces, evaluated fresh at every pour, which is what makes the buffer region gentle and the equivalence point nearly vertical.',
    equations: [
      { expr: 'V_b = 0:   pH = ½ (pKa − log₁₀ C_a)', note: 'the weak-acid starting point, pH 3.00 for these numbers' },
      { expr: '0 < V_b < V_eq:   pH = pKa + log₁₀( V_b / (V_eq − V_b) )', note: 'Henderson-Hasselbalch, the buffer region' },
      { expr: 'V_b > V_eq:   pH = 14 + log₁₀( C_b (V_b − V_eq) / (V_flask + V_b) )', note: 'excess strong base, clamped at pH 13.5' },
      { expr: 'V_b = V_eq:   pH = 8.7', note: 'a hardcoded constant, not a calculation' },
    ],
    assumptions: [
      'Henderson-Hasselbalch ignores water autoionisation and treats concentrations as activities. That is the standard approximation and it is accurate through the middle of the buffer region, but it diverges to ±∞ at both ends of it.',
      'The equivalence value is patched, not derived. Hydrolysis of the conjugate base gives pH 8.85 for these numbers; the code returns 8.7, which is the Henderson-Hasselbalch value at 49.99 mL. It is a continuity patch for the seam between two branches.',
      'That seam is reachable. Pours come in 10, 5 and 1 mL, so exactly 50 mL is easy to hit, and when you do the flask reads 0.15 pH low. No level band sits there, so it never changes a verdict.',
      'The three branches are pieced together rather than solved as one equilibrium, so the curve is not continuous at the equivalence point. It runs 6.69 at 49 mL, 8.70 at 50, 11.00 at 51, which is the right shape and the right size of cliff even though no single equilibrium produced it.',
      'Volumes add with no volume-of-mixing correction, and the acid is monoprotic with a fixed pKa of 5.',
    ],
    errs: 'Accurate where it is played, wrong by a small fixed amount at one point. Everywhere a level band sits, the curve is the textbook curve. The only defect is 0.15 of a pH unit at exactly 50 mL, and it errs low.',
    notModelled: [
      'Temperature. Kw is fixed at 1e-14 and pKa never moves.',
      'Ionic strength and activity coefficients. Concentrations are used directly.',
      'Indicator chemistry. The flask colour is a display mapping of pH, not a dye equilibrium.',
      'Polyprotic acids, mixtures, and any second equivalence point.',
      'Mixing kinetics and drop volume. A pour is instantaneous and perfectly mixed.',
      'Buffer capacity as a number. You feel it in the shape of the curve, but it is never computed or shown.',
    ],
    evidence: 'None. No script under scripts/ covers this model.',
    verified: false,
  },
]

/** The discrete-optimisation family, documented together. */
interface DiscreteNote {
  id: string
  title: string
  source: string
  game: string
  body: string
  equations: Equation[]
  notModelled: string[]
}

const DISCRETE: DiscreteNote[] = [
  {
    id: 'mission',
    title: 'Mission budget',
    source: 'src/challenges/systems/MissionChallenge.tsx',
    game: 'Mission Budget, systems engineering',
    body: 'Split a mass budget between four subsystems. Each kilogram buys a constant amount of capability, and three coupled constraints have to come out green at once. It is a small linear feasibility problem, and the engineering content is the coupling: add science and you need more power and more cooling, both of which cost the mass you wanted for science.',
    equations: [
      { expr: 'science = m_sci,   comms = m_com,   supply = 2.4 · m_pow,   cooling = m_therm' },
      { expr: 'demand = p · science + 0.8 · comms', note: 'p is 1.2 to 1.6 depending on the level' },
      { expr: 'cooling_need = 0.5 · (science + comms)' },
      { expr: 'pass  ⇔  science ≥ goal ∧ comms ≥ goal ∧ supply ≥ demand ∧ cooling ≥ cooling_need ∧ Σm ≤ budget' },
    ],
    notModelled: [
      'Any physics behind the yields. Every constant is a design ratio chosen to make the coupling bite, not a watts-per-kilogram figure from a real solar array or radiator.',
      'Orbit, eclipse fraction, duty cycle, battery depth of discharge, radiator area and view factor, link budget, and pointing. None of these exist.',
    ],
  },
  {
    id: 'critical-path',
    title: 'Critical path',
    source: 'src/challenges/systems/CriticalPathChallenge.tsx',
    game: 'Critical Path, systems engineering',
    body: 'This one is not a simplification of anything. It is the critical path method as taught: a forward pass over a six-task dependency graph for earliest starts, a backward pass for latest finishes, and slack as the difference. Anything with zero slack decides the finish date, and paying to shorten a task with slack moves that date by exactly nothing.',
    equations: [
      { expr: 'start_t = max over predecessors p of end_p,   end_t = start_t + duration_t' },
      { expr: 'latest_t = min over successors s of (latest_s − duration_s),   or finish if none' },
      { expr: 'slack_t = latest_t − end_t,   critical ⇔ slack_t ≤ 0' },
      { expr: 'crash_cost = Σ days_cut(t) × rate(t)', note: 'each task has its own per-day rate and its own cap' },
    ],
    notModelled: [
      'Uncertainty. Durations are deterministic integers, so there is no PERT distribution, no Monte Carlo, and no probability of finishing on time.',
      'Resources. No levelling, no shared crews, no calendar, no weekends.',
      'Crashing is linear up to a hard cap, where real crashing has diminishing returns and adds its own risk. Worst squeeze is reported as a number but the schedule never suffers for it.',
    ],
  },
  {
    id: 'warehouse',
    title: 'Warehouse slotting',
    source: 'src/challenges/industrial/WarehouseChallenge.tsx',
    game: 'Warehouse Layout, industrial engineering',
    body: 'Assign six products to three aisles with two slots each, and score the day. The two objectives are the standard slotting measures, and they disagree: trips times distance puts the busy products at the front, trips times distance times weight puts the heavy ones there instead.',
    equations: [
      { expr: 'walk = Σ picks_i × distance(zone_i)' },
      { expr: 'effort = Σ picks_i × distance(zone_i) × weight_i' },
      { expr: 'front_trips = Σ picks_i  where zone_i = front', note: 'the level 5 congestion proxy' },
    ],
    notModelled: [
      'Routing. Distance is a constant per aisle, 1, 3 or 6, not a computed path, so there is no traversal strategy, no return trip, and no aisle length.',
      'Order batching, pick sequencing, replenishment, and product volume.',
      'Congestion itself. Level 5 scores front-aisle trips as a proxy, but no picker ever actually queues behind another.',
    ],
  },
  {
    id: 'quality-gate',
    title: 'Quality gate placement',
    source: 'src/challenges/industrial/QualityGateChallenge.tsx',
    game: 'Quality Gate, industrial engineering',
    body: 'Choose where to put inspections on a four-station line running 1000 units. The model is an expected-value cost roll-up, and the real content is that a defect made early is cheap to bin and expensive to keep, because every station after it pours more value into a unit that was already ruined.',
    equations: [
      { expr: 'made_i = good_i × p_i,   good_(i+1) = good_i − made_i,   bad += made_i' },
      { expr: 'value_i = Σ_(j ≤ i) station_value_j', note: 'what one unit is worth by the time it leaves station i' },
      { expr: 'gate at i:  inspect += 1.5 × units_on_line,  scrap += bad × value_i,  bad ← 0' },
      { expr: 'total = inspect + scrap + 60 × escaped' },
    ],
    notModelled: [
      'Randomness. This is expected value, not a sampled batch, so unit counts are fractional and the same layout always costs the same.',
      'Imperfect inspection. Gates catch 100% of defects with zero false rejects, where real inspection has an escape rate and a false-alarm rate.',
      'Rework. A caught defect is always scrapped, never repaired.',
      'Sampling plans, AQL, control charts, and inspector time as a resource rather than a per-unit price.',
      'Any response of the defect rates to what you do. They are fixed constants, unmoved by line speed or tooling wear.',
      'The ten units on the belt are a hand-written sample chosen to look like the rates. They illustrate the maths, they are not a draw from it.',
    ],
  },
]

/* ------------------- page pieces ------------------- */

function Label({ children }: { children: React.ReactNode }) {
  return <p className="label-caps text-ink-soft dark:text-stone-400">{children}</p>
}

/**
 * A labelled block in the notebook two-column grid. min-w-0 on the content
 * column matters: grid items default to min-width auto, and without it a long
 * equation widens the whole page instead of scrolling inside its own line.
 */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rule grid gap-1.5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <Label>{label}</Label>
      <div className="min-w-0 text-[15px] leading-relaxed text-ink-soft dark:text-stone-300">
        {children}
      </div>
    </div>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t} className="grid grid-cols-[1rem_1fr] gap-1">
          <span aria-hidden className="font-mono text-ink-soft/60 dark:text-stone-500">
            ·
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function Equations({ items }: { items: Equation[] }) {
  return (
    <dl className="space-y-3">
      {items.map(({ expr, note }) => (
        <div key={expr} className="min-w-0">
          <dt className="min-w-0 overflow-x-auto pb-1">
            <code className="font-mono text-[13.5px] whitespace-pre text-ink dark:text-stone-100">
              {expr}
            </code>
          </dt>
          {note ? (
            <dd className="figure-caption mt-1">{note}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  )
}

/**
 * Notes on how the simulations in Engineering Explorer work, written for
 * somebody evaluating the engineering rather than playing the games.
 */
export function TechnicalNotesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Label>Technical notes</Label>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        What the simulations actually compute
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft dark:text-stone-300">
        Thirty-six games ship in this app and the about page names three of the models behind
        them. This is the long version, for a reader who wants to judge the engineering: what each
        model computes, the equations it runs, the assumptions it makes, which way its
        simplifications push the answer, and what it deliberately leaves out. Ten of the
        thirty-six games are covered. The rest are not.
      </p>

      <section className="mt-8">
        <div className="rule grid gap-1.5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
          <Label>How to read it</Label>
          <div className="space-y-2 text-[15px] leading-relaxed text-ink-soft dark:text-stone-300">
            <p>
              Every equation below is a transcription of code in the file named at the head of its
              section, and every number quoted is a constant from that file. Where a model runs in
              an internally consistent but arbitrary scale rather than in SI units, the section
              says so.
            </p>
            <p>
              <span className="font-semibold text-ink dark:text-stone-200">Errs toward</span> is the
              part worth reading first. It says which direction the simplifications push, if you
              took a design the game passed and built it.
            </p>
          </div>
        </div>
      </section>

      <nav aria-label="Contents" className="mt-8">
        <Label>Contents</Label>
        <ol className="mt-3 space-y-1.5">
          {MODELS.map((m) => (
            <li key={m.id} className="grid grid-cols-[2.5rem_1fr] gap-2 text-[15px]">
              <span className="font-mono text-ink-soft dark:text-stone-500">{m.n}</span>
              <a
                href={`#${m.id}`}
                className="text-ink underline decoration-stone-900/20 underline-offset-4 transition-colors hover:decoration-stone-900/60 dark:text-stone-200 dark:decoration-white/25 dark:hover:decoration-white/60"
              >
                {m.title}
              </a>
            </li>
          ))}
          <li className="grid grid-cols-[2.5rem_1fr] gap-2 text-[15px]">
            <span className="font-mono text-ink-soft dark:text-stone-500">07</span>
            <a
              href="#discrete"
              className="text-ink underline decoration-stone-900/20 underline-offset-4 transition-colors hover:decoration-stone-900/60 dark:text-stone-200 dark:decoration-white/25 dark:hover:decoration-white/60"
            >
              Four discrete-optimisation models
            </a>
          </li>
          <li className="grid grid-cols-[2.5rem_1fr] gap-2 text-[15px]">
            <span className="font-mono text-ink-soft dark:text-stone-500">08</span>
            <a
              href="#verification"
              className="text-ink underline decoration-stone-900/20 underline-offset-4 transition-colors hover:decoration-stone-900/60 dark:text-stone-200 dark:decoration-white/25 dark:hover:decoration-white/60"
            >
              What is verified, and what is not
            </a>
          </li>
        </ol>
      </nav>

      {MODELS.map((m) => (
        <section key={m.id} id={m.id} className="mt-14 scroll-mt-24">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm text-ink-soft dark:text-stone-500">{m.n}</span>
            <h2 className="font-display text-2xl font-bold tracking-tight">{m.title}</h2>
          </div>
          <p className="mt-1.5 pl-0 font-mono text-[12.5px] text-ink-soft sm:pl-9 dark:text-stone-500">
            {m.source.join('  ·  ')}
          </p>
          <p className="mt-0.5 pl-0 text-[13px] text-ink-soft sm:pl-9 dark:text-stone-400">
            {m.game}
          </p>

          <div className="mt-5">
            <Block label="What it computes">{m.computes}</Block>
            <Block label="Governing equations">
              <Equations items={m.equations} />
            </Block>
            <Block label="Assumptions">
              <Bullets items={m.assumptions} />
            </Block>
            <Block label="Errs toward">{m.errs}</Block>
            <Block label="Not modelled">
              <Bullets items={m.notModelled} />
            </Block>
            <Block label="Evidence">
              <span className={m.verified ? 'text-ink dark:text-stone-200' : undefined}>
                {m.evidence}
              </span>
            </Block>
          </div>
        </section>
      ))}

      <section id="discrete" className="mt-14 scroll-mt-24">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm text-ink-soft dark:text-stone-500">07</span>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Four discrete-optimisation models
          </h2>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft dark:text-stone-300">
          These four are honest models of a different kind. There is no differential equation to
          integrate and no physics to get wrong. Each one is a small combinatorial problem with an
          objective and constraints, solved exactly and scored exactly, and two of them are
          textbook methods rather than approximations of one. What they simplify is the world the
          numbers came from, not the arithmetic, so the failure mode is different: the answers are
          exact, and the inputs are invented.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft dark:text-stone-300">
          None of the four has a verification script, and none needs one in the way the continuous
          models do. Each is small enough to enumerate by hand, and the level comments in each file
          record the enumeration that set its pars.
        </p>

        {DISCRETE.map((d) => (
          <div key={d.id} id={d.id} className="mt-10 scroll-mt-24">
            <h3 className="font-display text-lg font-bold tracking-tight">{d.title}</h3>
            <p className="mt-1 font-mono text-[12.5px] text-ink-soft dark:text-stone-500">
              {d.source}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft dark:text-stone-400">{d.game}</p>
            <div className="mt-4">
              <Block label="What it does">{d.body}</Block>
              <Block label="The maths">
                <Equations items={d.equations} />
              </Block>
              <Block label="Not modelled">
                <Bullets items={d.notModelled} />
              </Block>
            </div>
          </div>
        ))}
      </section>

      <section id="verification" className="mt-14 scroll-mt-24">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm text-ink-soft dark:text-stone-500">08</span>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            What is verified, and what is not
          </h2>
        </div>

        <div className="mt-5">
          <Block label="The one script">
            <p>
              <code className="font-mono text-[13.5px]">scripts/verify-quake.mjs</code>, run with{' '}
              <code className="font-mono text-[13.5px]">npm run verify:quake</code> or{' '}
              <code className="font-mono text-[13.5px]">npm run verify</code>. Node strips the
              types off <code className="font-mono text-[13.5px]">shear.ts</code> on import, so it
              runs with no build step and no dependency.
            </p>
          </Block>
          <Block label="What it checks">
            <Bullets
              items={[
                'The six modal periods of a uniform shear building against the closed form ω_r = 2√(k/m) sin((2r−1)π / (2(2N+1))), which comes from outside the code entirely. Worst relative error at the last run: 1.9e-15.',
                'The peak amplitude of a single oscillator driven at its own frequency against the textbook value A / (2ζω²). Last run: 0.008% off.',
                'That one design analysis costs under 1 ms, which is what lets the game re-run the whole earthquake on every drag. Last run: 0.909 ms.',
                'Then every legal design for every level, enumerated: 256, 121, 2338, 4216 and 8024 layouts. It asserts what each level is tuned to teach, including that exactly 16 of level 3 layouts stand, that no fixed-base design passes level 4, and that no design in level 5 meets all three pars at once.',
              ]}
            />
          </Block>
          <Block label="What that script cannot tell you">
            <p>
              The level table inside the script mirrors the one in{' '}
              <code className="font-mono text-[13.5px]">QuakeChallenge.tsx</code> by hand. Change
              one and not the other and the script will happily verify a game that no longer
              exists. The script says so in its own header.
            </p>
          </Block>
          <Block label="The gap">
            <p>
              Five of the six continuous models on this page have no automated check at all. The
              truss solver, the inverse kinematics, the suspension model, the reactor lag and the
              titration curve are backed by nothing but the code and this page. That is a gap, and
              it is the reason the formula in section 04 sat unnoticed: no test would have caught
              it, so nothing did.
            </p>
          </Block>
        </div>
      </section>
    </div>
  )
}
