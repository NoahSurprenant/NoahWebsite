import { Euler, Vector3 } from "three";

export interface Item {
    assetPath: string;
    shouldRotate: boolean;
    caption: string;
    rotationOnLoad?: Euler;
    scaleOnLoad?: Vector3;

}