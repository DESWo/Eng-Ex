import type { ComponentType } from 'react'
import { CatapultChallenge } from '@/challenges/mechanical/CatapultChallenge'
import { SuspensionChallenge } from '@/challenges/mechanical/SuspensionChallenge'
import { BeamChallenge } from '@/challenges/mechanical/BeamChallenge'
import { BridgeChallenge } from '@/challenges/civil/BridgeChallenge'
import { TrafficChallenge } from '@/challenges/civil/TrafficChallenge'
import { QuakeChallenge } from '@/challenges/civil/QuakeChallenge'
import { PowerGridChallenge } from '@/challenges/electrical/PowerGridChallenge'
import { CircuitChallenge } from '@/challenges/electrical/CircuitChallenge'
import { OverloadChallenge } from '@/challenges/electrical/OverloadChallenge'
import { ReactorChallenge } from '@/challenges/nuclear/ReactorChallenge'
import { FlightChallenge } from '@/challenges/aerospace/FlightChallenge'
import { OrbitChallenge } from '@/challenges/aerospace/OrbitChallenge'
import { AssemblyChallenge } from '@/challenges/industrial/AssemblyChallenge'
import { MissionChallenge } from '@/challenges/systems/MissionChallenge'
import { RobotArmChallenge } from '@/challenges/robotics/RobotArmChallenge'
import { LineFollowerChallenge } from '@/challenges/robotics/LineFollowerChallenge'
import { GripperChallenge } from '@/challenges/robotics/GripperChallenge'
import { WaterChallenge } from '@/challenges/environmental/WaterChallenge'
import { TowerChallenge } from '@/challenges/structural/TowerChallenge'
import { LogicChallenge } from '@/challenges/computer/LogicChallenge'
import { ReentryChallenge } from '@/challenges/aerospace/ReentryChallenge'
import { ShieldChallenge } from '@/challenges/nuclear/ShieldChallenge'
import { DecayHeatChallenge } from '@/challenges/nuclear/DecayHeatChallenge'
import { BinaryChallenge } from '@/challenges/computer/BinaryChallenge'
import { ErrorCheckChallenge } from '@/challenges/computer/ErrorCheckChallenge'
import { BeamSectionChallenge } from '@/challenges/structural/BeamSectionChallenge'
import { FoundationChallenge } from '@/challenges/structural/FoundationChallenge'
import { QualityGateChallenge } from '@/challenges/industrial/QualityGateChallenge'
import { WarehouseChallenge } from '@/challenges/industrial/WarehouseChallenge'
import { RedundancyChallenge } from '@/challenges/systems/RedundancyChallenge'
import { CriticalPathChallenge } from '@/challenges/systems/CriticalPathChallenge'
import { SolarChallenge } from '@/challenges/environmental/SolarChallenge'
import { StormwaterChallenge } from '@/challenges/environmental/StormwaterChallenge'
import type { ChallengeProps } from '@/lib/types'

/**
 * Every playable challenge, keyed by id.
 * A discipline's `challenges` list (src/data/disciplines.ts) points here.
 * To add a challenge: build the component, then register it below.
 */
export const challengeRegistry: Record<string, ComponentType<ChallengeProps>> = {
  catapult: CatapultChallenge,
  suspension: SuspensionChallenge,
  beam: BeamChallenge,
  bridge: BridgeChallenge,
  traffic: TrafficChallenge,
  quake: QuakeChallenge,
  'power-grid': PowerGridChallenge,
  circuit: CircuitChallenge,
  overload: OverloadChallenge,
  reactor: ReactorChallenge,
  flight: FlightChallenge,
  orbit: OrbitChallenge,
  assembly: AssemblyChallenge,
  mission: MissionChallenge,
  'robot-arm': RobotArmChallenge,
  'line-follower': LineFollowerChallenge,
  gripper: GripperChallenge,
  water: WaterChallenge,
  tower: TowerChallenge,
  logic: LogicChallenge,
  reentry: ReentryChallenge,
  shield: ShieldChallenge,
  'decay-heat': DecayHeatChallenge,
  binary: BinaryChallenge,
  'error-check': ErrorCheckChallenge,
  'beam-section': BeamSectionChallenge,
  foundation: FoundationChallenge,
  'quality-gate': QualityGateChallenge,
  warehouse: WarehouseChallenge,
  redundancy: RedundancyChallenge,
  'critical-path': CriticalPathChallenge,
  solar: SolarChallenge,
  stormwater: StormwaterChallenge,
}
