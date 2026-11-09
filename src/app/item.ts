import { Euler, Vector3 } from "three";
import { ItemText } from "./skyrim-item";

/** An item's model and how it's shown. Its words (ItemText) are in skyrim-item.ts. */
export interface Model {
    perlin: boolean;
    assetPath?: string;
    shouldRotate: boolean;
    rotationOnLoad?: Euler;
    scaleOnLoad?: Vector3;
}

export type Item = Model & ItemText;