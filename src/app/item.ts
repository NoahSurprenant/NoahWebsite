import { Euler, Vector3 } from "three";

export interface Item {
    perlin: boolean;
    assetPath: string;
    shouldRotate: boolean;
    caption: string;
    rotationOnLoad?: Euler;
    scaleOnLoad?: Vector3;
    attribution?: Attribution;
}

export interface Attribution {
    short: string;
    long: string;
    url?: string;
}