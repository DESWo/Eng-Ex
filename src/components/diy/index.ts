import type { ComponentType } from 'react'
import { SpoonCatapultDiagram } from '@/components/diy/SpoonCatapultDiagram'
import { TrussBridgeDiagram } from '@/components/diy/TrussBridgeDiagram'
import { PaperClipFlashlightDiagram } from '@/components/diy/PaperClipFlashlightDiagram'
import { DominoChainDiagram } from '@/components/diy/DominoChainDiagram'
import { PaperPlaneDiagram } from '@/components/diy/PaperPlaneDiagram'
import { AssemblyLineDiagram } from '@/components/diy/AssemblyLineDiagram'
import { EggDropDiagram } from '@/components/diy/EggDropDiagram'
import { GrabberDiagram } from '@/components/diy/GrabberDiagram'
import { BottleFilterDiagram } from '@/components/diy/BottleFilterDiagram'
import { PaperTowerDiagram } from '@/components/diy/PaperTowerDiagram'
import { TwoSwitchDiagram } from '@/components/diy/TwoSwitchDiagram'

/**
 * Build diagrams for the DIY projects, keyed by id.
 * A discipline's `diy.diagram` (src/data/disciplines.ts) points here.
 * No entry, no diagram: the step simply renders without one.
 */
export const diyDiagramRegistry: Record<string, ComponentType> = {
  'spoon-catapult': SpoonCatapultDiagram,
  'truss-bridge': TrussBridgeDiagram,
  'paper-clip-flashlight': PaperClipFlashlightDiagram,
  'domino-chain': DominoChainDiagram,
  'paper-plane': PaperPlaneDiagram,
  'assembly-line': AssemblyLineDiagram,
  'egg-drop': EggDropDiagram,
  grabber: GrabberDiagram,
  'bottle-filter': BottleFilterDiagram,
  'paper-tower': PaperTowerDiagram,
  'two-switch': TwoSwitchDiagram,
}
