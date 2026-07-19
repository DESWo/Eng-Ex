import type { ComponentType } from 'react'
import { CatapultChallenge } from '@/challenges/mechanical/CatapultChallenge'
import { GearChallenge } from '@/challenges/mechanical/GearChallenge'
import { BeamChallenge } from '@/challenges/mechanical/BeamChallenge'
import { BridgeChallenge } from '@/challenges/civil/BridgeChallenge'
import { TrafficChallenge } from '@/challenges/civil/TrafficChallenge'
import { QuakeChallenge } from '@/challenges/civil/QuakeChallenge'
import { PowerGridChallenge } from '@/challenges/electrical/PowerGridChallenge'
import { CircuitChallenge } from '@/challenges/electrical/CircuitChallenge'
import { OverloadChallenge } from '@/challenges/electrical/OverloadChallenge'
import { ReactorChallenge } from '@/challenges/nuclear/ReactorChallenge'
import { FlightChallenge } from '@/challenges/aerospace/FlightChallenge'
import { AssemblyChallenge } from '@/challenges/industrial/AssemblyChallenge'
import { MissionChallenge } from '@/challenges/systems/MissionChallenge'
import { RobotArmChallenge } from '@/challenges/robotics/RobotArmChallenge'
import { WaterChallenge } from '@/challenges/environmental/WaterChallenge'
import { TowerChallenge } from '@/challenges/structural/TowerChallenge'
import { LogicChallenge } from '@/challenges/computer/LogicChallenge'
import type { ChallengeProps } from '@/lib/types'

/**
 * Every playable challenge, keyed by id.
 * A discipline's `challenges` list (src/data/disciplines.ts) points here.
 * To add a challenge: build the component, then register it below.
 */
export const challengeRegistry: Record<string, ComponentType<ChallengeProps>> = {
  catapult: CatapultChallenge,
  gears: GearChallenge,
  beam: BeamChallenge,
  bridge: BridgeChallenge,
  traffic: TrafficChallenge,
  quake: QuakeChallenge,
  'power-grid': PowerGridChallenge,
  circuit: CircuitChallenge,
  overload: OverloadChallenge,
  reactor: ReactorChallenge,
  flight: FlightChallenge,
  assembly: AssemblyChallenge,
  mission: MissionChallenge,
  'robot-arm': RobotArmChallenge,
  water: WaterChallenge,
  tower: TowerChallenge,
  logic: LogicChallenge,
}
