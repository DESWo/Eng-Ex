import { lazy } from 'react'
import type { ComponentType } from 'react'
import type { ChallengeProps } from '@/lib/types'

/**
 * Each game loads as its own chunk the first time somebody opens it, so the
 * landing page does not pay for all 33 up front.
 */
const lazyChallenge = <T,>(
  load: () => Promise<T>,
  pick: (m: T) => ComponentType<ChallengeProps>,
) => lazy(() => load().then((m) => ({ default: pick(m) })))

/**
 * Every playable challenge, keyed by id.
 * A discipline's `challenges` list (src/data/disciplines.ts) points here.
 * To add a challenge: build the component, then register it below.
 */
export const challengeRegistry: Record<string, ComponentType<ChallengeProps>> = {
  catapult: lazyChallenge(
    () => import('@/challenges/mechanical/CatapultChallenge'),
    (m) => m.CatapultChallenge,
  ),
  suspension: lazyChallenge(
    () => import('@/challenges/mechanical/SuspensionChallenge'),
    (m) => m.SuspensionChallenge,
  ),
  beam: lazyChallenge(
    () => import('@/challenges/mechanical/BeamChallenge'),
    (m) => m.BeamChallenge,
  ),
  bridge: lazyChallenge(
    () => import('@/challenges/civil/BridgeChallenge'),
    (m) => m.BridgeChallenge,
  ),
  traffic: lazyChallenge(
    () => import('@/challenges/civil/TrafficChallenge'),
    (m) => m.TrafficChallenge,
  ),
  quake: lazyChallenge(
    () => import('@/challenges/civil/QuakeChallenge'),
    (m) => m.QuakeChallenge,
  ),
  'power-grid': lazyChallenge(
    () => import('@/challenges/electrical/PowerGridChallenge'),
    (m) => m.PowerGridChallenge,
  ),
  circuit: lazyChallenge(
    () => import('@/challenges/electrical/CircuitChallenge'),
    (m) => m.CircuitChallenge,
  ),
  overload: lazyChallenge(
    () => import('@/challenges/electrical/OverloadChallenge'),
    (m) => m.OverloadChallenge,
  ),
  reactor: lazyChallenge(
    () => import('@/challenges/nuclear/ReactorChallenge'),
    (m) => m.ReactorChallenge,
  ),
  flight: lazyChallenge(
    () => import('@/challenges/aerospace/FlightChallenge'),
    (m) => m.FlightChallenge,
  ),
  orbit: lazyChallenge(
    () => import('@/challenges/aerospace/OrbitChallenge'),
    (m) => m.OrbitChallenge,
  ),
  assembly: lazyChallenge(
    () => import('@/challenges/industrial/AssemblyChallenge'),
    (m) => m.AssemblyChallenge,
  ),
  mission: lazyChallenge(
    () => import('@/challenges/systems/MissionChallenge'),
    (m) => m.MissionChallenge,
  ),
  'robot-arm': lazyChallenge(
    () => import('@/challenges/robotics/RobotArmChallenge'),
    (m) => m.RobotArmChallenge,
  ),
  'line-follower': lazyChallenge(
    () => import('@/challenges/robotics/LineFollowerChallenge'),
    (m) => m.LineFollowerChallenge,
  ),
  gripper: lazyChallenge(
    () => import('@/challenges/robotics/GripperChallenge'),
    (m) => m.GripperChallenge,
  ),
  water: lazyChallenge(
    () => import('@/challenges/environmental/WaterChallenge'),
    (m) => m.WaterChallenge,
  ),
  tower: lazyChallenge(
    () => import('@/challenges/structural/TowerChallenge'),
    (m) => m.TowerChallenge,
  ),
  logic: lazyChallenge(
    () => import('@/challenges/computer/LogicChallenge'),
    (m) => m.LogicChallenge,
  ),
  reentry: lazyChallenge(
    () => import('@/challenges/aerospace/ReentryChallenge'),
    (m) => m.ReentryChallenge,
  ),
  shield: lazyChallenge(
    () => import('@/challenges/nuclear/ShieldChallenge'),
    (m) => m.ShieldChallenge,
  ),
  'decay-heat': lazyChallenge(
    () => import('@/challenges/nuclear/DecayHeatChallenge'),
    (m) => m.DecayHeatChallenge,
  ),
  binary: lazyChallenge(
    () => import('@/challenges/computer/BinaryChallenge'),
    (m) => m.BinaryChallenge,
  ),
  'error-check': lazyChallenge(
    () => import('@/challenges/computer/ErrorCheckChallenge'),
    (m) => m.ErrorCheckChallenge,
  ),
  'beam-section': lazyChallenge(
    () => import('@/challenges/structural/BeamSectionChallenge'),
    (m) => m.BeamSectionChallenge,
  ),
  foundation: lazyChallenge(
    () => import('@/challenges/structural/FoundationChallenge'),
    (m) => m.FoundationChallenge,
  ),
  'quality-gate': lazyChallenge(
    () => import('@/challenges/industrial/QualityGateChallenge'),
    (m) => m.QualityGateChallenge,
  ),
  warehouse: lazyChallenge(
    () => import('@/challenges/industrial/WarehouseChallenge'),
    (m) => m.WarehouseChallenge,
  ),
  redundancy: lazyChallenge(
    () => import('@/challenges/systems/RedundancyChallenge'),
    (m) => m.RedundancyChallenge,
  ),
  'critical-path': lazyChallenge(
    () => import('@/challenges/systems/CriticalPathChallenge'),
    (m) => m.CriticalPathChallenge,
  ),
  solar: lazyChallenge(
    () => import('@/challenges/environmental/SolarChallenge'),
    (m) => m.SolarChallenge,
  ),
  stormwater: lazyChallenge(
    () => import('@/challenges/environmental/StormwaterChallenge'),
    (m) => m.StormwaterChallenge,
  ),
}
