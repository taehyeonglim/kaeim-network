declare module 'd3-force-3d' {
 import type {Simulation,SimulationNodeDatum as NodeDatum} from 'd3-force';
 import {forceY} from 'd3-force';
 export {forceLink,forceManyBody,forceX,forceY,forceCollide} from 'd3-force';
 export type {SimulationLinkDatum} from 'd3-force';
 export interface SimulationNodeDatum extends NodeDatum {z?:number;vz?:number;fz?:number|null}
 export function forceSimulation<N extends SimulationNodeDatum>(nodes:N[],dimensions?:number):Simulation<N,undefined>;
 export const forceZ:typeof forceY;
}
