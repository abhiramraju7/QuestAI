declare module "framer-motion" {
  export const motion: any;
  export const AnimatePresence: any;
  export function useMotionValue(initial: any): any;
  export function useTransform(value: any, input: number[], output: number[]): any;
}

declare module "@react-three/fiber" {
  export const Canvas: any;
  export function useFrame(cb: any): void;
}

declare module "three" {
  const THREE: any;
  export default THREE;
  export const BufferGeometry: any;
  export const BufferAttribute: any;
  export const PointsMaterial: any;
  export const Points: any;
  export const Color: any;
  export const AdditiveBlending: any;
}


